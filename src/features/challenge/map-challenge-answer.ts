import { z } from "zod";

import type { ChallengeAnswerAccepted } from "@/types/challenge";

/**
 * `POST .../answer` 접수 응답의 와이어 모양(명세 v1 §6.6).
 *
 * `referenceAnswer`는 AI 처리와 무관하게 즉시 오는 값이라 필수로 둔다. 이게 비면
 * 결과 화면이 제출 직후 보여줄 것이 없어지므로 조용히 넘기지 않고 경계에서 끊는다.
 */
export const challengeAnswerAcceptedSchema = z.object({
  attemptId: z.string(),
  challengeDate: z.string(),
  questionNumber: z.number().int(),
  gradingStatus: z.enum([
    "not_requested",
    "pending",
    "processing",
    "completed",
    "failed",
  ]),
  /** 접수 즉시 내려오는 참고 답안. AI 피드백을 기다리지 않고 보여줄 수 있다. */
  referenceAnswer: z.string(),
  feedbackAvailable: z.boolean(),
});

export function mapChallengeAnswerAccepted(
  raw: z.infer<typeof challengeAnswerAcceptedSchema>,
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
