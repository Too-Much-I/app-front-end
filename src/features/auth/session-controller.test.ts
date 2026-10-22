import { createSessionController } from '@/features/auth/session-controller';
import {
  SessionRequestError,
  type AuthRestorationRecord,
} from '@/features/auth/session-restoration-types';
import type { AuthSession } from '@/features/auth/types';
import { ApiError, TransportConnectionError } from '@/lib/api/transport';
import { reportOperationalError } from '@/lib/operational-error-reporting';

jest.mock('@/lib/operational-error-reporting', () => ({ reportOperationalError: jest.fn() }));

const reportMock = jest.mocked(reportOperationalError);

beforeEach(() => {
  reportMock.mockClear();
});

/**
 * 세션 복원은 저장소·재발급·계정 조회를 주입받는다. 여기서는 셋을 가짜로 넣어
 * 서버 응답별로 세션이 어떤 상태로 끝나는지 확인한다. 2.0.1 SESSION_LOGGED_OUT 사고처럼
 * "어떤 응답에서 멈추는가"가 이 파일이 지키는 것이다.
 */
const NOW = 1_000_000_000;
const MINUTE = 60_000;

function session(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    schemaVersion: 1,
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    grantType: 'Bearer',
    accessTokenExpiresAt: NOW + 30 * MINUTE,
    refreshTokenExpiresAt: NOW + 30 * 24 * 60 * MINUTE,
    ...overrides,
  };
}

const ROTATED = session({ accessToken: 'access-2', refreshToken: 'refresh-2' });

function setup(stored: AuthRestorationRecord | null, options = { replaySupported: true }) {
  let disk = stored;
  const dependencies = {
    read: jest.fn(() => Promise.resolve(disk)),
    write: jest.fn((record: AuthRestorationRecord) => {
      disk = record;
      return Promise.resolve();
    }),
    removeLegacy: jest.fn(() => Promise.resolve()),
    reissue: jest.fn((..._args: [string, string, boolean]) => Promise.resolve(ROTATED)),
    revoke: jest.fn(() => Promise.resolve()),
    getAccount: jest.fn((_accessToken: string) => Promise.resolve('MEMBER' as const)),
    createRequestId: jest.fn(() => 'request-1'),
    now: () => NOW,
  };
  const controller = createSessionController(options, dependencies);
  return { controller, dependencies, disk: () => disk };
}

function active(value: AuthSession = session()): AuthRestorationRecord {
  return { schemaVersion: 2, phase: 'active', session: value };
}

const EXPIRING = session({ accessTokenExpiresAt: NOW + 30_000 });

describe('저장된 세션 복원', () => {
  it('저장된 세션이 없으면 로그인이 필요하다', async () => {
    const { controller, dependencies } = setup(null);

    await expect(controller.restore()).resolves.toEqual({ kind: 'login-required' });
    expect(dependencies.getAccount).not.toHaveBeenCalled();
  });

  it('유효한 세션은 계정을 확인하고 준비 완료가 된다', async () => {
    const { controller, dependencies } = setup(active());

    await expect(controller.restore()).resolves.toEqual({ kind: 'ready', accountType: 'MEMBER' });
    expect(dependencies.getAccount).toHaveBeenCalledWith('access-1');
    expect(dependencies.reissue).not.toHaveBeenCalled();
    expect(controller.getSession()).toEqual(session());
  });

  it('access token이 곧 만료되면 요청 ID를 먼저 저장하고 재발급한다', async () => {
    const { controller, dependencies, disk } = setup(active(EXPIRING));

    await expect(controller.restore()).resolves.toEqual({ kind: 'ready', accountType: 'MEMBER' });

    // 재발급 응답을 잃어도 같은 요청 ID로 다시 보낼 수 있게, 보내기 전에 저장한다.
    expect(dependencies.write).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'refresh-pending', requestId: 'request-1' }),
    );
    expect(dependencies.reissue).toHaveBeenCalledWith('refresh-1', 'request-1', true);
    expect(dependencies.getAccount).toHaveBeenCalledWith('access-2');
    expect(disk()).toEqual(active(ROTATED));
  });

  it('refresh token까지 만료됐으면 서버에 묻지 않고 세션을 지운다', async () => {
    const { controller, dependencies, disk } = setup(
      active(session({ accessTokenExpiresAt: NOW - 1, refreshTokenExpiresAt: NOW })),
    );

    await expect(controller.restore()).resolves.toEqual({ kind: 'login-required' });
    expect(dependencies.reissue).not.toHaveBeenCalled();
    expect(dependencies.getAccount).not.toHaveBeenCalled();
    expect(disk()).toEqual({ schemaVersion: 2, phase: 'signed-out' });
  });

  it('재발급 결과를 모르는 기록인데 재전송을 지원하지 않으면 멈추고 도움을 안내한다', async () => {
    const { controller, dependencies } = setup({
      schemaVersion: 2,
      phase: 'refresh-pending',
      session: session(),
      requestId: 'request-0',
      replaySupported: false,
    });

    await expect(controller.restore()).resolves.toEqual({
      kind: 'recovery-required',
      reason: 'refresh-uncertain',
      action: 'get-help',
    });
    expect(dependencies.reissue).not.toHaveBeenCalled();
  });
});

