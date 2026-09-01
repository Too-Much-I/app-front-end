import type { AudioRecordingStatus } from "@/features/audio/use-timed-audio-recorder";
import { CHALLENGE_RECORDING_DURATION_SEC } from "@/features/challenge/use-challenge-recorder";

/**
 * 10초 챌린지 화면이 그리는 상태와 타이머 표기.
 *
 * 조회·발급·녹음·제출 네 갈래를 화면 상태 하나로 합치는 일이 여기 모여 있어서,
 * 어떤 조합이 어떤 화면으로 보이는지 이 파일만 보면 된다.
 */

/** 녹음 진행에 따라 화면이 직접 관리하는 단계. 문제 조회 상태는 훅이 따로 들고 있다. */
export type RecordingPhase =
  | "preparing"
  | "recording"
  | "reviewing"
  | "record-failed"
  | "permission-denied";

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

export function isChallengeStatusOnly(status: ChallengeUiStatus): status is ChallengeStatusOnly {
  return status !== "preparing" && status !== "recording" && status !== "reviewing";
}

/** 나가기 전에 확인을 받아야 하는 상태 — 녹음 중이거나 아직 제출하지 않은 녹음본이 있다. */
export function hasUnsavedChallengeRecording(status: ChallengeUiStatus): boolean {
  return status === "recording" || status === "reviewing" || status === "submit-failed";
}

/**
 * 업로드가 진행 중이라 화면을 벗어날 수 없는 상태.
 * 중간에 나가면 S3에 올라간 파일만 남고 서버는 접수를 모르는 상태가 된다.
 */
export function isChallengeSubmissionLocked(status: ChallengeUiStatus): boolean {
  return status === "submitting";
}

/**
 * 리코더 상태에서 녹음 단계를 읽는다.
 *
 * `finalizing`을 `recording`으로 두는 이유는 확정이 오가는 찰나에 화면이 깜빡이지 않게
 * 하려는 것이다. 확정이 성공하면 곧바로 `reviewing`으로, 실패하면 리코더가 `error`나
 * `interrupted`로 넘어가 `record-failed`가 된다.
 */
export function resolveRecordingPhase(
  status: AudioRecordingStatus,
  hasFinalizedRecording: boolean,
): RecordingPhase {
  if (hasFinalizedRecording) return "reviewing";

  switch (status) {
    case "permission-denied":
      return "permission-denied";
    case "error":
    case "interrupted":
      return "record-failed";
    case "recording":
    case "finalizing":
      return "recording";
    case "idle":
    case "preparing":
      return "preparing";
  }
}

/**
 * 조회·attempt 발급·녹음·제출 네 갈래를 화면 상태 하나로 합친다.
 *
 * 제출이 시작되면 그쪽이 화면을 독점한다 — 업로드 중에 노트나 녹음 버튼을 다시 보여줄
 * 이유가 없고, 그 사이 들어온 조회 실패로 진행 중인 제출을 가릴 수도 없다.
 */
export function resolveChallengeUiStatus({
  phase,
  questionStatus,
  attemptStatus,
  submissionStatus,
}: {
  phase: RecordingPhase;
  questionStatus: "loading" | "ready" | "failed";
  attemptStatus: "idle" | "creating" | "ready" | "failed";
  submissionStatus: "idle" | "submitting" | "failed";
}): ChallengeUiStatus {
  if (submissionStatus === "submitting") return "submitting";
  if (submissionStatus === "failed") return "submit-failed";
  if (questionStatus === "loading") return "loading";
  if (questionStatus === "failed") return "question-failed";
  /*
   * attempt 발급 실패도 사용자에게는 "화면을 준비하지 못했다"는 같은 사실이라 조회 실패와
   * 같은 화면을 쓴다. 다시 시도 버튼이 무엇을 다시 부를지는 화면이 정한다.
   *
   * 발급 중에는 `phase`가 아직 `preparing`이라 그대로 둔다 — 녹음은 발급이 끝난 뒤에
   * 시작하므로 그동안 보이는 "마이크를 준비하고 있어요"가 사실과 어긋나지 않는다.
   */
  if (attemptStatus === "failed") return "question-failed";
  return phase;
}

/**
 * 배지에 띄울 남은 시간.
 *
 * 녹음이 시작되기 전에는 recorder가 아직 0을 들고 있어서 제한 시간을 그대로 보여주고,
 * 확정된 뒤에는 셀 시간이 없으므로 배지 자체를 지운다.
 */
export function getChallengeRemainingSeconds(
  status: ChallengeUiStatus,
  remainingMs: number,
): number | null {
  if (status === "preparing") return CHALLENGE_RECORDING_DURATION_SEC;
  if (status === "recording") return remainingMs / 1_000;
  return null;
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
