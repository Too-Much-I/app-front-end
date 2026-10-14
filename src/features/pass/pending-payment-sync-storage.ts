import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

import type { PaymentSyncRequest } from '@/features/pass/api/payment-sync';

/**
 * 확인을 끝내지 못한 결제. 앱이 꺼져도 다음 로그인·이용권 화면에서 같은 키·같은 본문으로 다시 확인한다
 * (2026-10-14 결정). 결제용 ID로 사용자를 구분하고, 로그인 화면에 오면 결제용 ID와 함께 지운다 — 다른 계정으로
 * 다시 보내지 않는다(Billing 명세).
 */
export type PendingPaymentSync = PaymentSyncRequest & { purchaseAccountRef: string };

const PENDING_KEY = 'pending-payment-syncs.v1';

const pendingSchema = z.array(
  z.object({
    purchaseAccountRef: z.string(),
    store: z.enum(['APP_STORE', 'PLAY_STORE']),
    transactionId: z.string(),
    idempotencyKey: z.string(),
  }),
);

/** 읽지 못하거나 형식이 깨졌으면 없는 것으로 본다. 남은 거래는 서버 웹훅이 반영한다. */
export async function readPendingPaymentSyncs(): Promise<PendingPaymentSync[]> {
  try {
    const value = await AsyncStorage.getItem(PENDING_KEY);
    if (!value) return [];
    const parsed = pendingSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function writePendingPaymentSyncs(entries: readonly PendingPaymentSync[]): Promise<void> {
  return entries.length === 0
    ? AsyncStorage.removeItem(PENDING_KEY)
    : AsyncStorage.setItem(PENDING_KEY, JSON.stringify(entries));
}
