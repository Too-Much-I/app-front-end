import { queryOptions } from '@tanstack/react-query';

import { getMyProfile } from '@/features/profile/api/get-my-profile';

/**
 * 한 번 받으면 다시 읽지 않는다.
 *
 * 닉네임을 바꾸는 API가 없어서 앱이 켜져 있는 동안 값이 바뀌지 않는다. 계정이 바뀌면
 * 인증 런타임이 쿼리 캐시를 통째로 비우므로(`auth-runtime.ts`의 `subscribeAccountChange`)
 * 다른 계정의 닉네임이 남지 않는다.
 */
export function myProfileQueryOptions() {
  return queryOptions({
    queryKey: ['profile', 'me'] as const,
    queryFn: ({ signal }) => getMyProfile(signal),
    staleTime: Infinity,
  });
}
