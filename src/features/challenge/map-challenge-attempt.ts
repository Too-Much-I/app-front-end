import { z } from "zod";

import { toEpochMs } from "@/features/challenge/epoch-ms";
import type { ChallengeAttempt } from "@/types/challenge";

/**
 * `POST .../attempt` 응답의 와이어 모양(명세 v1 §6.3).
 *
 * 응답의 `attemptStatus`는 선언하지 않는다. 이 시점에는 언제나 `not_started`이고
 * 도메인 타입도 들고 있지 않다 — 읽지 않는 값이라 검증할 이유가 없다.
 */
export const challengeAttemptSchema = z.object({
  attemptId: z.string(),
  challengeDate: z.string(),
  questionNumber: z.number().int(),
  /**
   * attempt 생성 시각 + 1시간.
   *
   * 자정을 지나도 이때까지는 attempt가 속한 원래 `challengeDate`의 제출로 처리된다.
   * 앱이 녹음을 들어보고 다시 녹음하는 동안 날짜가 넘어가도 제출이 막히지 않는 근거다.
   */
  submissionDeadlineAt: z.string(),
});

export function mapChallengeAttempt(
  raw: z.infer<typeof challengeAttemptSchema>,
): ChallengeAttempt {
  return {
    attemptId: raw.attemptId,
    date: raw.challengeDate,
    questionNumber: raw.questionNumber,
    submissionDeadlineAtMs: toEpochMs(raw.submissionDeadlineAt),
  };
}
