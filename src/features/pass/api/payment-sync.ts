import { z } from 'zod';

import type { PaymentStore } from '@/features/pass/payment-store';
import type { BillingApiFetch } from '@/features/pass/api/purchase-account';
import { parseApiResult } from '@/lib/api/parse-api-result';
import type { ApiEnvelope } from '@/types/api';

export type PaymentSyncRequest = {
  store: PaymentStore;
  /** 스토어 거래 ID. SDK의 어느 값을 보낼지는 서버도 실거래로 확정한다(Billing 명세 2026-10-14). */
  transactionId: string;
  /** 같은 거래의 재확인은 같은 키·같은 본문으로 보낸다. 소문자 UUID v4. */
  idempotencyKey: string;
};

const paymentSyncSchema = z.object({
  status: z.enum(['PENDING', 'APPLIED']),
  processingHint: z.literal('CONTACT_SUPPORT').nullish(),
});

export type PaymentSyncResult = z.infer<typeof paymentSyncSchema>;

/**
 * 결제가 Billing 구매 기록·이용권에 반영됐는지 확인한다(`POST /api/v1/payments/sync`).
 * 202 PENDING과 200 APPLIED 모두 성공 응답이라 `status`로 나눈다.
 */
export async function requestPaymentSync(
  billingFetch: BillingApiFetch,
  request: PaymentSyncRequest,
): Promise<PaymentSyncResult> {
  const { result } = await billingFetch<ApiEnvelope<unknown>>('/api/v1/payments/sync', {
    method: 'POST',
    headers: { 'Idempotency-Key': request.idempotencyKey },
    body: JSON.stringify({ store: request.store, transactionId: request.transactionId }),
  });
  return parseApiResult(paymentSyncSchema, result, 'PAYMENT_SYNC');
}
