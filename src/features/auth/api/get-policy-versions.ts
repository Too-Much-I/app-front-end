import { z } from 'zod';

import { AuthProtocolError } from '@/features/auth/types';
import { getIdentityApiBaseUrl } from '@/lib/api/service-base-url';
import { serviceFetch } from '@/lib/api/transport';

export type PolicyVersions = {
  terms: string;
  privacy: string;
  qualityReview: string;
  /** 광고성 푸시 선택 동의 버전. 아직 이 항목이 없는 서버면 `null`이고 가입 화면에서 묻지 않는다. */
  marketingPush: string | null;
};

const policyVersionsSchema = z.object({
  privacyConsentVersion: z.string().trim().min(1),
  termConsentVersion: z.string().trim().min(1),
  qualityReviewConsentVersion: z.string().trim().min(1),
  // 2026-10-27 Identity 테스트 서버에 추가됐다. 운영 배포 전에도 가입이 막히지 않게 없어도 받는다.
  marketingPushConsentVersion: z.string().trim().min(1).optional(),
});

/**
 * direct signup은 Identity 토큰이 없어 `/users/me/consents`를 부를 수 없으므로 공개 API로 버전을 받는다.
 * 2026-09-30 서버 안내 기준 배포 예정 계약이다. 다른 Identity API와 같은 envelope을 가정한다.
 */
export async function getPolicyVersions(signal?: AbortSignal): Promise<PolicyVersions> {
  const envelope = await serviceFetch<unknown>(
    `${getIdentityApiBaseUrl()}/api/v1/policies/consents`,
    { signal },
  );
  const parsed = policyVersionsSchema.safeParse(envelope.result);
  if (!parsed.success) throw new AuthProtocolError();
  return {
    terms: parsed.data.termConsentVersion,
    privacy: parsed.data.privacyConsentVersion,
    qualityReview: parsed.data.qualityReviewConsentVersion,
    marketingPush: parsed.data.marketingPushConsentVersion ?? null,
  };
}
