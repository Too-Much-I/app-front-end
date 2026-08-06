/**
 * 웹 종합 피드백 헤더의 뒤로가기가 보내는 메시지.
 *
 * 계약: `window.ReactNativeWebView.postMessage(JSON.stringify({
 *   type: "FEEDBACK_HISTORY_REQUESTED"
 * }))`.
 */
const MESSAGE_TYPE = "FEEDBACK_HISTORY_REQUESTED";

/** 계약에 맞지 않는 웹뷰 메시지는 현재 화면을 유지하도록 false를 돌려준다. */
export function isFeedbackHistoryRequestedMessage(rawMessage: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawMessage);
  } catch {
    return false;
  }

  if (typeof parsed !== "object" || parsed === null) return false;

  const { type } = parsed as Record<string, unknown>;
  return type === MESSAGE_TYPE;
}
