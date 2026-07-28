import { useCallback, useEffect, useRef, useState } from "react";

import { retryExamGrading } from "@/features/exam/api/exam-grading-retry";
import { getExamGradingStatus } from "@/features/exam/api/exam-grading-summary";

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
 * 시험 단위 summary polling, 시도별 timeout과 사용자 재요청 lifecycle을 소유한다.
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

  const updatePhase = useCallback((phase: GradingWaitPhase) => {
    phaseRef.current = phase;
    setProgress((current) => ({ ...current, phase }));
  }, []);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeAttemptStopRef.current?.();
      retryControllerRef.current?.abort();
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let settled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();
    const signal = controller.signal;
    const startedAt = Date.now();

    gradedPartCountRef.current = 0;
    phaseRef.current = "polling";
    setProgress({ phase: "polling", gradedPartCount: 0 });

    const stopAttempt = () => {
      settled = true;
      controller.abort();
      clearInterval(checkTimer);
      clearTimeout(deadlineTimer);
      if (pollTimer) clearTimeout(pollTimer);
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
          onCompleteRef.current();
        }, nextCount < GRADING_PART_COUNT ? COMPLETE_STEP_INTERVAL_MS : COMPLETE_HOLD_MS);
      };

      advanceCheck();
    };

    const fail = () => {
      if (settled) return;
      stopAttempt();
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

    const checkTimer = setInterval(syncTimedChecks, PART_INTERVAL_MS);
    const deadlineTimer = setTimeout(fail, ATTEMPT_TIMEOUT_MS);

    const poll = async () => {
      if (settled) return;
      try {
        const status = await getExamGradingStatus(examId, signal);
        if (signal.aborted || settled) return;

        if (status.overallStatus === "COMPLETED") {
          complete();
          return;
        }
        if (status.overallStatus === "FAILED") {
          fail();
          return;
        }
      } catch {
        if (signal.aborted || settled) return;
      }

      pollTimer = setTimeout(() => {
        void poll();
      }, POLL_INTERVAL_MS);
    };

    void poll();
    return () => {
      stopAttempt();
      if (activeAttemptStopRef.current === stopAttempt) {
        activeAttemptStopRef.current = null;
      }
    };
  }, [attempt, examId, updatePhase]);

  const retry = useCallback(() => {
    if (retryLockedRef.current || phaseRef.current !== "retry-ready") return;
    retryLockedRef.current = true;
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
