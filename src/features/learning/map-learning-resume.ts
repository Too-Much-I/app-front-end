import { z } from 'zod';

import { learningPartSchema } from '@/features/learning/map-learning-unit';
import type { LearningResume } from '@/types/learning';

/**
 * `GET /api/v1/learning/resume?level=` 응답 `result`의 와이어 모양(`LearningRecentResume`, 2026-10-27 확인).
 *
 * `part`를 함께 보내면 오는 옛 모양(`unitId`·`allCompleted`)은 부르지 않으므로 받지 않는다. `level`은 보낸 값이고
 * `questionNumber`는 카드에 쓰지 않아 선언하지 않았다.
 */
export const learningResumeSchema = z.object({
  status: z.enum(['READY', 'NO_HISTORY', 'END_OF_PART']),
  part: learningPartSchema,
  unitId: z.string(),
  unitNumber: z.number().int(),
  lessonId: z.string(),
  lessonNumber: z.number().int(),
});

export function mapLearningResume(raw: z.infer<typeof learningResumeSchema>): LearningResume {
  return {
    status: raw.status,
    part: raw.part,
    unitId: raw.unitId,
    unitNumber: raw.unitNumber,
    lessonId: raw.lessonId,
    lessonNumber: raw.lessonNumber,
  };
}
