import {
  createAuthSession,
  marketingPushConsentFields,
  type AuthSession,
  type MarketingPushConsentChoice,
} from '@/features/auth/types';
import { getIdentityApiBaseUrl } from '@/lib/api/service-base-url';
import { serviceFetch } from '@/lib/api/transport';

export type FirebaseSignupRequest = {
  /** exchange에서 받은 direct signup enrollment만 사용한다. Guest enrollment는 upgrade로 보낸다. */
  enrollmentId: string;
  /** 전화번호 연결 후 강제 갱신한 토큰. */
  firebaseIdToken: string;
  nickname: string;
  privacyConsentVersion: string;
  termConsentVersion: string;
  /** 선택 동의라 거부도 기록한다. */
  isQualityReviewConsented: boolean;
  qualityReviewConsentVersion: string;
  /** 광고성 푸시 선택 동의. 서버가 버전을 주지 않았으면 보내지 않는다(서버는 미동의로 본다). */
  marketingPush?: MarketingPushConsentChoice;
};

/** 필수 동의는 true일 때만 제출할 수 있으므로 요청 타입에서 받지 않는다. */
export async function submitFirebaseSignup(
  request: FirebaseSignupRequest,
  signal?: AbortSignal,
): Promise<AuthSession> {
  const envelope = await serviceFetch<unknown>(
    `${getIdentityApiBaseUrl()}/api/v1/auth/firebase/signup`,
    {
      method: 'POST',
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
        ...marketingPushConsentFields(request.marketingPush),
      }),
      signal,
    },
  );
  return createAuthSession(envelope.result);
}
