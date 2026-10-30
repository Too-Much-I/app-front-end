import { z } from 'zod';

import type { BillingApiFetch } from '@/features/pass/api/purchase-account';
import { parseApiResult } from '@/lib/api/parse-api-result';
import type { ApiEnvelope } from '@/types/api';

/** 10자리 영문 대문자·숫자(I·O·0·1 제외). 다시 불러도 같은 코드가 온다. */
const referralCodeSchema = z.object({
  code: z.string().regex(/^[A-HJ-NP-Z2-9]{10}$/),
});

/**
 * 내 추천 코드(`POST /api/v1/rewards/referral-code`). 본문을 보내지 않는다(`{}`도 안 된다). 따로 조회 API가
 * 없어 보여 줄 때마다 이 요청으로 받는다. 발급만으로는 무료권을 주지 않는다.
 */
export async function issueReferralCode(billingFetch: BillingApiFetch): Promise<string> {
  const { result } = await billingFetch<ApiEnvelope<unknown>>('/api/v1/rewards/referral-code', {
    method: 'POST',
  });
  return parseApiResult(referralCodeSchema, result, 'REFERRAL_CODE').code;
}
