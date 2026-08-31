import { toEpochMs } from "@/features/challenge/epoch-ms";
import type { ChallengeAttempt, RawChallengeAttempt } from "@/types/challenge";

export function mapChallengeAttempt(raw: RawChallengeAttempt): ChallengeAttempt {
  return {
    attemptId: raw.attemptId,
    date: raw.challengeDate,
    questionNumber: raw.questionNumber,
    submissionDeadlineAtMs: toEpochMs(raw.submissionDeadlineAt),
  };
}
