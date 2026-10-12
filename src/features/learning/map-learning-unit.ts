import type { z } from 'zod';
import type { learningUnitSchema } from '@/features/learning/learning-content-schema';
import type { LearningUnit } from '@/features/learning/learning-types';

export function mapLearningUnit(raw: z.infer<typeof learningUnitSchema>): LearningUnit {
  return {
    id: raw.id,
    part: raw.part,
    title: raw.title,
    thumbnail: raw.thumbnail,
    lessonIds: raw.lessons.map((l) => l.id),
    questionNumbers: raw.lessons.map((l) => l.questionNumber),
    completedLessonIds: raw.lessons.filter((l) => l.completed).map((l) => l.id),
  };
}
