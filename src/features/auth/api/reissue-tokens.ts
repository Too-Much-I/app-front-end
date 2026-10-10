import { createAuthSession, type AuthSession } from '@/features/auth/types';
import { getIdentityApiBaseUrl } from '@/lib/api/service-base-url';
import { ApiError, serviceFetch } from '@/lib/api/transport';

const DEFINITIVE_REFRESH_CODES = new Set([
  'INVALID_REFRESH_TOKEN',
  'REFRESH_TOKEN_EXPIRED',
  'REFRESH_TOKEN_REUSE_DETECTED',
  'SESSION_LOGGED_OUT',
]);

export async function reissueTokens(refreshToken: string): Promise<AuthSession> {
  const response = await serviceFetch<unknown>(`${getIdentityApiBaseUrl()}/api/v1/auth/reissue`, {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
  return createAuthSession(response.result);
}

/**
 * 계정이 더 이상 이 세션으로 쓸 수 없다. 병합된 옛 Guest 토큰(401 ACCOUNT_MERGED_TOKEN_REJECTED)과
 * 비활성 계정(403 ACCOUNT_NOT_ACTIVE: 병합된 Guest와 정지 MEMBER를 구분할 수 없다)이다.
 * 재발급을 반복하지 않고 세션을 지운 뒤 다시 로그인하게 한다.
 */
export function isAccountInactiveFailure(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    ((error.status === 401 && error.code === 'ACCOUNT_MERGED_TOKEN_REJECTED') ||
      (error.status === 403 && error.code === 'ACCOUNT_NOT_ACTIVE'))
  );
}

/**
 * 계정이 탈퇴됐다(401 ACCOUNT_WITHDRAWN). reissue와 `/users/me`가 준다. 다른 기기에서 탈퇴했거나 이 기기의 탈퇴
 * 응답을 놓친 경우다. 재발급을 반복하지 않고 세션을 지운 뒤 알린다.
 */
export function isAccountWithdrawnFailure(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401 && error.code === 'ACCOUNT_WITHDRAWN';
}

/**
 * 서버가 세션을 무효화했다(401 SESSION_LOGGED_OUT: 세션·epoch·인증 시각 무효화). 재발급해도 같은 답이므로
 * 재발급 없이 세션을 지우고 로그인으로 보낸다. 업데이트 전 발급된 토큰이 이 코드로 거절돼 복원이 멈춘 사고 대응.
 */
export function isSessionLoggedOutFailure(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401 && error.code === 'SESSION_LOGGED_OUT';
}

export function isDefinitiveRefreshFailure(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 401 &&
    Boolean(error.code) &&
    DEFINITIVE_REFRESH_CODES.has(error.code ?? '')
  );
}
