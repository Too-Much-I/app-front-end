import { z } from 'zod';

import { AuthProtocolError } from '@/features/auth/types';
import { getIdentityApiBaseUrl } from '@/lib/api/service-base-url';
import { serviceFetch } from '@/lib/api/transport';

export type PolicyVersions = {
  terms: string;
  privacy: string;
  qualityReview: string;
};

const policyVersionsSchema = z.object({
  privacyConsentVersion: z.string().trim().min(1),
  termConsentVersion: z.string().trim().min(1),
  qualityReviewConsentVersion: z.string().trim().min(1),
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
  };
}
