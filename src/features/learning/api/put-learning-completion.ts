import { z } from 'zod';
import { apiFetch } from '@/lib/api/client';
import type { ApiEnvelope } from '@/types/api';
import type { LearningLevel } from '@/features/learning/learning-types';

export type LearningCompletionInput = {
  lessonId: string;
  level: LearningLevel | 'common';
  contentVersion: string;
  submissionId?: string;
};
const completionResponse = z.object({
  lessonId: z.string(),
  level: z.enum(['common', 'IM3', 'IH', 'AL']),
  contentVersion: z.string(),
  completed: z.literal(true),
});
export async function putLearningCompletion({ lessonId, ...body }: LearningCompletionInput) {
  const { result } = await apiFetch<ApiEnvelope<unknown>>(
    `/api/v1/learning/lessons/${encodeURIComponent(lessonId)}/completion`,
    { method: 'PUT', body: JSON.stringify(body) },
  );
  const saved = completionResponse.parse(result);
  if (
    saved.lessonId !== lessonId ||
    saved.level !== body.level ||
    saved.contentVersion !== body.contentVersion
  )
    throw new Error('완료 기록이 일치하지 않습니다.');
  return saved;
}
