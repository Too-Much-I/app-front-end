import * as Crypto from 'expo-crypto';

import type { PaymentStore } from '@/features/pass/payment-store';
import type { PaymentSyncRequest, PaymentSyncResult } from '@/features/pass/api/payment-sync';
import type { PendingPaymentSync } from '@/features/pass/pending-payment-sync-storage';
import { ApiError } from '@/lib/api/transport';

/** 5초 간격 6번, 약 30초(2026-10-14 결정). 분당 12회 제한 안이다. */
const MAX_ATTEMPTS = 6;
/** 202의 `Retry-After`는 응답 본문 밖이라 읽지 못한다. 명세의 현재 값 5초를 쓴다. 오류는 헤더 값을 따른다. */
const DEFAULT_RETRY_SECONDS = 5;

/**
 * 같은 요청을 다시 보내도 결과가 바뀌지 않는 오류. 반복하지 않고 문의를 안내한다(Billing 명세).
 * 403 탈퇴·권한, 409 키 충돌·구매 귀속 충돌, 요청 형식 오류가 여기에 든다. 409 PURCHASE_ACCOUNT_REQUIRED는
 * 다음 로그인에서 결제용 ID를 확보한 뒤 다시 확인할 수 있어 남겨 둔다.
 */
function isFinalError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 409) return error.code !== 'PURCHASE_ACCOUNT_REQUIRED';
  return [400, 403, 413, 415].includes(error.status);
}

function retryDelaySeconds(error: unknown): number {
  return error instanceof ApiError && error.retryAfterSeconds !== undefined
    ? error.retryAfterSeconds
    : DEFAULT_RETRY_SECONDS;
}

/**
 * - `applied`: 이용권에 반영됐다.
 * - `pending`: 상한까지 확인하지 못했다. 저장해 두고 다음 로그인·이용권 화면에서 다시 확인한다.
 * - `contact-support`: 서버가 문의를 권하거나 다시 보내도 소용없는 오류다. 저장값을 지운다.
 * - `cancelled`: 확인 중에 로그인 화면으로 갔다. 다른 계정으로 보내지 않고 멈춘다.
 */
export type PaymentSyncOutcome = 'applied' | 'pending' | 'contact-support' | 'cancelled';

type PaymentSyncDependencies = {
  request: (request: PaymentSyncRequest) => Promise<PaymentSyncResult>;
  readPending: () => Promise<PendingPaymentSync[]>;
  writePending: (entries: readonly PendingPaymentSync[]) => Promise<void>;
  wait?: (seconds: number) => Promise<void>;
};

/**
 * 결제 확인(sync). 결제가 성공하면 `start`가 거래를 저장하고 상한까지 확인한다. 저장된 거래는 `resume`이 다시
 * 확인한다. 같은 거래를 두 곳에서 확인하면 진행 중인 확인을 함께 쓴다 — 여러 화면에서 중복 polling하지 않는다.
 */
export function createPaymentSync(dependencies: PaymentSyncDependencies) {
  const wait =
    dependencies.wait ??
    ((seconds: number) => new Promise<void>((resolve) => setTimeout(resolve, seconds * 1000)));
  const running = new Map<string, Promise<PaymentSyncOutcome>>();
  /** 로그인 화면에 오면 올라간다. 진행 중이던 확인은 다음 요청을 보내지 않는다. */
  let generation = 0;
  /** 저장소 읽기·쓰기를 한 줄로 세워 동시에 끝난 확인이 서로의 변경을 덮어쓰지 않게 한다. */
  let storageTail: Promise<unknown> = Promise.resolve();

  function updatePending(
    change: (entries: PendingPaymentSync[]) => PendingPaymentSync[],
  ): Promise<void> {
    const run = storageTail.then(async () => {
      await dependencies.writePending(change(await dependencies.readPending()));
    });
    storageTail = run.catch(() => undefined);
    return run;
  }

  function forget(entry: PendingPaymentSync): Promise<void> {
    return updatePending((entries) =>
      entries.filter(({ idempotencyKey }) => idempotencyKey !== entry.idempotencyKey),
    ).catch(() => undefined);
  }

  async function confirm(
    entry: PendingPaymentSync,
    startGeneration: number,
  ): Promise<PaymentSyncOutcome> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      if (startGeneration !== generation) return 'cancelled';
      let delay = DEFAULT_RETRY_SECONDS;
      try {
        const result = await dependencies.request(entry);
        if (startGeneration !== generation) return 'cancelled';
        if (result.status === 'APPLIED') {
          await forget(entry);
          return 'applied';
        }
        // 일반 PENDING에는 없다. 있으면 반복을 멈추고 문의를 안내한다(명세 권장).
        if (result.processingHint === 'CONTACT_SUPPORT') {
          await forget(entry);
          return 'contact-support';
        }
      } catch (error) {
        if (isFinalError(error)) {
          await forget(entry);
          return 'contact-support';
        }
        // 타임아웃·응답 유실·401·429·503: 결제를 다시 하지 않고 같은 확인을 다시 보낸다.
        delay = retryDelaySeconds(error);
      }
      if (attempt < MAX_ATTEMPTS) await wait(delay);
    }
    return startGeneration === generation ? 'pending' : 'cancelled';
  }

  function run(entry: PendingPaymentSync): Promise<PaymentSyncOutcome> {
    const existing = running.get(entry.idempotencyKey);
    if (existing) return existing;
    const started = confirm(entry, generation).finally(() => {
      running.delete(entry.idempotencyKey);
    });
    running.set(entry.idempotencyKey, started);
    return started;
  }

  /** 결제가 끝난 거래를 저장하고 확인한다. 저장에 실패해도 이번 확인은 한다. */
  async function start(input: {
    purchaseAccountRef: string;
    store: PaymentStore;
    transactionId: string;
  }): Promise<PaymentSyncOutcome> {
    const entry: PendingPaymentSync = {
      ...input,
      idempotencyKey: Crypto.randomUUID().toLowerCase(),
    };
    await updatePending((entries) => [...entries, entry]).catch(() => undefined);
    return run(entry);
  }

  /** 이 사용자의 저장된 거래를 다시 확인한다. 결과는 알리지 않는다 — 결제한 화면은 이미 닫혔다. */
  async function resume(purchaseAccountRef: string): Promise<void> {
    const entries = await dependencies.readPending();
    await Promise.allSettled(
      entries
        .filter((entry) => entry.purchaseAccountRef === purchaseAccountRef)
        .map((entry) => run(entry)),
    );
  }

  /** 로그인 화면에 오면 부른다. 진행 중인 확인을 멈추고 저장된 거래를 지운다. 던지지 않는다. */
  function clear(): Promise<void> {
    generation += 1;
    return updatePending(() => []).catch(() => undefined);
  }

  return { start, resume, clear };
}
