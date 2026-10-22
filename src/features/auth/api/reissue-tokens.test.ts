import {
  isAccountInactiveFailure,
  isAccountWithdrawnFailure,
  isDefinitiveRefreshFailure,
  isSessionLoggedOutFailure,
} from '@/features/auth/api/reissue-tokens';
import { ApiError } from '@/lib/api/transport';

function apiError(status: number, code?: string): ApiError {
  return new ApiError(status, 'test', code);
}

describe('reissue 실패 분류', () => {
  it.each([
    ['INVALID_REFRESH_TOKEN'],
    ['REFRESH_TOKEN_EXPIRED'],
    ['REFRESH_TOKEN_REUSE_DETECTED'],
    ['SESSION_LOGGED_OUT'],
  ])('401 %s는 재발급을 다시 시도하지 않을 실패다', (code) => {
    expect(isDefinitiveRefreshFailure(apiError(401, code))).toBe(true);
  });

  it('같은 코드라도 401이 아니면 확정 실패로 보지 않는다', () => {
    expect(isDefinitiveRefreshFailure(apiError(500, 'SESSION_LOGGED_OUT'))).toBe(false);
  });

  it('ApiError가 아닌 오류는 어떤 분류에도 들지 않는다', () => {
    const error = new Error('network');
    expect(isDefinitiveRefreshFailure(error)).toBe(false);
    expect(isSessionLoggedOutFailure(error)).toBe(false);
    expect(isAccountInactiveFailure(error)).toBe(false);
    expect(isAccountWithdrawnFailure(error)).toBe(false);
  });

  it('비활성 계정은 상태 코드와 에러 코드 짝이 맞을 때만 해당한다', () => {
    expect(isAccountInactiveFailure(apiError(401, 'ACCOUNT_MERGED_TOKEN_REJECTED'))).toBe(true);
    expect(isAccountInactiveFailure(apiError(403, 'ACCOUNT_NOT_ACTIVE'))).toBe(true);
    expect(isAccountInactiveFailure(apiError(401, 'ACCOUNT_NOT_ACTIVE'))).toBe(false);
  });
});
