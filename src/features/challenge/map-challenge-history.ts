import { z } from 'zod';

import type { ChallengeHistory } from '@/types/challenge';

/**
 * `GET /api/v1/challenges/history` 응답의 와이어 모양.
 *
 * `participated`를 선언하지 않는다 — `solvedQuestionCount > 0`과 같은 사실이라 두 값이
 * 어긋날 여지만 만든다. 선언하지 않은 키는 zod가 버린다.
 */
export const challengeHistorySchema = z.object({
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  dates: z.array(
    z.object({
      challengeDate: z.iso.date(),
      solvedQuestionCount: z.number().int().min(0),
    }),
  ),
});

export function mapChallengeHistory(raw: z.infer<typeof challengeHistorySchema>): ChallengeHistory {
  return {
    yearMonth: raw.yearMonth,
    days: raw.dates.map((day) => ({
      date: day.challengeDate,
      solvedQuestionCount: day.solvedQuestionCount,
    })),
  };
}
