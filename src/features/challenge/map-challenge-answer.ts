import type {
  ChallengeAnswerAccepted,
  RawChallengeAnswerAccepted,
} from "@/types/challenge";

export function mapChallengeAnswerAccepted(
  raw: RawChallengeAnswerAccepted,
): ChallengeAnswerAccepted {
  return {
    attemptId: raw.attemptId,
    date: raw.challengeDate,
    questionNumber: raw.questionNumber,
    gradingStatus: raw.gradingStatus,
    referenceAnswer: raw.referenceAnswer.trim(),
    feedbackAvailable: raw.feedbackAvailable,
  };
}
