import { z } from 'zod';

import { AuthProtocolError, createAuthSession, type AuthSession } from '@/features/auth/types';
import { getIdentityApiBaseUrl } from '@/lib/api/service-base-url';
import { serviceFetch } from '@/lib/api/transport';

const mergeIdSchema = z.object({ mergeId: z.string().trim().min(1).nullish() });

export type GuestMergeResult = {
  /** 병합 대상 MEMBER의 세션. */
  session: AuthSession;
  /** 학습 기록 이전(UserMerged)을 조회하는 ID. 서버 추적이 꺼져 있으면 null이다. */
  mergeId: string | null;
};

/**
 * Guest 데이터를 이 Firebase 증명이 가리키는 기존 MEMBER로 합친다. 서버는 처리하는 순간 Guest를
 * MERGED로 바꾸므로 응답을 받지 못하면 성공 여부를 알 수 없다. 판별은 흐름(`guest-merge-flow.ts`)이 맡는다.
 * 성공은 계정 병합이 끝났다는 뜻이며 학습 기록 이전 완료를 뜻하지 않는다.
 */
export async function submitGuestMerge(
  firebaseIdToken: string,
  guestAccessToken: string,
  signal?: AbortSignal,
): Promise<GuestMergeResult> {
  const envelope = await serviceFetch<unknown>(
    `${getIdentityApiBaseUrl()}/api/v1/auth/firebase/guest/merge`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${guestAccessToken}` },
      body: JSON.stringify({ firebaseIdToken }),
      signal,
    },
  );
  const parsed = mergeIdSchema.safeParse(envelope.result);
  if (!parsed.success) throw new AuthProtocolError();
  return {
    session: createAuthSession(envelope.result),
    mergeId: parsed.data.mergeId ?? null,
  };
}
