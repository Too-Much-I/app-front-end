import { z } from 'zod';

import type { BillingApiFetch } from '@/features/pass/api/purchase-account';
import { parseApiResult } from '@/lib/api/parse-api-result';
import type { ApiEnvelope } from '@/types/api';

export type ReferralApplicationRequest = {
  code: string;
  /**
   * 보낼 때마다 새로 만든다(2026-10-29 결정). 이미 적용한 같은 코드는 새 키로 보내도 처음 성공한 200을 그대로
   * 돌려주고 추가 지급하지 않아(추천 코드 명세) 키를 저장해 둘 이유가 없다. 소문자 UUID v4.
   */
  idempotencyKey: string;
};

/** 수량은 이번에 지급한 장수다. 남은 장수나 누적이 아니다. */
const referralApplicationSchema = z.object({
  applicationId: z.uuid(),
  applied: z.literal(true),
  applicantAwardedQuantity: z.number().int(),
  referrerAwardedQuantity: z.number().int(),
});

export type ReferralApplication = z.infer<typeof referralApplicationSchema>;

/**
 * 가입 때 입력한 남의 추천 코드를 적용한다(`POST /api/v1/rewards/referrals`). 입력한 사람과 코드 주인이 무료
 * 모의고사권을 1장씩 받는다. 본문에는 `code` 말고 다른 필드를 넣지 않는다.
 */
export async function applyReferralCode(
  billingFetch: BillingApiFetch,
  request: ReferralApplicationRequest,
): Promise<ReferralApplication> {
  const { result } = await billingFetch<ApiEnvelope<unknown>>('/api/v1/rewards/referrals', {
    method: 'POST',
    headers: { 'Idempotency-Key': request.idempotencyKey },
    body: JSON.stringify({ code: request.code }),
  });
  return parseApiResult(referralApplicationSchema, result, 'REFERRAL_APPLICATION');
}
