import { z } from "zod";

import type { ChallengeToday } from "@/types/challenge";

/**
 * `GET /api/v1/challenges/today` 응답의 와이어 모양.
 *
 * 손으로 쓴 `RawChallengeToday` 인터페이스를 대신한다. 인터페이스는 컴파일 때 사라져
 * 런타임에 아무것도 확인하지 못했고, 선언과 검증 코드가 따로 있어 어긋나도 아무도
 * 몰랐다. 스키마는 그 둘을 한 문장으로 만든다.
 *
 * 명세 v1 §6.1의 `challengeDateExpiresAt`을 선언하지 않은 것은 의도다. 앱은 기기 시계와
 * 절대 시각을 비교하지 않고 `expiresInSeconds`로 타이머를 걸며, 선언하지 않은 키는
 * zod가 버린다.
 */
export const challengeTodaySchema = z.object({
  /**
   * KST 기준 `YYYY-MM-DD`. 형식을 검증하는 이유는 이 값이 이후 요청의
   * `X-Challenge-Date` 헤더가 되기 때문이다 — 깨진 값을 그대로 보내면 서버가
   * 날짜 불일치로 거절하고, 앱은 원인을 모른 채 진행도만 다시 읽는다.
   */
  challengeDate: z.iso.date(),
  expiresInSeconds: z.number(),
  dailyStatus: z.enum(["not_started", "in_progress", "completed"]),
  totalQuestionCount: z.number().int(),
  /** 모두 끝났으면 `null`. 앱이 순서를 계산하지 않는 근거라 없어지면 안 된다. */
  nextQuestionNumber: z.number().int().nullable(),
  completedQuestionNumbers: z.array(z.number().int()),
  questions: z.array(
    z.object({
      questionNumber: z.number().int(),
      attemptStatus: z.enum(["not_started", "submitted"]),
      gradingStatus: z.enum([
        "not_requested",
        "pending",
        "processing",
        "completed",
        "failed",
      ]),
      resultAvailable: z.boolean(),
    }),
  ),
});

/** 오늘 진행도. 스테이지 화면과, 진입 날짜를 모르는 문제 화면이 함께 쓴다. */
export function mapChallengeToday(
  raw: z.infer<typeof challengeTodaySchema>,
): ChallengeToday {
  return {
    date: raw.challengeDate,
    expiresInSeconds: raw.expiresInSeconds,
    dailyStatus: raw.dailyStatus,
    totalQuestionCount: raw.totalQuestionCount,
    nextQuestionNumber: raw.nextQuestionNumber,
    completedQuestionNumbers: [...raw.completedQuestionNumbers],
    questions: raw.questions.map((question) => ({ ...question })),
  };
}
