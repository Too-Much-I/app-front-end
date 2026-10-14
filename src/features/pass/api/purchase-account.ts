import { z } from 'zod';

import { parseApiResult } from '@/lib/api/parse-api-result';
import type { JsonRequestInit } from '@/lib/api/transport';
import type { ApiEnvelope } from '@/types/api';

/** Billing 요청. 인증 runtime의 `api.billingFetch`를 받는다(`lib/api/client`는 runtime을 import해 순환이 된다). */
export type BillingApiFetch = <T>(path: string, init?: JsonRequestInit) => Promise<T>;

/**
 * 같은 사용자·환경이면 늘 같은 값이다(Billing 명세 2026-10-14). 그래서 기기에 저장해 두고 다시 받지 않는다.
 * 소문자 UUID v4다.
 */
const purchaseAccountSchema = z.object({
  purchaseAccountRefId: z.uuid(),
});

/** 결제용 ID(RevenueCat `app_user_id`). `POST /api/v1/payments/purchase-account`, 본문 없음. */
export async function requestPurchaseAccountRefId(billingFetch: BillingApiFetch): Promise<string> {
  const { result } = await billingFetch<ApiEnvelope<unknown>>('/api/v1/payments/purchase-account', {
    method: 'POST',
  });
  return parseApiResult(purchaseAccountSchema, result, 'PURCHASE_ACCOUNT').purchaseAccountRefId;
}
