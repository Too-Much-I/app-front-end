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
import { createAuthCoordinator, type AuthCoordinatorState } from '@/features/auth/auth-coordinator';
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
import { forgetExamCreationKey } from '@/features/exam/exam-creation-key';
import { requestPurchaseAccountRefId } from '@/features/pass/api/purchase-account';
import {
  clearStoredPurchaseAccountRef,
  readStoredPurchaseAccountRef,
  storePurchaseAccountRef,
} from '@/features/pass/purchase-account-storage';
import { requestPaymentSync } from '@/features/pass/api/payment-sync';
import { createPaymentSync } from '@/features/pass/payment-sync';
import {
  readPendingPaymentSyncs,
  writePendingPaymentSyncs,
} from '@/features/pass/pending-payment-sync-storage';
import { createPurchaseIdentity } from '@/features/pass/purchase-identity';
import { logInStoreCustomer, logOutStoreCustomer } from '@/features/pass/revenuecat';
import { observePushTokenRefresh } from '@/features/push/push-notification-events';
import { createPushRegistration } from '@/features/push/push-registration';
import { applyReferralCode } from '@/features/referral/api/apply-referral-code';
import {
  readPendingReferral,
  writePendingReferral,
} from '@/features/referral/pending-referral-storage';
import {
  createReferralApplication,
  type ReferralDecision,
} from '@/features/referral/referral-application';
import { checkReferralCodeFormat } from '@/features/referral/referral-code-format';
import { createAuthenticatedApiClient } from '@/lib/api/authenticated-client';
import { resetAnalyticsUser, setAnalyticsUserId, trackEvent } from '@/lib/amplitude';
import { reportOperationalError } from '@/lib/operational-error-reporting';
import { queryClient } from '@/lib/query-client';
import { setAccountStateTag, type AccountStateTag } from '@/lib/sentry';

/**
 * Sentry 이벤트에 붙일 계정 상태. `null`은 전환 중이라 직전 값을 그대로 둔다는 뜻이다 —
 * 로그인·가입 도중의 실패는 "누가 로그인하다 실패했나"(게스트였나, 로그아웃 상태였나)가 단서다.
 */
const ACCOUNT_STATE_TAG_BY_STATUS = {
  authenticated: 'member',
  consent: 'member',
  guest: 'guest',
  noSession: 'none',
  accountInactive: 'none',
  accountWithdrawn: 'none',
  idle: null,
  restoring: null,
  signingIn: null,
  submittingProof: null,
  activatingSession: null,
  signingUp: null,
  mergeRequired: null,
  findingAccount: null,
  loginError: null,
  error: null,
} satisfies Record<AuthCoordinatorState['status'], AccountStateTag | null>;

function toAccountStateTag(status: AuthCoordinatorState['status']): AccountStateTag | null {
  return ACCOUNT_STATE_TAG_BY_STATUS[status];
}

/** 추천 코드 적용 결과를 분석에 남기고, 앱이 잘못 보내 반복하면 안 되는 오류만 보고한다. */
function recordReferralDecision(decision: ReferralDecision, cause: unknown): void {
  if (decision.kind === 'applied') {
    trackEvent({ name: 'referral_applied' });
    return;
  }
  trackEvent({ name: 'referral_apply_failed', properties: { reason: decision.reason } });
  if (decision.kind === 'dropped' && decision.reason === 'unexpected')
    reportOperationalError({ code: 'REFERRAL_FAILED', stage: 'apply', cause });
}

/**
 * 로그인 화면(또는 그 직전 안내)에 왔는가. 앱 안에 계정 전환이 없어 다른 계정은 반드시 여기를 거친다 —
 * 그래서 결제용 ID를 비우는 기준으로 쓴다(2026-10-13 결정). 비활성·탈퇴 안내는 확인 뒤 로그인 화면으로 간다.
 */
