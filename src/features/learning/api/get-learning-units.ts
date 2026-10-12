import { apiFetchWithAuthRetry } from '@/lib/api/client';
import type { ApiEnvelope } from '@/types/api';
import { learningCatalogSchema } from '@/features/learning/learning-content-schema';
import { mapLearningUnit } from '@/features/learning/map-learning-unit';
import type { LearningLevel } from '@/features/learning/learning-types';

export async function getLearningUnits(part: number, level: LearningLevel, signal?: AbortSignal) {
  const selectedLevel = part === 1 ? 'common' : level;
  const { result } = await apiFetchWithAuthRetry<ApiEnvelope<unknown>>(
    `/api/v1/learning/units?part=${part}&level=${selectedLevel}`,
    { signal },
  );
  const catalog = learningCatalogSchema.parse(result);
  if (catalog.part !== part || catalog.level !== selectedLevel)
    throw new Error('학습 목록이 일치하지 않습니다.');
  return catalog.units.map(mapLearningUnit);
}
