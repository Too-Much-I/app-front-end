import { getRawExamGradingSummary } from "@/features/exam/api/exam-grading-summary";
import { isRawExamSummaryComplete } from "@/features/exam/exam-summary-completeness";
import type { RawExamSummaryResult } from "@/types/exam";

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 3 * 60 * 1_000;

export type SummaryFeedbackPollingResult =
  | { status: "completed"; result: RawExamSummaryResult }
  | { status: "failed"; reason: "poll-failed" | "poll-timeout" | "cancelled" };

function waitForNextPoll(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(signal.reason);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolve();
    }, POLL_INTERVAL_MS);
    const handleAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

/** 재생성 접수 뒤 앱이 인증된 summary 조회와 3분 제한을 소유한다. */
export async function pollSummaryFeedbackUntilComplete(
  examId: string,
  signal: AbortSignal,
): Promise<SummaryFeedbackPollingResult> {
  const startedAt = Date.now();

  while (!signal.aborted) {
    if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
      return { status: "failed", reason: "poll-timeout" };
    }

    try {
      await waitForNextPoll(signal);
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        return { status: "failed", reason: "poll-timeout" };
      }
      const result = await getRawExamGradingSummary(examId, signal);
      if (isRawExamSummaryComplete(result)) {
        return { status: "completed", result };
      }
    } catch {
      return {
        status: "failed",
        reason: signal.aborted ? "cancelled" : "poll-failed",
      };
    }
  }

  return { status: "failed", reason: "cancelled" };
}
