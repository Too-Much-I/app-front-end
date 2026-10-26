import { z } from 'zod';

import type { LearningCapabilities } from '@/types/learning';

/** `GET /api/v1/learning/capabilities?lessonId=` 응답 `result`. */
export const learningCapabilitiesSchema = z.object({
  ready: z.boolean(),
  lessonIds: z.array(z.string()),
});

export function mapLearningCapabilities(
  raw: z.infer<typeof learningCapabilitiesSchema>,
): LearningCapabilities {
  return { ready: raw.ready, lessonIds: [...raw.lessonIds] };
}
