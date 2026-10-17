import { z } from 'zod';

import type { PaymentStore } from '@/features/pass/payment-store';
import { billingFetchWithAuthRetry } from '@/lib/api/client';
import { parseApiResult } from '@/lib/api/parse-api-result';
import type { ApiEnvelope } from '@/types/api';

const storeSchema = z.enum(['APP_STORE', 'PLAY_STORE']) satisfies z.ZodType<PaymentStore>;

/**
 * `GET /api/v1/payments/products`에서 앱이 읽는 값(Billing 명세 2026-10-14).
 * 가격·이름은 없다 — 스토어가 정한다. 이 목록은 "Billing이 이용권으로 바꿔 줄 수 있는 상품"이다.
 * 모르는 offerCode는 버리지 않고 그대로 받는다. 상품표에 없으면 화면이 뺀다.
 */
const paymentProductsSchema = z.object({
  products: z.array(
    z.object({
      offerCode: z.string(),
      durationSeconds: z.number().int().positive(),
      storeProducts: z.array(
        z.object({ store: storeSchema, productId: z.string(), packageId: z.string() }),
      ),
    }),
  ),
});

export type PaymentProduct = z.infer<typeof paymentProductsSchema>['products'][number];

/** 정상 빈 목록은 판매 상품 없음이다. 실패는 던진다 — 빈 목록으로 숨기지 않는다. */
export async function getPaymentProducts(signal?: AbortSignal): Promise<PaymentProduct[]> {
  const { result } = await billingFetchWithAuthRetry<ApiEnvelope<unknown>>(
    '/api/v1/payments/products',
    { signal },
  );
  return parseApiResult(paymentProductsSchema, result, 'PAYMENT_PRODUCTS').products;
}
