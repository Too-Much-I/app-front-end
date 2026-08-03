/**
 * 재답변 화면이 그리는 상태.
 *
 * 녹음(`useAnswerRecorder`)과 제출(`useReanswerSubmission`)의 상태를 화면 한 곳으로
 * 모은 값이라, 어떤 조합이 어떤 화면으로 보이는지 여기서만 보면 된다.
 */
export type ReanswerUiStatus =
  | "loading"
  | "question-failed"
  | "idle"
  | "recording"
  | "reviewing"
  | "record-failed"
  | "permission-denied"
  | "submitting"
  | "grading"
  | "submit-failed"
  | "grading-failed";

/** 문제 카드와 녹음 패널을 함께 그리는 상태. */
export type ReanswerRecordStatus = Extract<
  ReanswerUiStatus,
  "idle" | "recording" | "reviewing"
>;

/** 문제 카드 대신 안내 화면 한 장만 그리는 상태. */
export type ReanswerStatusOnly = Exclude<ReanswerUiStatus, ReanswerRecordStatus>;

export function isStatusOnly(status: ReanswerUiStatus): status is ReanswerStatusOnly {
  return status !== "idle" && status !== "recording" && status !== "reviewing";
}

/** 나가기를 막고 확인을 받아야 하는 상태 — 녹음 중이거나 제출하지 않은 녹음본이 있다. */
export function hasUnsavedRecording(status: ReanswerUiStatus): boolean {
  return status === "recording" || status === "reviewing";
}

/** 제출이 진행 중이라 화면을 벗어날 수 없는 상태. */
export function isSubmissionLocked(status: ReanswerUiStatus): boolean {
  return status === "submitting" || status === "grading";
}

/**
 * 회차 인덱스(0-base)를 사람이 읽는 표기로 바꾼다.
 * 웹 문제별 피드백의 회차 칩과 같은 규칙이라 두 화면의 "2차"가 같은 회차를 가리킨다.
 */
export function formatRetryLabel(retryCount: number): string {
  return `${retryCount + 1}차 답변`;
}

export function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}
