import { createAuthenticatedApiClient } from '@/lib/api/authenticated-client';
import { ApiError, serviceFetch } from '@/lib/api/transport';

jest.mock('@/lib/api/service-base-url', () => ({
  getLearningApiBaseUrl: () => 'https://learning.test',
  getIdentityApiBaseUrl: () => 'https://identity.test',
  getBillingApiBaseUrl: () => 'https://billing.test',
}));
jest.mock('@/lib/api/transport', () => ({
  ...jest.requireActual('@/lib/api/transport'),
  serviceFetch: jest.fn(),
}));

const serviceFetchMock = jest.mocked(serviceFetch);

function createSession() {
  return {
    prepareRequest: jest.fn().mockResolvedValue({ accessToken: 'old', generation: 1 }),
    recoverUnauthorized: jest.fn().mockResolvedValue({ accessToken: 'new', generation: 2 }),
  };
}

function authorizationOf(call: number): unknown {
  const headers = serviceFetchMock.mock.calls[call]?.[1]?.headers as Record<string, string>;
  return headers.Authorization;
}

beforeEach(() => {
  serviceFetchMock.mockReset();
});

describe('읽기 요청의 401 복구', () => {
  it('401이면 세션을 복구하고 새 토큰으로 한 번 다시 보낸다', async () => {
    const session = createSession();
    serviceFetchMock
      .mockRejectedValueOnce(new ApiError(401, 'expired', 'ACCESS_TOKEN_EXPIRED'))
      .mockResolvedValueOnce({ isSuccess: true, code: 'OK', message: 'ok', result: 1 });
    const client = createAuthenticatedApiClient(session);

    await expect(client.apiFetchWithAuthRetry('/me')).resolves.toMatchObject({ result: 1 });

    // 처음 요청의 세대와 서버 코드를 넘겨야 동시에 실패한 요청끼리 재발급을 한 번만 한다.
    expect(session.recoverUnauthorized).toHaveBeenCalledWith(1, 'ACCESS_TOKEN_EXPIRED');
    expect(authorizationOf(0)).toBe('Bearer old');
    expect(authorizationOf(1)).toBe('Bearer new');
    expect(serviceFetchMock.mock.calls[1]?.[0]).toBe('https://learning.test/me');
  });

  it('다시 보낸 요청도 401이면 더 반복하지 않고 던진다', async () => {
    const session = createSession();
    const second = new ApiError(401, 'again');
    serviceFetchMock
      .mockRejectedValueOnce(new ApiError(401, 'first'))
      .mockRejectedValueOnce(second);
    const client = createAuthenticatedApiClient(session);

    await expect(client.identityFetchWithAuthRetry('/users/me')).rejects.toBe(second);
    expect(session.recoverUnauthorized).toHaveBeenCalledTimes(1);
    expect(serviceFetchMock).toHaveBeenCalledTimes(2);
  });

  it('401이 아닌 오류는 복구하지 않는다', async () => {
    const session = createSession();
    serviceFetchMock.mockRejectedValueOnce(new ApiError(500, 'server'));
    const client = createAuthenticatedApiClient(session);

    await expect(client.billingFetchWithAuthRetry('/entitlements')).rejects.toMatchObject({
      status: 500,
    });
    expect(session.recoverUnauthorized).not.toHaveBeenCalled();
  });
});

describe('쓰기 요청', () => {
  it('apiFetch는 401이어도 다시 보내지 않는다', async () => {
    const session = createSession();
    serviceFetchMock.mockRejectedValueOnce(new ApiError(401, 'expired'));
    const client = createAuthenticatedApiClient(session);

    await expect(client.apiFetch('/exams', { method: 'POST', body: '{}' })).rejects.toMatchObject({
      status: 401,
    });
    expect(session.recoverUnauthorized).not.toHaveBeenCalled();
  });
});

describe('취소', () => {
  it('이미 취소된 요청은 세션 준비(재발급)를 시작하지 않는다', async () => {
    const session = createSession();
    const controller = new AbortController();
    controller.abort(new Error('logged out'));
    const client = createAuthenticatedApiClient(session);

    await expect(client.apiFetch('/me', { signal: controller.signal })).rejects.toThrow(
      'logged out',
    );
    expect(session.prepareRequest).not.toHaveBeenCalled();
    expect(serviceFetchMock).not.toHaveBeenCalled();
  });
});
