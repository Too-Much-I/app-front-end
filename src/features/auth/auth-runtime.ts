import { AppState } from 'react-native';
import { exchangeFirebaseProof } from '@/features/auth/api/exchange-firebase-proof';
import { getMergeProgress } from '@/features/auth/api/get-merge-progress';
import { getPolicyVersions } from '@/features/auth/api/get-policy-versions';
import { prepareGuestEnrollment } from '@/features/auth/api/prepare-guest-enrollment';
import { submitFirebaseSignup } from '@/features/auth/api/submit-firebase-signup';
import { submitGuestMerge, type GuestMergeResult } from '@/features/auth/api/submit-guest-merge';
import { submitGuestUpgrade } from '@/features/auth/api/submit-guest-upgrade';
import { createFirebaseAuthController } from '@/features/auth/firebase-auth-controller';
import type { FirebaseAuthSdk } from '@/features/auth/firebase-auth-types';

import { createAuthConsentController } from '@/features/auth/auth-consent-controller';
import { createAuthCoordinator } from '@/features/auth/auth-coordinator';
import { observeAuthForegroundRecovery } from '@/features/auth/auth-foreground-recovery';
import { createGuestMergeFlow } from '@/features/auth/guest-merge-flow';
import { createGuestUpgradeFlow } from '@/features/auth/guest-upgrade-flow';
import { createMergeProgressTracker } from '@/features/auth/merge-progress-tracker';
import { createSessionController } from '@/features/auth/session-controller';
import { createSignupFlow } from '@/features/auth/signup-flow';
import { createSignupPhoneVerification } from '@/features/auth/signup-phone-verification';
import type { IdentityEnrollment } from '@/features/auth/identity-login-types';
import type { AuthSession } from '@/features/auth/types';
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
  const mergeProgress = createMergeProgressTracker({
    getProgress: getMergeProgress,
    prepareRequest: session.prepareRequest,
  });
  const unsubscribe = session.subscribeRestoration(coordinator.handleSessionResult);
  // 캐시는 화면 밖에 남으므로 계정이 바뀌면 이전 계정의 조회 결과를 보여주지 않게 비운다.
  // 병합 추적도 이전 계정의 것이므로 멈춘다. 병합 세션 활성화가 먼저 알리고, 추적은 그 뒤에 시작한다.
  const stopCacheReset = session.subscribeAccountChange(() => {
    queryClient.clear();
    mergeProgress.reset();
  });
  // 대상 계정 상태 충돌 뒤 다시 로그인을 한 번 허용한다. 병합 흐름은 로그인마다 새로 만들어져 여기서 센다.
  let hasSeenTargetConflict = false;
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') session.retryPersistence();
  });
  const stopRecovery = observeAuthForegroundRecovery({
    getState: coordinator.getForegroundRecoveryState,
    subscribe: coordinator.subscribe,
    retry: coordinator.retry,
  });
  /**
   * 가입 화면이 흐름마다 한 번 만들고, 화면이 사라질 때 dispose한다. enrollment 출처로 흐름을 고른다:
   * exchange에서 받은 것은 direct signup, Guest prepare에서 받은 것은 승격. 화면은 같다.
   */
  function startEnrollment(input: {
    enrollment: IdentityEnrollment;
    uid: string;
    onComplete: (session: AuthSession) => Promise<void>;
    onMergeRequired: () => void;
  }) {
    const phone = createSignupPhoneVerification({
      uid: input.uid,
      draftStore: coordinator.signupDraft,
      // 흐름은 전화 인증 컨트롤러를 받아 만들어지므로 호출 시점에 참조한다.
      onReauthRequired: () => flow.requireSignInAgain(),
    });
    const { enrollment } = input;
    const flow =
      enrollment.origin === 'guest'
        ? createGuestUpgradeFlow({
            enrollment,
            uid: input.uid,
            draftStore: coordinator.signupDraft,
            phone,
            dependencies: {
              refreshProof: firebase.refreshProof,
              prepareRequest: session.prepareRequest,
              prepare: prepareGuestEnrollment,
              exchange: exchangeFirebaseProof,
              submitUpgrade: submitGuestUpgrade,
              loadPolicyVersions: getPolicyVersions,
            },
            onComplete: input.onComplete,
            onMergeRequired: input.onMergeRequired,
          })
        : createSignupFlow({
            enrollment,
            uid: input.uid,
            draftStore: coordinator.signupDraft,
            phone,
            dependencies: {
              refreshProof: firebase.refreshProof,
              exchange: exchangeFirebaseProof,
              submitSignup: submitFirebaseSignup,
              loadPolicyVersions: getPolicyVersions,
            },
            onComplete: input.onComplete,
          });
    return { flow, phone };
  }
  /** 병합 화면이 흐름마다 한 번 만들고, 화면이 사라질 때 dispose한다. */
  function startMerge(input: {
    uid: string;
    onComplete: (session: AuthSession) => Promise<void>;
    onEnrollmentRequired: (enrollment: IdentityEnrollment) => void;
  }) {
    return createGuestMergeFlow({
      uid: input.uid,
      dependencies: {
        refreshProof: firebase.refreshProof,
        prepareRequest: session.prepareRequest,
        prepare: prepareGuestEnrollment,
        exchange: exchangeFirebaseProof,
        submitMerge: submitGuestMerge,
        targetConflicts: {
          hasSeen: () => hasSeenTargetConflict,
          record: () => {
            hasSeenTargetConflict = true;
          },
        },
      },
      onComplete: async (result: GuestMergeResult) => {
        await input.onComplete(result.session);
        hasSeenTargetConflict = false;
        // 활성화가 실패하면 이 세션으로 조회할 수 없다. mergeId가 없으면(추적 꺼짐) 기다리지 않는다.
        if (result.mergeId && session.getSession()?.accessToken === result.session.accessToken)
          mergeProgress.track(result.mergeId);
      },
      onEnrollmentRequired: input.onEnrollmentRequired,
    });
  }
  const dispose = () => {
    mergeProgress.dispose();
    stopRecovery();
    coordinator.dispose();
    unsubscribe();
    stopCacheReset();
    appState.remove();
    session.dispose();
  };

  return {
    session,
    consent,
    coordinator,
    api,
    mergeProgress,
    startEnrollment,
    startMerge,
    dispose,
  };
}
