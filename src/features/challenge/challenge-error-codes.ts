import { ApiError } from "@/lib/api/client";

/**
 * 명세 7절의 챌린지 오류 코드 중 앱이 흐름을 바꾸는 것들.
 *
 * 사용자 분기는 `message` 문자열이 아니라 이 `code`로 한다. 백엔드가 구현 시 이름을
 * 동결하기로 한 값이므로, 바뀌면 이 파일 한 곳만 고친다.
 */
export const CHALLENGE_ERROR_CODE = {
  /** 이미 응시가 끝난 문제 — 결과 화면으로 보낸다. */
  alreadyAttempted: "CHALLENGE_ALREADY_ATTEMPTED",
  /** 앞 문제가 아직 안 끝났다 — 오늘 진행도를 다시 읽어야 한다. */
  previousQuestionIncomplete: "CHALLENGE_PREVIOUS_QUESTION_INCOMPLETE",
  /** 서버 KST 날짜가 바뀌었다 — 캐시를 버리고 오늘 진행도를 다시 읽는다. */
  dateChanged: "CHALLENGE_DATE_CHANGED",
  dateClosed: "CHALLENGE_DATE_CLOSED",
  attemptNotFound: "CHALLENGE_ATTEMPT_NOT_FOUND",
  /** 제출 유효시간(5분)이 지났다. 서버는 이 attempt를 만료 terminal로 처리한다. */
  attemptExpired: "CHALLENGE_ATTEMPT_EXPIRED",
  /** S3에 파일이 없다 — 업로드 성공 여부를 확인하고 같은 키로 다시 통지한다. */
  audioNotUploaded: "CHALLENGE_AUDIO_NOT_UPLOADED",
  audioTooLarge: "CHALLENGE_AUDIO_TOO_LARGE",
  audioFormatUnsupported: "CHALLENGE_AUDIO_FORMAT_UNSUPPORTED",
} as const;

export type ChallengeErrorCode =
  (typeof CHALLENGE_ERROR_CODE)[keyof typeof CHALLENGE_ERROR_CODE];

export function getChallengeErrorCode(error: unknown): string | null {
  return error instanceof ApiError ? (error.code ?? null) : null;
}

/**
 * 이 문제를 더 진행할 수 없고 오늘 진행도부터 다시 읽어야 하는 오류인가.
 * 셋 다 원인은 다르지만 앱이 할 수 있는 일은 같다 — 캐시를 버리고 스테이지로 돌아간다.
 */
export function isProgressRefreshRequired(code: string | null): boolean {
  return (
    code === CHALLENGE_ERROR_CODE.dateChanged ||
    code === CHALLENGE_ERROR_CODE.dateClosed ||
    code === CHALLENGE_ERROR_CODE.previousQuestionIncomplete ||
    code === CHALLENGE_ERROR_CODE.attemptNotFound
  );
}

/**
 * 서버가 이 문제의 응시를 이미 끝난 것으로 보는 오류인가.
 *
 * 만료(410)도 여기 포함한다 — 명세상 만료된 attempt는 공개 `attemptStatus=submitted`로
 * projection되고 결과 화면에서 참고 답안을 볼 수 있다. 사용자에게는 "제출은 끝났다"가
 * 사실이므로 다시 녹음시키지 않고 결과로 보낸다.
 */
export function isAttemptAlreadyTerminal(code: string | null): boolean {
  return (
    code === CHALLENGE_ERROR_CODE.alreadyAttempted ||
    code === CHALLENGE_ERROR_CODE.attemptExpired
  );
}
