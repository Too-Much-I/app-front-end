import { z } from 'zod';

import type { LearningPart } from '@/features/learning/learning-level';
import type { LearningUnitSummary } from '@/types/learning';

export const learningPartSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]) satisfies z.ZodType<LearningPart>;

export const learningUnitSchema = z.object({
  id: z.string(),
  part: learningPartSchema,
  title: z.string(),
  lessons: z.array(
    z.object({
      id: z.string(),
      questionNumber: z.number().int(),
      completed: z.boolean(),
    }),
  ),
});

/**
 * `GET /api/v1/learning/units?part=&level=` 응답 `result`의 와이어 모양.
 *
 * 파트·등급별 카드 전체가 온다(최대 100개, 페이지네이션 없음). `thumbnail`은 화면에 쓰지 않아 선언하지 않았다.
 */
export const learningUnitsSchema = z.object({
  units: z.array(learningUnitSchema),
});

export function mapLearningUnit(raw: z.infer<typeof learningUnitSchema>): LearningUnitSummary {
  return {
    id: raw.id,
    part: raw.part,
    title: raw.title,
    lessons: raw.lessons.map((lesson) => ({
      id: lesson.id,
      questionNumber: lesson.questionNumber,
      completed: lesson.completed,
    })),
  };
}
