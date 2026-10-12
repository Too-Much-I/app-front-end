import { apiFetchWithAuthRetry } from '@/lib/api/client';
import type { ApiEnvelope } from '@/types/api';
import { learningMediaSchema } from '@/features/learning/learning-content-schema';
import type { LearningMedia } from '@/features/learning/learning-types';

/** Keep signed URLs out of persistent storage; refresh only when needed. */
export async function resolveLearningMedia(
  media: LearningMedia,
  signal: AbortSignal,
  force = false,
) {
  if (!force && Date.parse(media.expiresAt) > Date.now() + 60_000) return media.url;
  const { result } = await apiFetchWithAuthRetry<ApiEnvelope<unknown>>(
    `/api/v1/learning/media/${encodeURIComponent(media.id)}/url`,
    { signal },
  );
  const fresh = learningMediaSchema.parse(result);
  if (fresh.id !== media.id || Date.parse(fresh.expiresAt) <= Date.now())
    throw new Error('미디어 주소를 갱신하지 못했어요.');
  return fresh.url;
}
