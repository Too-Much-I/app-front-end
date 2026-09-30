import { createAuthRuntime } from '@/features/auth/auth-runtime';
import { createFirebaseAuthSdk } from '@/features/auth/firebase-auth-sdk';

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const kakaoProviderId = process.env.EXPO_PUBLIC_KAKAO_OIDC_PROVIDER_ID;

/**
 * 앱 전체가 공유하는 인증 runtime. App과 공용 API가 같은 세션을 쓰도록 모듈에서 한 번만 만든다.
 * 앱 수명과 같으므로 dispose하지 않는다. 설정이 없는 Provider는 `provider-unavailable`로 끝난다.
 */
export const appAuthRuntime = createAuthRuntime({
  // 서버가 /auth/reissue의 Idempotency-Key 재전송을 지원한다고 확인했다(2026-09-30).
  replaySupported: true,
  firebaseSdk: createFirebaseAuthSdk({
    google: googleWebClientId
      ? {
          webClientId: googleWebClientId,
          iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
        }
      : undefined,
    apple:
      process.env.EXPO_PUBLIC_FIREBASE_APPLE_ENABLED === 'true' ? { enabled: true } : undefined,
    kakao: kakaoProviderId ? { providerId: kakaoProviderId } : undefined,
  }),
});
