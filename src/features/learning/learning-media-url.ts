import { getLearningMediaUrl } from '@/features/learning/api/learning-api';
import type { LearningMedia } from '@/types/learning';

/**
 * 만료 직전 주소도 새로 받는다. 재생을 시작한 뒤 내려받는 동안 만료되면 중간에 끊길 수 있다.
 * 문장 음성은 몇 초라 1분이면 충분하다.
 */
const EXPIRY_MARGIN_MS = 60_000;

/** 미디어 ID별로 새로 받은 주소. 상세 캐시의 원래 주소는 그대로 두고 여기서 덮는다. */
const refreshedMedia = new Map<string, LearningMedia>();

export function isLearningMediaUsable(media: LearningMedia, nowMs: number): boolean {
  return Number.isFinite(media.expiresAtMs) && media.expiresAtMs - nowMs > EXPIRY_MARGIN_MS;
}

/**
 * 재생 직전에 쓸 주소를 고른다(2026-10-23 결정). 만료 시각이 지났거나 곧 지나면 서버에서 새로 받는다.
 */
export async function resolveLearningMediaUrl(
  media: LearningMedia,
  nowMs = Date.now(),
): Promise<string> {
  const latest = refreshedMedia.get(media.id) ?? media;
  if (isLearningMediaUsable(latest, nowMs)) return latest.url;

  const fresh = await getLearningMediaUrl(media.id);
  refreshedMedia.set(media.id, fresh);
  return fresh.url;
}
