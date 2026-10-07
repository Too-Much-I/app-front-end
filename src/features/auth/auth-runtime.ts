import { AppState } from 'react-native';
import { exchangeFirebaseProof } from '@/features/auth/api/exchange-firebase-proof';
import { lookupAccountRecovery } from '@/features/auth/api/lookup-account-recovery';
import { prepareAccountRecovery } from '@/features/auth/api/prepare-account-recovery';
import { getMergeProgress } from '@/features/auth/api/get-merge-progress';
import { getPolicyVersions } from '@/features/auth/api/get-policy-versions';
import { prepareGuestEnrollment } from '@/features/auth/api/prepare-guest-enrollment';
import { submitFirebaseSignup } from '@/features/auth/api/submit-firebase-signup';
import { submitGuestMerge, type GuestMergeResult } from '@/features/auth/api/submit-guest-merge';
import { submitGuestUpgrade } from '@/features/auth/api/submit-guest-upgrade';
import { withdrawAccount } from '@/features/auth/api/withdraw-account';
import { createFirebaseAuthController } from '@/features/auth/firebase-auth-controller';
import type { FirebaseAuthSdk } from '@/features/auth/firebase-auth-types';

import {
  createAccountRecoveryFlow,
  type AccountRecoveryEntry,
} from '@/features/auth/account-recovery-flow';
import {
  runAccountWithdrawal,
  type AccountWithdrawalResult,
} from '@/features/auth/account-withdrawal';
import { createAuthConsentController } from '@/features/auth/auth-consent-controller';
import { createAuthCoordinator } from '@/features/auth/auth-coordinator';
import { observeAuthForegroundRecovery } from '@/features/auth/auth-foreground-recovery';
import { createGuestMergeFlow } from '@/features/auth/guest-merge-flow';
import { createGuestUpgradeFlow } from '@/features/auth/guest-upgrade-flow';
import { clearInstallationId } from '@/features/auth/installation-id';
import { createLastLoginProviderStore } from '@/features/auth/last-login-provider';
import { createMergeProgressTracker } from '@/features/auth/merge-progress-tracker';
import { createSessionController } from '@/features/auth/session-controller';
import { createSignupFlow } from '@/features/auth/signup-flow';
import { createSignupPhoneVerification } from '@/features/auth/signup-phone-verification';
import type { IdentityEnrollment } from '@/features/auth/identity-login-types';
import type { AuthSessionRestoreResult } from '@/features/auth/session-restoration-types';
import type { AuthSession } from '@/features/auth/types';
import { clearStoredConsent } from '@/features/consent/consent-storage';
import { clearStoredOptionalConsent } from '@/features/consent/optional-consent-storage';
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
  // 생성은 저장소를 읽지 않는다. 로그인 화면이 처음 보일 때 load한다.
  const lastLoginProvider = createLastLoginProviderStore();
  const coordinator = createAuthCoordinator(session, consent, {
    firebase,
    session,
    exchange: exchangeFirebaseProof,
    prepare: prepareGuestEnrollment,
    rememberLoginProvider: lastLoginProvider.remember,
  });
  const api = createAuthenticatedApiClient(session);
  const mergeProgress = createMergeProgressTracker({
    getProgress: getMergeProgress,
    prepareRequest: session.prepareRequest,
  });
  const unsubscribe = session.subscribeRestoration(coordinator.handleSessionResult);
  /**
   * 탈퇴한 계정은 이 기기에서 새 계정으로 시작한다(2026-10-07 결정). 세션과 조회 캐시는 세션 담당과 계정 변경
   * 알림이 지우고, 여기서는 그 밖의 기기 정보를 지운다. 이 기기에서 탈퇴했든 다른 기기에서 탈퇴해 재발급·계정
   * 조회가 ACCOUNT_WITHDRAWN을 받았든 같은 알림으로 들어온다. 겹쳐 오면 진행 중인 정리를 함께 쓴다.
   */
  let clearingWithdrawnDevice: Promise<void> | null = null;
  function clearWithdrawnDevice(): Promise<void> {
    clearingWithdrawnDevice ??= Promise.allSettled([
      firebase.signOut(),
      lastLoginProvider.forget(),
      clearInstallationId(),
      clearStoredConsent(),
      clearStoredOptionalConsent(),
    ]).then(() => {
      coordinator.signupDraft.reset();
      clearingWithdrawnDevice = null;
    });
    return clearingWithdrawnDevice;
  }
  const stopWithdrawnCleanup = session.subscribeRestoration((result: AuthSessionRestoreResult) => {
    if (result.kind === 'login-required' && result.notice === 'account-withdrawn')
      void clearWithdrawnDevice();
  });
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
  /**
   * 회원 탈퇴. 연속으로 눌러도 한 번만 실행한다. 확정되면 세션을 지우고 탈퇴 결과를 알려, 안내 화면 전환과 기기
   * 정리가 다른 기기 탈퇴와 같은 경로를 탄다. 실패·취소는 호출한 화면이 보여준다.
   */
  let withdrawing: Promise<AccountWithdrawalResult> | null = null;
  function withdraw(): Promise<AccountWithdrawalResult> {
    withdrawing ??= runAccountWithdrawal({
      prepareTokenPair: session.prepareTokenPair,
      recoverUnauthorized: session.recoverUnauthorized,
      firebase: options.firebaseSdk,
      withdraw: withdrawAccount,
    })
      .then(async (result) => {
        if (result.kind === 'withdrawn') await session.endWithdrawnSession();
        return result;
      })
      .finally(() => {
        withdrawing = null;
      });
    return withdrawing;
  }
  /** 계정 찾기 화면이 흐름마다 한 번 만들고, 화면이 사라질 때 dispose한다. */
  function startAccountRecovery(entry: AccountRecoveryEntry) {
    return createAccountRecoveryFlow({
      entry,
      dependencies: { prepare: prepareAccountRecovery, lookup: lookupAccountRecovery },
    });
  }
  const dispose = () => {
    mergeProgress.dispose();
    stopRecovery();
    coordinator.dispose();
    unsubscribe();
    stopWithdrawnCleanup();
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
    lastLoginProvider,
    startEnrollment,
    startMerge,
    startAccountRecovery,
    withdraw,
    dispose,
  };
}
