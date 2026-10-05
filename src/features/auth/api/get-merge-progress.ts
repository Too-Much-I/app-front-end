import { z } from 'zod';

import { AuthProtocolError } from '@/features/auth/types';
import { getIdentityApiBaseUrl } from '@/lib/api/service-base-url';
import { serviceFetch } from '@/lib/api/transport';

const mergeProgressSchema = z.object({
  status: z.enum(['PROCESSING', 'ACTION_REQUIRED', 'COMPLETED']),
  nextPollAfterSeconds: z.number().int().nonnegative().nullish(),
});

/** 학습 기록 이전 진행 상태. COMPLETED는 필수 consumer가 기록을 옮겼다는 뜻이다. */
export type MergeProgress = {
  status: z.infer<typeof mergeProgressSchema>['status'];
  /** 서버가 정한 다음 조회 간격. 주지 않으면 null이다. */
  nextPollAfterMs: number | null;
};

export async function getMergeProgress(
  mergeId: string,
  memberAccessToken: string,
  signal?: AbortSignal,
): Promise<MergeProgress> {
  const envelope = await serviceFetch<unknown>(
    `${getIdentityApiBaseUrl()}/api/v1/users/me/merges/${encodeURIComponent(mergeId)}`,
    {
      headers: { Authorization: `Bearer ${memberAccessToken}` },
      signal,
    },
  );
  const parsed = mergeProgressSchema.safeParse(envelope.result);
  if (!parsed.success) throw new AuthProtocolError();
  const seconds = parsed.data.nextPollAfterSeconds;
  return {
    status: parsed.data.status,
    nextPollAfterMs: seconds === null || seconds === undefined ? null : seconds * 1000,
  };
}
