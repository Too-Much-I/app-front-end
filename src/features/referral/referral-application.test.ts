import type { ReferralApplicationRequest } from '@/features/referral/api/apply-referral-code';
import type { PendingReferral } from '@/features/referral/pending-referral-storage';
import {
  createReferralApplication,
  decideReferralFailure,
} from '@/features/referral/referral-application';
import { ApiError, TransportConnectionError } from '@/lib/api/transport';

let mockKeyCount = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `KEY-${++mockKeyCount}` }));

const PENDING: PendingReferral = { uid: 'uid-a', code: 'ABCDEFGHJK' };

function setup(options: { stored?: PendingReferral | null; uid?: string | null } = {}) {
  let stored = options.stored === undefined ? PENDING : options.stored;
  const dependencies = {
    request: jest.fn((_request: ReferralApplicationRequest) => Promise.resolve({})),
    readPending: jest.fn(() => Promise.resolve(stored)),
    writePending: jest.fn((pending: PendingReferral | null) => {
      stored = pending;
      return Promise.resolve();
    }),
    getCurrentUid: jest.fn(() => (options.uid === undefined ? 'uid-a' : options.uid)),
    preparePurchaseAccount: jest.fn(() => Promise.resolve('ref-a')),
    onDecided: jest.fn(),
  };
  return {
    referral: createReferralApplication(dependencies),
    dependencies,
    stored: () => stored,
  };
}

beforeEach(() => {
  mockKeyCount = 0;
});

describe('decideReferralFailure', () => {
  it.each([
    [new ApiError(409, '', 'SELF_REFERRAL_NOT_ALLOWED'), 'rejected'],
    [new ApiError(422, '', 'REFERRAL_CODE_UNAVAILABLE'), 'rejected'],
    [new ApiError(409, '', 'REFERRAL_ALREADY_APPLIED'), 'rejected'],
    [new ApiError(403, '', 'PAYMENT_ACCOUNT_WITHDRAWN'), 'dropped'],
    [new ApiError(409, '', 'IDEMPOTENCY_KEY_CONFLICT'), 'dropped'],
    [new ApiError(400, '', 'INVALID_REQUEST'), 'dropped'],
    [new ApiError(409, '', 'PURCHASE_ACCOUNT_REQUIRED'), 'kept'],
    [new ApiError(401, '', 'UNAUTHENTICATED'), 'kept'],
    [new ApiError(404, '', 'NOT_FOUND'), 'kept'],
    [new ApiError(429, '', 'RATE_LIMITED'), 'kept'],
    [new ApiError(503, '', 'BILLING_TEMPORARILY_UNAVAILABLE'), 'kept'],
    [new ApiError(200, '', 'API_RESPONSE_VALIDATION_FAILED'), 'kept'],
    [new TransportConnectionError(), 'kept'],
  ])('%p → %s', (error, kind) => {
    expect(decideReferralFailure(error).kind).toBe(kind);
  });
});

describe('추천 코드 적용', () => {
  it('결제용 ID를 준비한 뒤 저장한 코드를 새 키로 보내고, 성공하면 지운다', async () => {
    const { referral, dependencies, stored } = setup();

    await expect(referral.applyPending()).resolves.toEqual({ kind: 'applied' });
    expect(dependencies.preparePurchaseAccount).toHaveBeenCalledTimes(1);
    expect(dependencies.request).toHaveBeenCalledWith({
      code: 'ABCDEFGHJK',
      idempotencyKey: 'key-1',
    });
    expect(stored()).toBeNull();
  });

  it('앱이 켜져 있는 동안 한 번만 보낸다', async () => {
    const { referral, dependencies } = setup();
    dependencies.request.mockRejectedValueOnce(new ApiError(503, ''));

    await expect(referral.applyPending()).resolves.toEqual({ kind: 'none' });
    await expect(referral.applyPending()).resolves.toEqual({ kind: 'none' });
    expect(dependencies.request).toHaveBeenCalledTimes(1);
  });

  it('다시 보낼 수 있는 실패는 남기고 알리지 않는다', async () => {
    const { referral, dependencies, stored } = setup();
    dependencies.request.mockRejectedValueOnce(new ApiError(401, ''));

    await expect(referral.applyPending()).resolves.toEqual({ kind: 'none' });
    expect(stored()).toEqual(PENDING);
  });

  it('본인 코드는 지우고 알린다', async () => {
    const { referral, dependencies, stored } = setup();
    dependencies.request.mockRejectedValueOnce(new ApiError(409, '', 'SELF_REFERRAL_NOT_ALLOWED'));

    await expect(referral.applyPending()).resolves.toEqual({
      kind: 'rejected',
      reason: 'self-referral',
    });
    expect(stored()).toBeNull();
  });

  it('403은 지우고 알리지 않는다', async () => {
    const { referral, dependencies, stored } = setup();
    dependencies.request.mockRejectedValueOnce(new ApiError(403, '', 'FORBIDDEN'));

    await expect(referral.applyPending()).resolves.toEqual({ kind: 'none' });
    expect(stored()).toBeNull();
  });

  it('결제용 ID를 받지 못하면 보내지 않고 남긴다', async () => {
    const { referral, dependencies, stored } = setup();
    dependencies.preparePurchaseAccount.mockRejectedValueOnce(new TransportConnectionError());

    await expect(referral.applyPending()).resolves.toEqual({ kind: 'none' });
    expect(dependencies.request).not.toHaveBeenCalled();
    expect(stored()).toEqual(PENDING);
  });

  it('다른 사용자의 코드는 보내지 않고 지운다', async () => {
    const { referral, dependencies, stored } = setup({ uid: 'uid-b' });

    await expect(referral.applyPending()).resolves.toEqual({ kind: 'none' });
    expect(dependencies.request).not.toHaveBeenCalled();
    expect(stored()).toBeNull();
  });

  it('사용자를 아직 모르면 보내지도 지우지도 않는다', async () => {
    const { referral, dependencies, stored } = setup({ uid: null });

    await expect(referral.applyPending()).resolves.toEqual({ kind: 'none' });
    expect(dependencies.request).not.toHaveBeenCalled();
    expect(stored()).toEqual(PENDING);
  });

  it('저장한 코드가 없으면 보내지 않는다', async () => {
    const { referral, dependencies } = setup({ stored: null });

    await expect(referral.applyPending()).resolves.toEqual({ kind: 'none' });
    expect(dependencies.preparePurchaseAccount).not.toHaveBeenCalled();
  });

  it('보내는 중에 로그인 화면으로 가면 결과를 버리고 새로 저장한 코드를 지우지 않는다', async () => {
    const { referral, dependencies, stored } = setup();
    let finish: () => void = () => undefined;
    dependencies.request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({});
        }),
    );

    const applying = referral.applyPending();
    await Promise.resolve();
    await Promise.resolve();
    await referral.clear();
    const next: PendingReferral = { uid: 'uid-b', code: 'ZZZZZZZZZZ' };
    await referral.remember(next);
    finish();

    await expect(applying).resolves.toEqual({ kind: 'none' });
    expect(dependencies.onDecided).not.toHaveBeenCalled();
    expect(stored()).toEqual(next);
  });

  it('로그인 화면을 거치면 같은 실행에서도 다음 계정이 다시 보낼 수 있다', async () => {
    const { referral, dependencies } = setup({ stored: null });

    await referral.applyPending();
    await referral.clear();
    await referral.remember(PENDING);

    await expect(referral.applyPending()).resolves.toEqual({ kind: 'applied' });
    expect(dependencies.request).toHaveBeenCalledTimes(1);
  });
});
