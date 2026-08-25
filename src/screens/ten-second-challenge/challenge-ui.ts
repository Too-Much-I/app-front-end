/**
 * 10초 챌린지 문제 화면이 그리는 상태.
 *
 * 문제 조회(`useChallengeQuestion`)와 녹음(`useChallengeRecorder`)의 상태를 한 곳으로
 * 모은 값이라, 어떤 조합이 어떤 화면으로 보이는지 여기서만 보면 된다.
 */
export type ChallengeUiStatus =
  | "loading"
  | "question-failed"
  | "preparing"
  | "recording"
  | "reviewing"
  | "record-failed"
  | "permission-denied"
  | "submitting"
  | "submit-failed";

/** 노트 카드와 타이머를 함께 그리는 상태. */
export type ChallengeNoteStatus = Extract<
  ChallengeUiStatus,
  "preparing" | "recording" | "reviewing"
>;

/** 노트 카드 대신 안내 화면 한 장만 그리는 상태. */
export type ChallengeStatusOnly = Exclude<ChallengeUiStatus, ChallengeNoteStatus>;

export function isStatusOnly(status: ChallengeUiStatus): status is ChallengeStatusOnly {
  return status !== "preparing" && status !== "recording" && status !== "reviewing";
}

/** 나가기 전에 확인을 받아야 하는 상태 — 녹음 중이거나 아직 제출하지 않은 녹음본이 있다. */
export function hasUnsavedRecording(status: ChallengeUiStatus): boolean {
  return status === "recording" || status === "reviewing" || status === "submit-failed";
}

/**
 * 업로드가 진행 중이라 화면을 벗어날 수 없는 상태.
 * 중간에 나가면 S3에 올라간 파일만 남고 서버는 접수를 모르는 상태가 된다.
 */
export function isSubmissionLocked(status: ChallengeUiStatus): boolean {
  return status === "submitting";
}

/** 남은 시간이 이 값 아래로 내려가면 타이머를 경고색으로 바꾼다. */
export const CHALLENGE_URGENT_SECONDS = 3;

/** 타이머 배지와 노트 상단 바가 같은 순간에 함께 붉어지도록 판정을 한 곳에 둔다. */
export function isUrgentRemaining(remainingSeconds: number | null): boolean {
  return remainingSeconds !== null && remainingSeconds <= CHALLENGE_URGENT_SECONDS;
}

/**
 * 남은 시간을 `00:10` 표기로 바꾼다.
 *
 * 재답변의 `formatDuration`과 규칙이 같지만 가져다 쓰지 않는다 — 분 단위까지 가는
 * 재답변 녹음과 10초로 끝나는 챌린지는 표기를 함께 바꿀 이유가 없다.
 */
export function formatCountdown(seconds: number): string {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}
