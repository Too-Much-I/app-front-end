/**
 * 웹 피드백 화면(app-exam-screen, app-question-feedback)이 데이터 로딩을 마치고
 * 실제 화면을 그리기 시작했을 때 보내는 메시지.
 *
 * 계약: `window.ReactNativeWebView.postMessage(JSON.stringify({ type: "FEEDBACK_DATA_READY" }))`.
 * 추가 필드는 없다.
 */
const MESSAGE_TYPE = "FEEDBACK_DATA_READY";

/**
 * 웹뷰 메시지가 데이터 준비 완료 신호인지 판별한다. 계약에 맞지 않으면 false를 돌려주고,
 * 호출부는 화면을 그대로 둔다.
 */
export function isFeedbackDataReadyMessage(rawMessage: string): boolean {
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
