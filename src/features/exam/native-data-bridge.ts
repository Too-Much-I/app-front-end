import { getRawExamGradingSummary } from "@/features/exam/api/exam-grading-summary";
import { getRawExamQuestionFeedback } from "@/features/exam/api/exam-question-feedback";

/**
 * 웹 피드백 화면이 데이터를 요청할 때 쓰는 메시지.
 *
 * 웹에 액세스 토큰을 넘기지 않기 위해, 인증이 필요한 조회는 전부 네이티브가 대신한다.
 * 웹은 "무엇이 필요한지"만 말하고 경로나 헤더를 만들지 않는다.
 *
 * 계약: `window.ReactNativeWebView.postMessage(JSON.stringify({
 *   type: "NATIVE_DATA_REQUEST", requestId, resource, params }))`.
 */
const REQUEST_TYPE = "NATIVE_DATA_REQUEST";
const FEEDBACK_BRIDGE_VERSION = 1;

const FALLBACK_ERROR_MESSAGE = "데이터를 불러오지 못했어요.";

export type NativeDataRequest =
  | { requestId: string; resource: "EXAM_SUMMARY"; examId: string }
  | {
      requestId: string;
      resource: "QUESTION_FEEDBACK";
      examId: string;
      questionNumber: number;
      retryCount: number;
    };

export type NativeDataResponse =
  | { requestId: string; ok: true; result: unknown }
  | { requestId: string; ok: false; message: string };

/**
 * 웹이 페이지 초기화 시점에 이 앱 버전의 데이터 브리지 지원 여부를 판별하게 한다.
 *
 * `window.ReactNativeWebView` 존재 여부만 보면 브리지가 없던 이전 앱도 네이티브로 오인한다.
 * 버전 1은 데이터 요청·응답·갱신과 피드백 이력 복귀를 포함한 피드백 WebView 통신 계약을
 * 뜻한다. 페이지 코드보다 먼저 실행해야 하므로 injectedJavaScriptBeforeContentLoaded에 쓴다.
 */
export function buildNativeCapabilitiesScript(): string {
  const capabilities = JSON.stringify({
    feedbackBridgeVersion: FEEDBACK_BRIDGE_VERSION,
    // 이름 변경 전 웹 배포가 데이터 요청을 계속 사용할 수 있게 하는 전환용 별칭이다.
    nativeDataRequestVersion: FEEDBACK_BRIDGE_VERSION,
  });
  return `window.__nativeCapabilities = ${capabilities}; true;`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * 웹뷰 메시지를 데이터 요청으로 해석한다. 계약에 맞지 않으면 null을 돌려준다.
 *
 * 임의 경로 프록시를 제공하지 않는 것이 이 함수의 핵심이다 — 알려진 resource 이름과
 * 검증된 파라미터로만 경로를 조립한다. 웹이 원하는 주소를 인증된 상태로 부르게 해 주면
 * 토큰을 웹에 넘기지 않아 얻은 이득이 사라진다.
 *
 * `currentExamId`와 다른 시험의 요청도 거른다(parseReanswerRequest와 같은 이유).
 */
export function parseNativeDataRequest(
  rawMessage: string,
  currentExamId: string,
): NativeDataRequest | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawMessage);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  if (parsed.type !== REQUEST_TYPE) return null;

  // 좁히기는 반드시 구조 분해 뒤에 한다 — parsed.params를 먼저 좁혀도
  // 구조 분해로 만든 새 바인딩은 다시 unknown이 된다.
  const { requestId, resource, params } = parsed;

  if (!isNonEmptyString(requestId)) return null;
  if (!isRecord(params)) return null;

  const { examId } = params;
  if (!isNonEmptyString(examId)) return null;
  if (examId !== currentExamId) return null;

  if (resource === "EXAM_SUMMARY") {
    return { requestId, resource, examId };
  }

  if (resource === "QUESTION_FEEDBACK") {
    const { questionNumber, retryCount } = params;
    if (!isPositiveInteger(questionNumber)) return null;
    if (!isNonNegativeInteger(retryCount)) return null;
    return { requestId, resource, examId, questionNumber, retryCount };
  }

  return null;
}

/** 요청된 리소스를 인증된 상태로 조회해 서버 원본 result를 돌려준다. */
export function resolveNativeDataRequest(
  request: NativeDataRequest,
): Promise<unknown> {
  switch (request.resource) {
    case "EXAM_SUMMARY":
      return getRawExamGradingSummary(request.examId);
    case "QUESTION_FEEDBACK":
      return getRawExamQuestionFeedback(
        request.examId,
        request.questionNumber,
        request.retryCount,
      );
  }
}

/**
 * 응답을 웹뷰에 주입할 JS 코드로 만든다.
 *
 * 페이로드를 객체 리터럴로 이어붙이지 않고 JS 문자열 리터럴로 심은 뒤 웹에서 파싱한다 —
 * 피드백 본문에 들어 있는 따옴표나 개행이 주입 코드를 깨뜨리지 않게 하기 위해서다.
 * 바깥 JSON.stringify가 안쪽 JSON 문자열을 안전한 리터럴로 감싼다.
 *
 * 끝의 `true;`는 iOS에서 주입 결과 평가 경고를 피하기 위한 관례다.
 */
export function buildNativeDataScript(payload: NativeDataResponse): string {
  const serialized = JSON.stringify(JSON.stringify(payload));
  return `window.__nativeDataBridge && window.__nativeDataBridge.deliver(${serialized}); true;`;
}

/**
 * 웹이 들고 있는 데이터를 버리고 다시 요청하게 만드는 신호.
 *
 * 데이터를 밀어 넣지 않고 "다시 물어보라"고만 하는 이유는, 지금 어느 회차를 보고 있는지는
 * 웹만 알기 때문이다(회차 칩이 웹 내부에서 `retryCount`를 바꾼다). 요청 파라미터를 웹이
 * 그대로 만들게 두면 네이티브는 웹 상태를 따라다닐 필요가 없고, 기존 요청/응답 계약도
 * 그대로 유지된다.
 *
 * `refresh`까지 확인하고 부르는 것은 이 신호를 아직 모르는 웹 배포를 위해서다. 앱이 웹보다
 * 먼저 배포되면 그 구간에서는 조용한 no-op이 된다.
 */
export function buildNativeDataRefreshScript(): string {
  return "window.__nativeDataBridge && window.__nativeDataBridge.refresh && window.__nativeDataBridge.refresh(); true;";
}

/** 조회 실패를 사용자에게 보여줄 수 있는 문구로 바꾼다. */
export function toNativeDataErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : FALLBACK_ERROR_MESSAGE;
}
