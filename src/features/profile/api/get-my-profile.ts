import { mapMyProfile, myProfileSchema } from '@/features/profile/map-my-profile';
import { identityFetchWithAuthRetry } from '@/lib/api/client';
import { parseApiResult } from '@/lib/api/parse-api-result';
import type { ApiEnvelope } from '@/types/api';
import type { MyProfile } from '@/types/profile';

/** 내 프로필. 세션 복구의 `getCurrentAccount`와 같은 API지만 세션 상태를 건드리지 않는다. */
export async function getMyProfile(signal?: AbortSignal): Promise<MyProfile> {
  const { result } = await identityFetchWithAuthRetry<ApiEnvelope<unknown>>('/api/v1/users/me', {
    signal,
  });
  return mapMyProfile(parseApiResult(myProfileSchema, result, 'MY_PROFILE'));
}
