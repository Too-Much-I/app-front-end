import { AppState } from 'react-native';
import { exchangeFirebaseProof } from '@/features/auth/api/exchange-firebase-proof';
import { prepareGuestEnrollment } from '@/features/auth/api/prepare-guest-enrollment';
import { createFirebaseAuthController } from '@/features/auth/firebase-auth-controller';
import type { FirebaseAuthSdk } from '@/features/auth/firebase-auth-types';

import { createAuthConsentController } from '@/features/auth/auth-consent-controller';
import { createAuthCoordinator } from '@/features/auth/auth-coordinator';
import { observeAuthForegroundRecovery } from '@/features/auth/auth-foreground-recovery';
import { createSessionController } from '@/features/auth/session-controller';
import { createAuthenticatedApiClient } from '@/lib/api/authenticated-client';
import { queryClient } from '@/lib/query-client';

/**
 * 인증 조립 함수. 앱은 `app-auth-runtime.ts`에서 한 번만 호출해 App과 공용 API가 공유한다.
 * 생성은 저장소·네트워크를 실행하지 않고 bootstrap이 복원을 시작한다.
 * 앱 활성화 리스너를 등록하므로 소유자가 dispose를 호출한다.
 */
export function createAuthRuntime(options: {
  replaySupported: boolean;
  firebaseSdk: FirebaseAuthSdk;
}) {
  const session = createSessionController(options);
  const consent = createAuthConsentController(session);
  const firebase = createFirebaseAuthController(options.firebaseSdk);
  const coordinator = createAuthCoordinator(session, consent, {
    firebase,
    session,
    exchange: exchangeFirebaseProof,
    prepare: prepareGuestEnrollment,
  });
  const api = createAuthenticatedApiClient(session);
  const unsubscribe = session.subscribeRestoration(coordinator.handleSessionResult);
  // 캐시는 화면 밖에 남으므로 계정이 바뀌면 이전 계정의 조회 결과를 보여주지 않게 비운다.
  const stopCacheReset = session.subscribeAccountChange(() => queryClient.clear());
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') session.retryPersistence();
  });
  const stopRecovery = observeAuthForegroundRecovery({
    getState: coordinator.getForegroundRecoveryState,
    subscribe: coordinator.subscribe,
    retry: coordinator.retry,
  });
  const dispose = () => {
    stopRecovery();
    coordinator.dispose();
    unsubscribe();
    stopCacheReset();
    appState.remove();
    session.dispose();
  };

  return { session, consent, coordinator, api, dispose };
}
