import { getIdentityApiBaseUrl } from '@/lib/api/service-base-url';
import { serviceFetch } from '@/lib/api/transport';

/**
 * 이 기기의 RefreshSession을 폐기한다(`/auth/logout`). 서버는 멱등으로 처리한다.
 * 같은 파일 이름의 `logout.ts`는 실제로 탈퇴(`/users/withdraw`)를 호출하므로 쓰지 않는다.
 */
export async function revokeRefreshSession(refreshToken: string): Promise<void> {
  await serviceFetch<unknown>(`${getIdentityApiBaseUrl()}/api/v1/auth/logout`, {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}
