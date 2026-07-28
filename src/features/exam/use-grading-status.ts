import { useEffect, useRef, useState } from "react";

import { getExamGradingStatus } from "@/features/exam/api/exam-grading-summary";

/** 채점표에 올라가는 파트 수. 토익 스피킹 정규 구성과 같다. */
export const GRADING_PART_COUNT = 5;

const TIMED_PART_COUNT = GRADING_PART_COUNT - 1;
const PART_INTERVAL_MS = 10_000;
const POLL_INTERVAL_MS = 3_000;
const ATTEMPT_TIMEOUT_MS = 180_000;
const COMPLETE_STEP_INTERVAL_MS = 180;
const COMPLETE_HOLD_MS = 600;

export type GradingStatus = "grading" | "completed" | "failed";

export interface GradingProgress {
  status: GradingStatus;
  /** 시간으로는 최대 4까지만 증가하고, 5는 서버 COMPLETED 뒤에만 가능하다. */
  gradedPartCount: number;
}

/**
 * 시험 단위 summary를 순차 polling하고 채점표에 표시할 단일 완료 개수를 만든다.
 *
 * 각 요청은 같은 시도의 AbortSignal을 캡처한다. 시도가 정리된 뒤 늦게 끝난 요청은
 * `signal.aborted`를 보고 결과를 적용하지 않는다.
 */
export function useGradingStatus(
  examId: string,
  onComplete: () => void,
): GradingProgress {
  const [progress, setProgress] = useState<GradingProgress>({
    status: "grading",
    gradedPartCount: 0,
  });
  const gradedPartCountRef = useRef(0);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didNavigateRef = useRef(false);
  const mountedRef = useRef(true);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let settled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();
    const signal = controller.signal;
    const startedAt = Date.now();

    const stopAttempt = () => {
      settled = true;
      controller.abort();
      clearInterval(checkTimer);
      clearTimeout(deadlineTimer);
      if (pollTimer) clearTimeout(pollTimer);
    };

    const complete = () => {
      if (settled) return;
      stopAttempt();
      setProgress((current) => ({ ...current, status: "completed" }));

      const advanceCheck = () => {
        if (!mountedRef.current) return;
        const nextCount = Math.min(
          GRADING_PART_COUNT,
          gradedPartCountRef.current + 1,
        );
        gradedPartCountRef.current = nextCount;
        setProgress({ status: "completed", gradedPartCount: nextCount });

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
      setProgress((current) => ({ ...current, status: "failed" }));
    };

    const syncTimedChecks = () => {
      if (settled) return;
      const nextCount = Math.min(
        TIMED_PART_COUNT,
        Math.floor((Date.now() - startedAt) / PART_INTERVAL_MS),
      );
      if (nextCount === gradedPartCountRef.current) return;
      gradedPartCountRef.current = nextCount;
      setProgress({ status: "grading", gradedPartCount: nextCount });
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
    return stopAttempt;
  }, [examId]);

  return progress;
}