describe('재발급 실패 응답별 결과', () => {
  it.each([
    ['SESSION_LOGGED_OUT', undefined],
    ['REFRESH_TOKEN_EXPIRED', undefined],
    ['ACCOUNT_WITHDRAWN', 'account-withdrawn'],
    ['ACCOUNT_MERGED_TOKEN_REJECTED', 'account-inactive'],
  ] as const)('401 %s면 세션을 지우고 로그인으로 보낸다', async (code, notice) => {
    const { controller, dependencies, disk } = setup(active(EXPIRING));
    dependencies.reissue.mockRejectedValue(new ApiError(401, 'rejected', code));

    const result = await controller.restore();

    expect(result).toEqual(
      notice ? { kind: 'login-required', notice } : { kind: 'login-required' },
    );
    expect(disk()).toEqual({ schemaVersion: 2, phase: 'signed-out' });
    expect(dependencies.removeLegacy).toHaveBeenCalled();
    expect(controller.getSession()).toBeNull();
    // 앱이 아는 코드라 보고하지 않는다.
    expect(reportMock).not.toHaveBeenCalled();
  });

  it.each([['SOMETHING_NEW'], [undefined]])(
    '모르는 401(%p)이면 세션을 지우고 로그인으로 보내며 Sentry에 보고한다',
    async (code) => {
      const { controller, dependencies, disk } = setup(active(EXPIRING));
      const rejection = new ApiError(401, 'new', code);
      dependencies.reissue.mockRejectedValue(rejection);

      await expect(controller.restore()).resolves.toEqual({ kind: 'login-required' });
      expect(disk()).toEqual({ schemaVersion: 2, phase: 'signed-out' });
      expect(reportMock).toHaveBeenCalledWith({
        code: 'AUTH_SESSION_REJECTED',
        stage: 'reissue',
        cause: rejection,
      });

      // 다음 복원은 지워진 기록을 읽고 끝난다. 같은 토큰으로 다시 재발급하지 않는다.
      await expect(controller.restore()).resolves.toEqual({ kind: 'login-required' });
      expect(dependencies.reissue).toHaveBeenCalledTimes(1);
    },
  );

  it('재전송을 지원하지 않아도 모르는 401은 결과가 확실한 거절이라 로그인으로 보낸다', async () => {
    const { controller, dependencies } = setup(active(EXPIRING), { replaySupported: false });
    dependencies.reissue.mockRejectedValue(new ApiError(401, 'new', 'SOMETHING_NEW'));

    await expect(controller.restore()).resolves.toEqual({ kind: 'login-required' });
  });

  it('401 WITHDRAWAL_CLEANUP_PENDING은 세션을 지우지 않고 도움 안내로 멈춘다', async () => {
    const { controller, dependencies, disk } = setup(active(EXPIRING));
    dependencies.reissue.mockRejectedValue(
      new ApiError(401, 'cleanup', 'WITHDRAWAL_CLEANUP_PENDING'),
    );

    await expect(controller.restore()).resolves.toEqual({
      kind: 'recovery-required',
      reason: 'unexpected',
      action: 'get-help',
    });
    expect(disk()).not.toEqual({ schemaVersion: 2, phase: 'signed-out' });
    expect(reportMock).not.toHaveBeenCalled();
  });

  it('401이 아닌 서버 오류는 세션을 지우지 않고 다시 시도하게 한다', async () => {
    const { controller, dependencies } = setup(active(EXPIRING));
    dependencies.reissue.mockRejectedValue(new ApiError(503, 'down'));

    await expect(controller.restore()).resolves.toEqual({
      kind: 'recovery-required',
      reason: 'server',
      action: 'retry',
    });
    expect(controller.getSession()).toBeNull();
    expect(reportMock).not.toHaveBeenCalled();
  });

  it('연결 실패는 다시 시도할 수 있고, 다시 시도하면 같은 요청 ID로 재발급한다', async () => {
    const { controller, dependencies } = setup(active(EXPIRING));
    dependencies.reissue.mockRejectedValueOnce(new TransportConnectionError());

    await expect(controller.restore()).resolves.toEqual({
      kind: 'recovery-required',
      reason: 'connection',
      action: 'retry',
    });
    await expect(controller.restore()).resolves.toEqual({ kind: 'ready', accountType: 'MEMBER' });
    expect(dependencies.reissue.mock.calls.map((call) => call[1])).toEqual([
      'request-1',
      'request-1',
    ]);
  });
});

