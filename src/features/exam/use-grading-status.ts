import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { retryExamGrading } from "@/features/exam/api/exam-grading-retry";
import { getExamGradingStatus } from "@/features/exam/api/exam-grading-status";
import { trackEvent } from "@/lib/amplitude";
import type { ExamGradingLifecycleStatus } from "@/types/exam";
import { reportOperationalError } from "@/lib/operational-error-reporting";

/** 채점표에 올라가는 파트 수. 토익 스피킹 정규 구성과 같다. */
export const GRADING_PART_COUNT = 5;

const TIMED_PART_COUNT = GRADING_PART_COUNT - 1;
const PART_INTERVAL_MS = 10_000;
const POLL_INTERVAL_MS = 3_000;
const ATTEMPT_TIMEOUT_MS = 180_000;
const COMPLETE_STEP_INTERVAL_MS = 180;
const COMPLETE_HOLD_MS = 600;

export type GradingWaitPhase =
  | "polling"
  | "retry-ready"
  | "retry-requesting"
  | "completing"
  | "terminal-error";

type GradingAttempt = 0 | 1;

export interface GradingProgress {
  phase: GradingWaitPhase;
  /** 시간으로는 최대 4까지만 증가하고, 5는 서버 COMPLETED 뒤에만 가능하다. */
  gradedPartCount: number;
  /** 최초 실패 뒤 한 번만 유효하다. 연속 호출은 내부 single-flight guard가 막는다. */
  retry: () => void;
}

interface GradingProgressState {
  phase: GradingWaitPhase;
  gradedPartCount: number;
}

/**
 * 시험 단위 status polling, 시도별 timeout과 사용자 재요청 lifecycle을 소유한다.
 *
 * 각 시도는 자신의 AbortSignal을 캡처한다. timeout, 재요청 또는 unmount로 해당
 * controller가 abort된 뒤 늦게 끝난 요청은 `signal.aborted`를 보고 결과를 적용하지 않는다.
 */
