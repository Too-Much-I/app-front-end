import { z } from 'zod';

import type { LearningGradeResult } from '@/types/learning';

/**
 * `GET /api/v1/learning/submissions/{id}` 응답에서 `status: "completed"`일 때의 `result`.
 *
 * `probability`·`checklistVersion`은 화면에 쓰지 않아 선언하지 않았다.
 * `transcript`는 로그·분석 이벤트에 남기지 않는다(Swagger 설명).
 */
export const learningGradeSchema = z.object({
  transcript: z.string(),
  metCount: z.number().int(),
  totalCount: z.number().int(),
  items: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      verdict: z.enum(['met', 'not_met', 'uncertain']),
      feedback: z.string(),
    }),
  ),
});

export function mapLearningGrade(raw: z.infer<typeof learningGradeSchema>): LearningGradeResult {
  return {
    transcript: raw.transcript,
    metCount: raw.metCount,
    totalCount: raw.totalCount,
    items: raw.items.map((item) => ({
      id: item.id,
      label: item.label,
      verdict: item.verdict,
      feedback: item.feedback,
    })),
  };
}
