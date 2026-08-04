/**
 * 웹 에러 폴백 화면의 "홈으로 돌아가기" 버튼이 보내는 메시지.
 *
 * 계약: `window.ReactNativeWebView.postMessage(JSON.stringify({ type: "GO_HOME_REQUESTED" }))`.
 * 추가 필드는 없다. `/app-exam-screen`, `/app-question-feedback` 두 웹뷰 화면에서 공통으로 온다.
 */
const MESSAGE_TYPE = "GO_HOME_REQUESTED";

/**
 * 웹뷰 메시지가 홈 이동 요청인지 판별한다. 계약에 맞지 않으면 false를 돌려주고,
 * 호출부는 화면을 그대로 둔다 — 지원하지 않는 메시지에 오류 화면을 띄우지 않는다.
 */
export function isGoHomeRequestedMessage(rawMessage: string): boolean {
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
