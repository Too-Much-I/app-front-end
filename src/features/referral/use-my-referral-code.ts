import { useQuery } from '@tanstack/react-query';

import { appAuthRuntime } from '@/features/auth/app-auth-runtime';
import { issueReferralCode } from '@/features/referral/api/issue-referral-code';

/**
 * 내 추천 코드. 발급 API는 결제용 ID(purchase-account)가 있어야 받아 먼저 확보한다.
 *
 * 같은 사용자에게는 늘 같은 코드가 와서(추천 코드 명세) 앱이 켜져 있는 동안 한 번만 받는다(2026-10-29 결정).
 * 기기에는 저장하지 않는다 — 계정별 정리를 따로 둘 필요가 없고, 실행마다 한 번은 서버에 물어 이벤트가 끝났는지
 * 알 수 있다. 계정이 바뀌면 조회 캐시가 비워져(`auth-runtime.ts`) 다른 계정의 코드를 보여 주지 않는다.
 */
export function useMyReferralCode() {
  const { api, purchaseIdentity } = appAuthRuntime;
  return useQuery({
    queryKey: ['referral', 'code'] as const,
    queryFn: async () => {
      await purchaseIdentity.ensure();
      return issueReferralCode(api.billingFetch);
    },
    staleTime: Infinity,
    meta: { failureReport: { code: 'REFERRAL_FAILED', stage: 'issue' } },
  });
}
