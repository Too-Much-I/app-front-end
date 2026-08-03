/**
 * 웹 문제별 피드백이 보내는 재답변 요청 메시지.
 *
 * 계약은 web-front-end의 `QuestionFeedbackScreen.requestReanswer`가 정한다.
 * `nextRetryCount`는 서버의 `totalRetryCount`를 그대로 넘긴 값이며 0-base 회차 인덱스다 —
 * 앱은 이 값을 다시 계산하지 않고 업로드·폴링·복귀 주소에 그대로 쓴다.
 */
export interface ReanswerRequest {
  examId: string;
  questionNumber: number;
  nextRetryCount: number;
}

const MESSAGE_TYPE = "REANSWER_REQUESTED";

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * 웹뷰 메시지를 재답변 요청으로 해석한다. 계약에 맞지 않으면 null을 돌려주고,
 * 호출부는 화면을 그대로 둔다 — 지원하지 않는 메시지에 오류 화면을 띄우지 않는다.
 *
 * `currentExamId`와 다른 시험의 요청도 거른다. 웹뷰가 다른 시험 페이지로 이동한 뒤
 * 도착한 늦은 메시지로 엉뚱한 답변을 덮어쓰지 않기 위해서다.
 */
export function parseReanswerRequest(
  rawMessage: string,
  currentExamId: string,
): ReanswerRequest | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawMessage);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;

  const { type, examId, questionNumber, nextRetryCount } = parsed as Record<
    string,
    unknown
  >;

  if (type !== MESSAGE_TYPE) return null;
  if (typeof examId !== "string" || examId.length === 0) return null;
  if (examId !== currentExamId) return null;
  if (!isPositiveInteger(questionNumber)) return null;
  if (!isNonNegativeInteger(nextRetryCount)) return null;

  return { examId, questionNumber, nextRetryCount };
}