const IS_LOGIN_SCREEN_BY_STATUS = {
  noSession: true,
  guest: true,
  accountInactive: true,
  accountWithdrawn: true,
  authenticated: false,
  consent: false,
  idle: false,
  restoring: false,
  signingIn: false,
  submittingProof: false,
  activatingSession: false,
  signingUp: false,
  mergeRequired: false,
  findingAccount: false,
  loginError: false,
  error: false,
} satisfies Record<AuthCoordinatorState['status'], boolean>;

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
    // 정리는 아래 구독이 시작한다. 안내의 확인이 호출할 때는 이미 정의돼 있다.
    waitForWithdrawnCleanup: () => clearingWithdrawnDevice ?? Promise.resolve(),
    // 아래에서 만든다. 로그아웃이 호출할 때는 이미 정의돼 있다.
    unregisterPushDevice: () => push.unregister(),
  });
  const api = createAuthenticatedApiClient(session);
  const push = createPushRegistration({
    apiFetch: api.apiFetch,
    hasSession: () => session.getSession() !== null,
  });
  const purchaseIdentity = createPurchaseIdentity({
    requestRef: () => requestPurchaseAccountRefId(api.billingFetch),
    readStored: readStoredPurchaseAccountRef,
    store: storePurchaseAccountRef,
    clearStored: clearStoredPurchaseAccountRef,
    // 분석 사용자도 결제용 ID로 맞춘다(2026-10-20 결정). RevenueCat 로그인 성공과 상관없이 ID는 유효하다.
    logInStore: (purchaseAccountRef) => {
      setAnalyticsUserId(purchaseAccountRef);
      return logInStoreCustomer(purchaseAccountRef);
    },
    logOutStore: () => {
      resetAnalyticsUser();
      return logOutStoreCustomer();
    },
  });
  const paymentSync = createPaymentSync({
    request: (request) => requestPaymentSync(api.billingFetch, request),
    readPending: readPendingPaymentSyncs,
    writePending: writePendingPaymentSyncs,
  });
  const referral = createReferralApplication({
    request: (request) => applyReferralCode(api.billingFetch, request),
    readPending: readPendingReferral,
    writePending: writePendingReferral,
    getCurrentUid: options.firebaseSdk.getCurrentUid,
    preparePurchaseAccount: () => purchaseIdentity.ensure(),
    onDecided: recordReferralDecision,
  });
  const isAuthenticated = () => coordinator.getState().state.status === 'authenticated';
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
    if (state !== 'active') return;
    session.retryPersistence();
    // 복귀마다 권한을 보고한다. 토큰이 몇 달씩 그대로라 바뀔 때만 보내면 30일 미보고로 빠진다(2026-10-08 결정).
    if (isAuthenticated()) void push.sync();
  });
  // 콜드 스타트 복원·로그인·가입 완료는 모두 authenticated로 들어온다. 서버는 이 PUT으로 계정 연결을 안다.
  const stopPushOnAuthenticated = coordinator.subscribe((snapshot, previous) => {
    if (snapshot.state.status === 'authenticated' && previous.state.status !== 'authenticated')
      void push.sync();
  });
  // 결제용 ID는 로그인·세션 복원 때 미리 받고, 확인을 끝내지 못한 결제를 다시 확인한다. 로그인 화면에 오면
  // 둘 다 비운다 — 다른 계정으로 보내지 않는다. 실패는 결제 화면이 다시 받는다. 결론 나지 않은 시험 생성
  // 키와 적용하지 못한 추천 코드도 같은 이유로 비운다(추천 코드는 2026-10-29 D9 결정).
  const stopPurchaseIdentity = coordinator.subscribe((snapshot, previous) => {
    const { status } = snapshot.state;
    if (status === previous.state.status) return;
    if (status === 'authenticated') {
      void purchaseIdentity
        .ensure()
        .then((ref) => paymentSync.resume(ref))
        .catch(() => undefined);
    } else if (IS_LOGIN_SCREEN_BY_STATUS[status]) {
      forgetExamCreationKey();
      void paymentSync.clear();
      void purchaseIdentity.reset();
      void referral.clear();
    }
  });
  // 전환 중 상태(로그인·가입 진행 등)에서는 직전 계정 상태를 유지한다.
  const stopAccountStateTag = coordinator.subscribe((snapshot) => {
    const accountState = toAccountStateTag(snapshot.state.status);
    if (accountState) setAccountStateTag(accountState);
  });
  const stopPushTokenRefresh = observePushTokenRefresh(() => {
    if (isAuthenticated()) void push.sync();
  });
  const stopRecovery = observeAuthForegroundRecovery({
    getState: coordinator.getForegroundRecoveryState,
    subscribe: coordinator.subscribe,
    retry: coordinator.retry,
  });
  /**
   * 가입을 마쳤다. 세션을 활성화하기 전에 기기에 남긴다 — 홈이 보이자마자 읽는다. 추천 코드는 이 Firebase
   * 사용자와 함께 두고 홈이 보낸다(2026-10-29 D2·D4 결정). 병합은 이 경로를 지나지 않아 코드를 보내지 않는다.
   * 던지지 않는다 — 가입 완료를 막지 않는다.
   */
  async function rememberEnrollment(enrollment: IdentityEnrollment, uid: string): Promise<void> {
    const { referralCode } = coordinator.signupDraft.getState();
    if (checkReferralCodeFormat(referralCode) !== 'valid') return;
    trackEvent({
      name: 'referral_code_entered',
      properties: { signupPath: enrollment.origin === 'guest' ? 'guest-upgrade' : 'direct' },
    });
    await referral.remember({ uid, code: referralCode });
  }
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
    const onComplete = async (session: AuthSession) => {
      await rememberEnrollment(input.enrollment, input.uid);
      await input.onComplete(session);
    };
    const phone = createSignupPhoneVerification({
      uid: input.uid,
      draftStore: coordinator.signupDraft,
      // 흐름은 전화 인증 컨트롤러를 받아 만들어지므로 호출 시점에 참조한다.
      onReauthRequired: () => flow.requireSignInAgain(),
      isDirectSignup: input.enrollment.origin !== 'guest',
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
            onComplete,
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
            onComplete,
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
        if (result.kind !== 'withdrawn') return result;
        try {
          await session.endWithdrawnSession();
        } catch {
          // 탈퇴는 서버에서 확정됐다. 정리·알림이 실패해도 재시도할 실패로 돌리지 않는다.
          // 남은 기기 세션은 다음 요청의 재발급이 ACCOUNT_WITHDRAWN으로 정리한다.
        }
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
    stopPushOnAuthenticated();
    stopPurchaseIdentity();
    stopAccountStateTag();
    stopPushTokenRefresh();
    appState.remove();
    session.dispose();
  };

  return {
    session,
    consent,
    coordinator,
    api,
    push,
    purchaseIdentity,
    paymentSync,
    referral,
    mergeProgress,
    lastLoginProvider,
    startEnrollment,
    startMerge,
    startAccountRecovery,
    withdraw,
    dispose,
  };
}
