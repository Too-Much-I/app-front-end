import type { z } from 'zod';
import type { learningDetailSchema } from '@/features/learning/learning-content-schema';
import type { LearningUnitDetail } from '@/features/learning/learning-types';
import { mapLearningUnit } from '@/features/learning/map-learning-unit';

export function mapLearningDetail(raw: z.infer<typeof learningDetailSchema>): LearningUnitDetail {
  return {
    unit: mapLearningUnit(raw.unit),
    lessons: raw.lessons.map(({ answer, level, ...lesson }) => ({
      ...lesson,
      answers: { [level]: answer },
    })),
  };
}
