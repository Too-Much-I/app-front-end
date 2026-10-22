import type { PaymentSyncRequest, PaymentSyncResult } from '@/features/pass/api/payment-sync';
import { createPaymentSync } from '@/features/pass/payment-sync';
import type { PendingPaymentSync } from '@/features/pass/pending-payment-sync-storage';
import { ApiError, TransportConnectionError } from '@/lib/api/transport';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'KEY-1' }));

const PENDING: PaymentSyncResult = { status: 'PENDING' };
const APPLIED: PaymentSyncResult = { status: 'APPLIED' };
const PURCHASE = {
  purchaseAccountRef: 'ref-a',
  store: 'APP_STORE',
  transactionId: 'tx-1',
} as const;

function setup(initial: PendingPaymentSync[] = []) {
  let stored = initial;
  const dependencies = {
    request: jest.fn((_request: PaymentSyncRequest) => Promise.resolve(APPLIED)),
    readPending: jest.fn(() => Promise.resolve(stored)),
    writePending: jest.fn((entries: readonly PendingPaymentSync[]) => {
      stored = [...entries];
      return Promise.resolve();
    }),
    // 실제로 기다리지 않고 몇 초를 기다리려 했는지만 기록한다.
    wait: jest.fn((_seconds: number) => Promise.resolve()),
  };
  return { sync: createPaymentSync(dependencies), dependencies, stored: () => stored };
}

describe('결제 확인', () => {
  it('반영되면 applied이고 저장해 둔 거래를 지운다', async () => {
    const { sync, dependencies, stored } = setup();

    await expect(sync.start(PURCHASE)).resolves.toBe('applied');
    // 같은 거래의 재확인이 같은 키를 쓰도록 소문자로 만든 키를 보낸다.
    expect(dependencies.request).toHaveBeenCalledWith({ ...PURCHASE, idempotencyKey: 'key-1' });
    expect(stored()).toEqual([]);
  });

  it('PENDING이 이어지면 5초 간격 6번까지만 묻고 pending으로 남긴다', async () => {
    const { sync, dependencies, stored } = setup();
    dependencies.request.mockResolvedValue(PENDING);

    await expect(sync.start(PURCHASE)).resolves.toBe('pending');
    expect(dependencies.request).toHaveBeenCalledTimes(6);
    expect(dependencies.wait.mock.calls.map(([seconds]) => seconds)).toEqual([5, 5, 5, 5, 5]);
    // 다음 로그인에서 다시 확인하도록 거래를 남긴다.
    expect(stored()).toEqual([{ ...PURCHASE, idempotencyKey: 'key-1' }]);
  });

  it('서버가 문의를 권하면 반복을 멈추고 거래를 지운다', async () => {
    const { sync, dependencies, stored } = setup();
    dependencies.request.mockResolvedValue({
      status: 'PENDING',
      processingHint: 'CONTACT_SUPPORT',
    });

    await expect(sync.start(PURCHASE)).resolves.toBe('contact-support');
    expect(dependencies.request).toHaveBeenCalledTimes(1);
    expect(stored()).toEqual([]);
  });

  it.each([
    [400, undefined],
    [403, 'ACCOUNT_WITHDRAWN'],
    [409, 'PURCHASE_ATTRIBUTION_CONFLICT'],
  ])('다시 보내도 같은 %i %s는 문의 안내로 끝낸다', async (status, code) => {
    const { sync, dependencies } = setup();
    dependencies.request.mockRejectedValue(new ApiError(status, 'final', code));

    await expect(sync.start(PURCHASE)).resolves.toBe('contact-support');
    expect(dependencies.request).toHaveBeenCalledTimes(1);
  });

  it('409 PURCHASE_ACCOUNT_REQUIRED는 다음에 다시 확인할 수 있어 남긴다', async () => {
    const { sync, dependencies, stored } = setup();
    dependencies.request.mockRejectedValue(
      new ApiError(409, 'need account', 'PURCHASE_ACCOUNT_REQUIRED'),
    );

    await expect(sync.start(PURCHASE)).resolves.toBe('pending');
    expect(stored()).toHaveLength(1);
  });

  it('연결 실패 뒤 반영되면 applied다', async () => {
    const { sync, dependencies } = setup();
    dependencies.request
      .mockRejectedValueOnce(new TransportConnectionError())
      .mockResolvedValueOnce(APPLIED);

    await expect(sync.start(PURCHASE)).resolves.toBe('applied');
  });

  it('Retry-After가 남은 대기 한도를 넘으면 기다리지 않고 pending으로 끝낸다', async () => {
    const { sync, dependencies } = setup();
    dependencies.request.mockRejectedValue(
      new ApiError(429, 'slow down', 'RATE_LIMITED', undefined, 60),
    );

    await expect(sync.start(PURCHASE)).resolves.toBe('pending');
    expect(dependencies.request).toHaveBeenCalledTimes(1);
    expect(dependencies.wait).not.toHaveBeenCalled();
  });
});

describe('저장된 거래 다시 확인', () => {
  it('이 사용자의 거래만 다시 확인한다', async () => {
    const mine = { ...PURCHASE, idempotencyKey: 'mine' };
    const other = { ...PURCHASE, purchaseAccountRef: 'ref-b', idempotencyKey: 'other' };
    const { sync, dependencies, stored } = setup([mine, other]);

    await sync.resume('ref-a');

    expect(dependencies.request).toHaveBeenCalledTimes(1);
    expect(dependencies.request).toHaveBeenCalledWith(mine);
    expect(stored()).toEqual([other]);
  });

  it('같은 거래를 두 곳에서 확인하면 요청을 함께 쓴다', async () => {
    const entry = { ...PURCHASE, idempotencyKey: 'same' };
    const { sync, dependencies } = setup([entry]);

    await Promise.all([sync.resume('ref-a'), sync.resume('ref-a')]);

    expect(dependencies.request).toHaveBeenCalledTimes(1);
  });
});

describe('로그인 화면으로 이동', () => {
  it('진행 중인 확인을 멈추고 다른 계정으로 다시 보내지 않는다', async () => {
    const { sync, dependencies, stored } = setup();
    dependencies.request.mockResolvedValue(PENDING);
    dependencies.wait.mockImplementationOnce(async () => {
      await sync.clear();
    });

    await expect(sync.start(PURCHASE)).resolves.toBe('cancelled');
    expect(dependencies.request).toHaveBeenCalledTimes(1);
    expect(stored()).toEqual([]);
  });
});
