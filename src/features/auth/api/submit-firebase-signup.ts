import { createAuthSession, type AuthSession } from '@/features/auth/types';
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
};

/**
 * 필수 동의는 true일 때만 제출할 수 있으므로 요청 타입에서 받지 않는다.
 * 품질 검토(선택) 동의 필드는 서버가 추가할 예정이며 이름이 확정되기 전에는 보내지 않는다.
 */
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
      }),
      signal,
    },
  );
  return createAuthSession(envelope.result);
}
