import { createAuthSession, type AuthSession } from '@/features/auth/types';
import { getIdentityApiBaseUrl } from '@/lib/api/service-base-url';
import { serviceFetch } from '@/lib/api/transport';

export type GuestUpgradeRequest = {
  /** prepare에서 받은 Guest enrollment만 사용한다. direct signup enrollment는 signup으로 보낸다. */
  enrollmentId: string;
  /** 전화번호 연결 후 강제 갱신한 토큰. */
  firebaseIdToken: string;
  nickname: string;
  /** 필수 약관 version은 최신 prepare 응답 값이다. */
  privacyConsentVersion: string;
  termConsentVersion: string;
  /** 선택 동의라 거부도 기록한다. version은 공개 API에서 받는다. */
  isQualityReviewConsented: boolean;
  qualityReviewConsentVersion: string;
};

/**
 * 같은 canonical userId를 MEMBER로 승격한다. 서버는 처리하는 순간 Guest RefreshSession을 폐기하므로
 * 응답을 받지 못하면 성공 여부를 알 수 없다. 판별은 흐름(`guest-upgrade-flow.ts`)이 맡는다.
 */
export async function submitGuestUpgrade(
  request: GuestUpgradeRequest,
  guestAccessToken: string,
  signal?: AbortSignal,
): Promise<AuthSession> {
  const envelope = await serviceFetch<unknown>(
    `${getIdentityApiBaseUrl()}/api/v1/auth/firebase/guest/upgrade`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${guestAccessToken}` },
      body: JSON.stringify({
        enrollmentId: request.enrollmentId,
        firebaseIdToken: request.firebaseIdToken,
        nickname: request.nickname,
        isPrivacyConsented: true,
        privacyConsentVersion: request.privacyConsentVersion,
        isTermConsented: true,
        termConsentVersion: request.termConsentVersion,
        isQualityReviewConsented: request.isQualityReviewConsented,
        qualityReviewConsentVersion: request.qualityReviewConsentVersion,
      }),
      signal,
    },
  );
  return createAuthSession(envelope.result);
}
