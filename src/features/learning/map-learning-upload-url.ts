import { z } from 'zod';

import type { LearningUploadUrl } from '@/types/learning';

/** `POST /api/v1/learning/submissions/{id}/upload-url` 응답 `result`. `submissionId`는 보낸 값이라 읽지 않는다. */
export const learningUploadUrlSchema = z.object({
  url: z.string(),
  expiresAt: z.iso.datetime({ offset: true }),
  maxBytes: z.number().int().positive(),
});

export function mapLearningUploadUrl(
  raw: z.infer<typeof learningUploadUrlSchema>,
): LearningUploadUrl {
  return { url: raw.url, expiresAtMs: Date.parse(raw.expiresAt), maxBytes: raw.maxBytes };
}
