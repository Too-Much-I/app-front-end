const MESSAGE_TYPE = "SUMMARY_FEEDBACK_RETRY_REQUESTED";

/** v2부터 앱이 인증된 summary polling과 timeout을 직접 소유한다. */
export const SUMMARY_FEEDBACK_RETRY_VERSION = 2;

export interface SummaryFeedbackRetryRequest {
  requestId: string;
  examId: string;
}

export type SummaryFeedbackRetryResponse =
  | { requestId: string; ok: true; status: "accepted" }
  | {
      requestId: string;
      ok: true;
      status: "completed";
      result: unknown;
    }
  | {
      requestId: string;
      ok: false;
      status: "failed";
      stage: "retry-request" | "retry-polling";
      reason: "request-failed" | "poll-failed" | "poll-timeout";
    };

/** 현재 열린 시험과 일치하는 종합 피드백 재생성 요청만 허용한다. */
export function parseSummaryFeedbackRetryRequest(
  rawMessage: string,
  currentExamId: string,
): SummaryFeedbackRetryRequest | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawMessage);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const { type, requestId, examId } = parsed as Record<string, unknown>;

  if (type !== MESSAGE_TYPE) return null;
  if (typeof requestId !== "string" || requestId.length === 0) return null;
  if (typeof examId !== "string" || examId.length === 0) return null;
  if (examId !== currentExamId) return null;

  return { requestId, examId };
}

/** JSON 문자열을 한 번 더 감싸 피드백 내용과 무관하게 안전한 주입 코드를 만든다. */
export function buildSummaryFeedbackRetryResponseScript(
  response: SummaryFeedbackRetryResponse,
): string {
  const serialized = JSON.stringify(JSON.stringify(response));
  return `window.__nativeSummaryFeedbackRetryBridge && window.__nativeSummaryFeedbackRetryBridge.deliver(${serialized}); true;`;
}