export function useGradingStatus(
  examId: string,
  onComplete: () => void,
): GradingProgress {
  const [attempt, setAttempt] = useState<GradingAttempt>(0);
  const [progress, setProgress] = useState<GradingProgressState>({
    phase: "polling",
    gradedPartCount: 0,
  });
  const activeAttemptStopRef = useRef<(() => void) | null>(null);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didNavigateRef = useRef(false);
  const gradedPartCountRef = useRef(0);
  const mountedRef = useRef(true);
  const onCompleteRef = useRef(onComplete);
  const phaseRef = useRef<GradingWaitPhase>("polling");
  const retryControllerRef = useRef<AbortController | null>(null);
  const retryLockedRef = useRef(false);
  const hasReportedTerminalErrorRef = useRef(false);

  const updatePhase = useCallback((phase: GradingWaitPhase) => {
    phaseRef.current = phase;
    setProgress((current) => ({ ...current, phase }));
  }, []);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    mountedRef.current = true;
    const mountedAt = Date.now();

    return () => {
      mountedRef.current = false;
      /**
       * 채점을 끝까지 기다리지 않고 나간 경우다. `elapsedMs`가 진행률 UI를 얼마나
       * 버티게 만들어야 하는지의 근거가 된다.
       *
       * 두 phase는 제외한다. terminal-error는 이용자가 선택해서 나간 것이 아니고,
       * completing은 채점이 이미 끝난 뒤의 연출 구간이라 didNavigateRef가 서기
       * 전까지 짧지 않은 시간이 걸린다.
       */
      if (
        !didNavigateRef.current &&
        phaseRef.current !== "terminal-error" &&
        phaseRef.current !== "completing"
      ) {
        trackEvent({
          name: "grading_wait_abandoned",
          properties: {
            elapsedMs: Date.now() - mountedAt,
            gradedPartCount: gradedPartCountRef.current,
          },
        });
      }
      activeAttemptStopRef.current?.();
      retryControllerRef.current?.abort();
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let settled = false;
    let checkTimer: ReturnType<typeof setInterval> | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let deadlineTimer: ReturnType<typeof setTimeout> | null = null;
    let pollInFlight = false;
    let failAfterCurrentPoll = false;
    let isAppActive = AppState.currentState === "active";
    const controller = new AbortController();
    const signal = controller.signal;
    const startedAt = Date.now();

    gradedPartCountRef.current = 0;
    phaseRef.current = "polling";
    setProgress({ phase: "polling", gradedPartCount: 0 });

    const clearAttemptTimers = () => {
      if (checkTimer) {
        clearInterval(checkTimer);
        checkTimer = null;
      }
      if (deadlineTimer) {
        clearTimeout(deadlineTimer);
        deadlineTimer = null;
      }
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
    };

    const stopAttempt = () => {
      settled = true;
      controller.abort();
      clearAttemptTimers();
    };
    activeAttemptStopRef.current = stopAttempt;

    const complete = () => {
      if (settled) return;
      stopAttempt();
      updatePhase("completing");

      const advanceCheck = () => {
        if (!mountedRef.current) return;
        const nextCount = Math.min(
          GRADING_PART_COUNT,
          gradedPartCountRef.current + 1,
        );
        gradedPartCountRef.current = nextCount;
        setProgress({ phase: "completing", gradedPartCount: nextCount });

        completeTimerRef.current = setTimeout(() => {
          if (nextCount < GRADING_PART_COUNT) {
            advanceCheck();
            return;
          }
          if (!mountedRef.current || didNavigateRef.current) return;
          didNavigateRef.current = true;
          trackEvent({ name: "grading_completed" });
          onCompleteRef.current();
        }, nextCount < GRADING_PART_COUNT ? COMPLETE_STEP_INTERVAL_MS : COMPLETE_HOLD_MS);
      };

      advanceCheck();
    };

    const fail = (reason: "server-failed" | "timeout") => {
      if (settled) return;
      stopAttempt();
      if (attempt === 1 && !hasReportedTerminalErrorRef.current) {
        hasReportedTerminalErrorRef.current = true;
        reportOperationalError({
          code: "EXAM_GRADING_FAILED",
          stage: "polling",
          reason,
          attempt: "retry",
        });
      }
      // 첫 시도가 3분을 넘겨 재요청 안내로 넘어간 순간. 얼마나 흔한지가 대기 UI
      // 문구와 타임아웃 값을 조정할 근거다. 서버가 곧바로 FAILED를 준 경우는
      // 대기 초과가 아니므로 섞지 않는다.
      if (attempt === 0 && reason === "timeout") {
        trackEvent({ name: "grading_wait_exceeded" });
      }
      updatePhase(attempt === 0 ? "retry-ready" : "terminal-error");
    };

    const syncTimedChecks = () => {
      if (settled) return;
      const nextCount = Math.min(
        TIMED_PART_COUNT,
        Math.floor((Date.now() - startedAt) / PART_INTERVAL_MS),
      );
      if (nextCount === gradedPartCountRef.current) return;
      gradedPartCountRef.current = nextCount;
      setProgress({ phase: "polling", gradedPartCount: nextCount });
    };

    const scheduleTimedChecks = () => {
      if (settled || !isAppActive || checkTimer) return;
      checkTimer = setInterval(syncTimedChecks, PART_INTERVAL_MS);
    };

    let poll: (failIfPending?: boolean) => Promise<void>;

    const scheduleDeadline = () => {
      if (settled || !isAppActive) return;
      if (deadlineTimer) clearTimeout(deadlineTimer);

      const remainingMs = Math.max(
        0,
        ATTEMPT_TIMEOUT_MS - (Date.now() - startedAt),
      );
      deadlineTimer = setTimeout(() => {
        deadlineTimer = null;
        // timeout 시점에도 서버 완료가 먼저인지 최종 확인한 뒤 실패 처리한다.
        void poll(true);
      }, remainingMs);
    };

    const scheduleNextPoll = () => {
      if (settled || !isAppActive) return;
      if (pollTimer) clearTimeout(pollTimer);
      pollTimer = setTimeout(() => {
        pollTimer = null;
        void poll();
      }, POLL_INTERVAL_MS);
    };

    poll = async (failIfPending = false) => {
      if (failIfPending) failAfterCurrentPoll = true;
      if (settled || !isAppActive || pollInFlight) return;

      pollInFlight = true;
      let overallStatus: ExamGradingLifecycleStatus | null = null;
      try {
        const status = await getExamGradingStatus(examId, signal);
        overallStatus = status.overallStatus;
      } catch {
        // 복귀 직후 요청도 일시적으로 실패할 수 있다. 아래 timeout 정책에서 처리한다.
      } finally {
        pollInFlight = false;
      }

      if (signal.aborted || settled || !isAppActive) return;
      if (overallStatus === "COMPLETED") {
        complete();
        return;
      }
      if (overallStatus === "FAILED") {
        fail("server-failed");
        return;
      }

      const attemptExpired = Date.now() - startedAt >= ATTEMPT_TIMEOUT_MS;
      if (failAfterCurrentPoll || attemptExpired) {
        failAfterCurrentPoll = false;
        fail("timeout");
        return;
      }

      failAfterCurrentPoll = false;
      scheduleNextPoll();
      scheduleDeadline();
    };

    scheduleTimedChecks();
    scheduleDeadline();
    void poll();

    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        isAppActive = false;
        clearAttemptTimers();
        return;
      }

      isAppActive = true;
      syncTimedChecks();
      scheduleTimedChecks();
      // 3분이 지났어도 timeout보다 완료 상태 확인을 반드시 먼저 수행한다.
      void poll(Date.now() - startedAt >= ATTEMPT_TIMEOUT_MS);
    });

    return () => {
      appStateSubscription.remove();
      stopAttempt();
      if (activeAttemptStopRef.current === stopAttempt) {
        activeAttemptStopRef.current = null;
      }
    };
  }, [attempt, examId, updatePhase]);

  const retry = useCallback(() => {
    if (retryLockedRef.current || phaseRef.current !== "retry-ready") return;
    retryLockedRef.current = true;
    trackEvent({ name: "grading_retry_requested" });
    activeAttemptStopRef.current?.();
    gradedPartCountRef.current = 0;
    phaseRef.current = "retry-requesting";
    setProgress({ phase: "retry-requesting", gradedPartCount: 0 });

    const controller = new AbortController();
    retryControllerRef.current = controller;

    void retryExamGrading(examId, controller.signal)
      .then(() => {
        if (controller.signal.aborted || !mountedRef.current) return;
        setAttempt(1);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || !mountedRef.current) return;
        console.error("[GradingWait] 채점 재요청을 접수하지 못했어요", error);
        if (!hasReportedTerminalErrorRef.current) {
          hasReportedTerminalErrorRef.current = true;
          reportOperationalError({
            code: "EXAM_GRADING_FAILED",
            stage: "retry-request",
            reason: "request-failed",
            attempt: "retry",
            cause: error,
          });
        }
        updatePhase("terminal-error");
      })
      .finally(() => {
        if (retryControllerRef.current === controller) {
          retryControllerRef.current = null;
        }
      });
  }, [examId, updatePhase]);

  return { ...progress, retry };
}
