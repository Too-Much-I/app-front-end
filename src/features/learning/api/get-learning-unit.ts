import { apiFetchWithAuthRetry } from '@/lib/api/client';
import type { ApiEnvelope } from '@/types/api';
import { learningDetailSchema } from '@/features/learning/learning-content-schema';
import { mapLearningDetail } from '@/features/learning/map-learning-detail';
import type { LearningLevel } from '@/features/learning/learning-types';

export async function getLearningUnit(id: string, level: LearningLevel, signal?: AbortSignal) {
  const { result } = await apiFetchWithAuthRetry<ApiEnvelope<unknown>>(
    `/api/v1/learning/units/${encodeURIComponent(id)}?level=${level}`,
    { signal },
  );
  const detail = learningDetailSchema.parse(result);
  if (
    detail.unit.id !== id ||
    detail.lessons.some((l) => l.level !== (l.part === 1 ? 'common' : level))
  )
    throw new Error('학습 문항 또는 답변 등급이 일치하지 않습니다.');
  return mapLearningDetail(detail);
}
