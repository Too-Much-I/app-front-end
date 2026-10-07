import { getIdentityApiBaseUrl } from '@/lib/api/service-base-url';
import { serviceFetch } from '@/lib/api/transport';

/**
 * 회원 탈퇴(`/users/withdraw`). 200이면 `cleanupStatus`와 관계없이 탈퇴가 확정이다. 서버 정리(Firebase User 삭제 등)는
 * 뒤에서 이어진다. 이미 탈퇴한 계정이면 다시 보내도 200이다(2026-10-07 서버 답).
 *
 * `Authorization`의 access token과 body의 refresh token은 **같은 세션에서** 꺼내야 한다. 회전 직후 낡은 access
 * token과 새 refresh token을 섞어 보내면 서버가 짝이 맞지 않는 요청으로 거절한다.
 *
 * `firebaseIdToken`은 회원의 지금 Firebase 토큰이다. 서버와 합의해 `auth_time`(최근 재인증)을 검사하지 않는다.
 * Guest는 보내지 않는다.
 */
export async function withdrawAccount(input: {
  accessToken: string;
  refreshToken: string;
  firebaseIdToken?: string;
}): Promise<void> {
  await serviceFetch<unknown>(`${getIdentityApiBaseUrl()}/api/v1/users/withdraw`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${input.accessToken}` },
    body: JSON.stringify({
      refreshToken: input.refreshToken,
      firebaseIdToken: input.firebaseIdToken,
    }),
  });
}
