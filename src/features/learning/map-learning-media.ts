import { z } from 'zod';

import type { LearningMedia } from '@/types/learning';

/** 사진·음성 공통 미디어. `url`은 1시간짜리 서명 주소라 S3에 앱 토큰을 보내지 않는다. */
export const learningMediaSchema = z.object({
  id: z.string(),
  url: z.string(),
  expiresAt: z.string(),
});

export function mapLearningMedia(raw: z.infer<typeof learningMediaSchema>): LearningMedia {
  return { id: raw.id, url: raw.url, expiresAtMs: Date.parse(raw.expiresAt) };
}