describe('계정 조회 실패 응답별 결과', () => {
  it('SESSION_LOGGED_OUT이면 재발급하지 않고 로그인으로 보낸다(2.0.1 사고)', async () => {
    const { controller, dependencies } = setup(active());
    dependencies.getAccount.mockRejectedValue(new ApiError(401, 'out', 'SESSION_LOGGED_OUT'));

    await expect(controller.restore()).resolves.toEqual({ kind: 'login-required' });
    expect(dependencies.reissue).not.toHaveBeenCalled();
  });

  it('그 밖의 401이면 한 번 재발급한 뒤 다시 확인한다', async () => {
    const { controller, dependencies } = setup(active());
    dependencies.getAccount
      .mockRejectedValueOnce(new ApiError(401, 'expired', 'ACCESS_TOKEN_EXPIRED'))
      .mockResolvedValueOnce('MEMBER');

    await expect(controller.restore()).resolves.toEqual({ kind: 'ready', accountType: 'MEMBER' });
    expect(dependencies.reissue).toHaveBeenCalledTimes(1);
    expect(dependencies.getAccount).toHaveBeenLastCalledWith('access-2');
  });

  it('재발급한 토큰도 401이면 다시 재발급하지 않고 로그인으로 보내며 보고한다', async () => {
    const { controller, dependencies } = setup(active());
    dependencies.getAccount.mockRejectedValue(new ApiError(401, 'expired'));

    await expect(controller.restore()).resolves.toEqual({ kind: 'login-required' });
    expect(dependencies.reissue).toHaveBeenCalledTimes(1);
    expect(reportMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'AUTH_SESSION_REJECTED', stage: 'account-check' }),
    );
  });
});

describe('요청 중 받은 401 복구', () => {
  it('동시에 들어온 요청은 재발급을 한 번만 한다', async () => {
    const { controller, dependencies } = setup(active(EXPIRING));

    const snapshots = await Promise.all([
      controller.prepareRequest(),
      controller.prepareRequest(),
      controller.prepareRequest(),
    ]);

    expect(dependencies.reissue).toHaveBeenCalledTimes(1);
    expect(snapshots.map((snapshot) => snapshot.accessToken)).toEqual([
      'access-2',
      'access-2',
      'access-2',
    ]);
  });

  it('API가 SESSION_LOGGED_OUT을 주면 세션을 지우고 구독자에게 로그인 필요를 알린다', async () => {
    const { controller, dependencies } = setup(active());
    const { generation } = await controller.prepareRequest();
    const listener = jest.fn();
    controller.subscribeRestoration(listener);

    const error = await controller
      .recoverUnauthorized(generation, 'SESSION_LOGGED_OUT')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(SessionRequestError);
    expect((error as SessionRequestError).result).toEqual({ kind: 'login-required' });
    expect(listener).toHaveBeenCalledWith({ kind: 'login-required' });
    expect(dependencies.reissue).not.toHaveBeenCalled();
  });

  it('API의 401로 재발급했는데 모르는 401을 받으면 요청을 로그인 필요로 끝낸다', async () => {
    const { controller, dependencies } = setup(active());
    const { generation } = await controller.prepareRequest();
    dependencies.reissue.mockRejectedValue(new ApiError(401, 'new', 'SOMETHING_NEW'));

    const error = await controller
      .recoverUnauthorized(generation, 'ACCESS_TOKEN_EXPIRED')
      .catch((caught: unknown) => caught);

    expect((error as SessionRequestError).result).toEqual({ kind: 'login-required' });
    expect(controller.getSession()).toBeNull();
    expect(reportMock).toHaveBeenCalledTimes(1);
  });

  it('이미 다른 요청이 복구한 세대면 재발급 없이 새 토큰을 쓴다', async () => {
    const { controller, dependencies } = setup(active());
    const first = await controller.prepareRequest();
    await controller.recoverUnauthorized(first.generation);
    expect(dependencies.reissue).toHaveBeenCalledTimes(1);

    const late = await controller.recoverUnauthorized(first.generation);

    expect(dependencies.reissue).toHaveBeenCalledTimes(1);
    expect(late.accessToken).toBe('access-2');
  });
});

describe('로그아웃', () => {
  it('기기 세션을 먼저 지우고, 서버 폐기 실패는 무시한다', async () => {
    const { controller, dependencies, disk } = setup(active());
    await controller.restore();
    dependencies.revoke.mockRejectedValue(new TransportConnectionError());

    await expect(controller.signOut()).resolves.toBeUndefined();

    expect(disk()).toEqual({ schemaVersion: 2, phase: 'signed-out' });
    expect(dependencies.revoke).toHaveBeenCalledWith('refresh-1');
    await expect(controller.prepareRequest()).rejects.toBeInstanceOf(SessionRequestError);
  });
});
