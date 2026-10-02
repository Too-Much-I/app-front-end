import { createStore } from 'zustand/vanilla';

import type { PolicyVersions } from '@/features/auth/api/get-policy-versions';
import type { GuestUpgradeRequest } from '@/features/auth/api/submit-guest-upgrade';
import {
  observeAuthForegroundRecovery,
  type AuthForegroundRecoveryState,
} from '@/features/auth/auth-foreground-recovery';
import { classifyAuthRecovery } from '@/features/auth/auth-recovery';
import type { FirebaseProofResult } from '@/features/auth/firebase-auth-types';
import type {
  GuestIdentityEnrollment,
  IdentityExchangeResult,
  IdentityGuestPreparationResult,
} from '@/features/auth/identity-login-types';
import type { createSignupDraftStore } from '@/features/auth/signup-draft-store';
import {
  decideProofFailureNotice,
  decideRequestFailureNotice,
  decideSignupSteps,
  isSignupNicknameValid,
  type SignupFailureNotice,
  type SignupFlowState,
  type SignupStep,
} from '@/features/auth/signup-flow';
import type { AuthSession, RequestAuthSnapshot } from '@/features/auth/types';
import { ApiError, TransportConnectionError } from '@/lib/api/transport';

// 가입 흐름과 같은 약관 조회 간격이다(지연 + 20% 지터).
const POLICY_RETRY_DELAYS_MS = [5_000, 10_000, 20_000] as const;
// 서버 표가 처리를 정해 둔 5xx. 나머지 5xx는 서버가 처리했는지 알 수 없다.
const DEFINED_SERVER_ERROR_CODES: readonly string[] = [
  'FIREBASE_UNAVAILABLE',
  'SESSION_SECURITY_UNAVAILABLE',
];

const GUEST_UPGRADE_MESSAGES = {
  policyUnavailable: '약관 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
  signInAgain: '로그인 확인이 필요해요. SNS 로그인부터 다시 진행해 주세요.',
  withdrawalPending: '이전 탈퇴 처리가 아직 끝나지 않았어요. 잠시 후 다시 가입해 주세요.',
  phoneRequired: '휴대전화 인증을 다시 진행해 주세요.',
  unexpected: '가입을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.',
  outcomeUnknown: '가입 결과를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
  identityConflict: '계정 상태를 확인하지 못했어요. 문제가 계속되면 도움을 요청해 주세요.',
  activationFailed: '가입은 완료됐어요. 로그인 화면에서 같은 SNS 계정으로 다시 로그인해 주세요.',
} as const;

/** 이번 제출에서 이미 한 번씩 써 버린 자동 복구. 같은 복구를 반복하지 않는 기준이다. */
export type GuestUpgradeAttempts = {
  proofRetried: boolean;
  restarted: boolean;
  reconciled: boolean;
};

/**
 * resubmit: 증명을 다시 강제 갱신해 같은 enrollment로 제출
 * restart-enrollment: 같은 ID를 버리고 prepare로 새 enrollment를 받아 제출(direct signup으로 우회하지 않음)
 * reconcile: 결과를 모르므로 exchange와 Guest 토큰 prepare로 승격 여부를 판별
 * merge-required: 이 SNS 계정은 다른 MEMBER 소유다
 */
export type GuestUpgradeRecoveryDecision =
  | { kind: 'resubmit' }
  | { kind: 'restart-enrollment' }
  | { kind: 'phone-required' }
  | { kind: 'reconcile' }
  | { kind: 'merge-required' }
  | ({ kind: 'fail' } & SignupFailureNotice);

/**
 * 응답을 받지 못했거나 서버가 처리 후 실패했을 수 있는 오류. 실패를 "불명"으로 잘못 보면 조회가 한 번
 * 늘 뿐이지만, 불명을 실패로 잘못 보면 이미 성공한 승격을 놓친다. 그래서 애매하면 불명으로 본다.
 */
export function isUpgradeOutcomeUnknown(error: unknown): boolean {
  if (error instanceof TransportConnectionError) return true;
  return (
    error instanceof ApiError &&
    error.status >= 500 &&
    !DEFINED_SERVER_ERROR_CODES.includes(error.code ?? '')
  );
}

/**
 * 만료·enrollment 충돌 공통. 충돌·만료로 인한 재시작은 제출 한 번에 한 번만 한다.
 * 판별(`reconcile`)에서 "승격되지 않음"을 확인해 다시 받는 재시작은 이 횟수에 넣지 않는다.
 * 그래서 한 제출에서 재시작은 최대 두 번(판별 뒤 한 번 + 충돌·만료 한 번)이다.
 */
export function decideGuestIdentityEnrollmentRestart(
  attempts: GuestUpgradeAttempts,
): GuestUpgradeRecoveryDecision {
  return attempts.restarted
    ? { kind: 'fail', message: GUEST_UPGRADE_MESSAGES.unexpected, nextAction: 'retry' }
    : { kind: 'restart-enrollment' };
}

/** upgrade 요청 실패의 다음 행동. 서버 code는 열린 집합이라 알 수 없는 값은 요청 실패로 분류한다. */
export function decideGuestUpgradeRecovery(
  error: unknown,
  attempts: GuestUpgradeAttempts,
): GuestUpgradeRecoveryDecision {
  const code = error instanceof ApiError ? error.code : undefined;
  switch (code) {
    case 'INVALID_FIREBASE_ID_TOKEN':
      return attempts.proofRetried
        ? { kind: 'fail', message: GUEST_UPGRADE_MESSAGES.signInAgain, nextAction: 'sign-in-again' }
        : { kind: 'resubmit' };
    case 'FIREBASE_RECENT_AUTH_REQUIRED':
      return {
        kind: 'fail',
        message: GUEST_UPGRADE_MESSAGES.signInAgain,
        nextAction: 'sign-in-again',
      };
    case 'FIREBASE_PHONE_VERIFICATION_REQUIRED':
      return { kind: 'phone-required' };
    case 'FIREBASE_ENROLLMENT_CONFLICT':
    case 'FIREBASE_ENROLLMENT_RESTART_REQUIRED':
      return decideGuestIdentityEnrollmentRestart(attempts);
    case 'MERGE_REQUIRED':
      return { kind: 'merge-required' };
    case 'GUEST_UPGRADE_NOT_ALLOWED':
      // 현재 사용자가 ACTIVE GUEST가 아니다. 이전 승격이 이미 성공했을 수 있어 상태를 다시 조회한다.
      return decideReconcile(attempts);
    case 'IDENTITY_STATE_CONFLICT':
      // 계약: 자동 승격·병합 금지. 재인증 후에도 반복되면 지원 안내.
      return { kind: 'fail', message: GUEST_UPGRADE_MESSAGES.identityConflict, nextAction: 'exit' };
    case 'WITHDRAWAL_CLEANUP_PENDING':
      return {
        kind: 'fail',
        message: GUEST_UPGRADE_MESSAGES.withdrawalPending,
        nextAction: 'exit',
      };
    default:
      if (isUpgradeOutcomeUnknown(error)) return decideReconcile(attempts);
      return { kind: 'fail', ...decideRequestFailureNotice(error) };
  }
}

/** 판별은 제출 한 번에 한 번만 자동으로 한다. 그 뒤는 사용자의 수동 재시도다. */
function decideReconcile(attempts: GuestUpgradeAttempts): GuestUpgradeRecoveryDecision {
  return attempts.reconciled
    ? { kind: 'fail', message: GUEST_UPGRADE_MESSAGES.outcomeUnknown, nextAction: 'retry' }
    : { kind: 'reconcile' };
}

interface GuestUpgradePhoneVerificationPort {
  isVerified: () => boolean;
  reset: (message?: string | null) => void;
  dispose: () => void;
}

export interface GuestUpgradeFlowDependencies {
  /** 같은 Firebase 사용자의 ID Token을 강제 갱신한다. */
  refreshProof: (uid: string) => Promise<FirebaseProofResult>;
  /** 현재 Guest Access Token. 만료가 가까우면 세션 컨트롤러가 먼저 재발급한다. */
  prepareRequest: () => Promise<RequestAuthSnapshot>;
  prepare: (
    proof: string,
    guestToken: string,
    signal?: AbortSignal,
  ) => Promise<IdentityGuestPreparationResult>;
  exchange: (proof: string, signal?: AbortSignal) => Promise<IdentityExchangeResult>;
  submit: (
    request: GuestUpgradeRequest,
    guestToken: string,
    signal?: AbortSignal,
  ) => Promise<AuthSession>;
  /** 품질 검토 version만 쓴다. 필수 약관 version은 prepare 응답 값을 유지한다. */
  loadPolicyVersions: (signal?: AbortSignal) => Promise<PolicyVersions>;
}

/**
 * 기존 Guest의 MEMBER 승격 한 번의 흐름. 가입 흐름과 같은 화면을 쓰도록 같은 상태·액션 모양을 갖는다.
 * 코디네이터는 진입(signingUp)과 출구(onComplete, onMergeRequired, onCancel)만 맡는다.
 * 화면이 사라지면 소유자가 dispose해 늦게 도착한 응답을 무시한다.
 */
export function createGuestUpgradeFlow(options: {
  enrollment: GuestIdentityEnrollment;
  uid: string;
  draftStore: ReturnType<typeof createSignupDraftStore>;
  phone: GuestUpgradePhoneVerificationPort;
  dependencies: GuestUpgradeFlowDependencies;
  onComplete: (session: AuthSession) => Promise<void>;
  onMergeRequired: () => void;
}) {
  const { uid, draftStore, phone, dependencies } = options;
  let enrollment = options.enrollment;
  let steps = decideSignupSteps(enrollment);
  const store = createStore<{ state: SignupFlowState }>(() => ({
    state: { status: 'editing', step: 'nickname' },
  }));
  const abort = new AbortController();
  // 단계를 옮기거나 제출을 다시 시작하면 올라간다. 이전 작업의 늦은 결과를 버리는 기준이다.
  let run = 0;
  let policyTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const isCurrent = (value: number) => !disposed && value === run;
  const setState = (state: SignupFlowState) => store.setState({ state });

  function clearPolicyTimer(): void {
    if (policyTimer !== null) clearTimeout(policyTimer);
    policyTimer = null;
  }

  function goTo(step: SignupStep): void {
    run += 1;
    clearPolicyTimer();
    if (step === 'consents') {
      setState({ status: 'editing', step: 'consents', policies: 'loading' });
      void loadPolicies(run, 0);
      return;
    }
    setState({ status: 'editing', step });
  }

  /** 필수 약관은 prepare 응답을 쓴다. 공개 API에서는 품질 검토 version만 가져온다. */
  async function loadPolicies(current: number, attempt: number): Promise<void> {
    try {
      const versions = await dependencies.loadPolicyVersions(abort.signal);
      if (!isCurrent(current)) return;
      draftStore.setPolicyVersions({
        terms: enrollment.termConsentVersion,
        privacy: enrollment.privacyConsentVersion,
        qualityReview: versions.qualityReview,
      });
      setState({ status: 'editing', step: 'consents', policies: 'ready' });
    } catch (error) {
      if (!isCurrent(current)) return;
      const delay = POLICY_RETRY_DELAYS_MS[attempt];
      if (classifyAuthRecovery(error).action !== 'retry' || delay === undefined) {
        setState({
          status: 'policyUnavailable',
          message: GUEST_UPGRADE_MESSAGES.policyUnavailable,
        });
        return;
      }
      policyTimer = setTimeout(
        () => {
          policyTimer = null;
          if (isCurrent(current)) void loadPolicies(current, attempt + 1);
        },
        delay + Math.floor(Math.random() * delay * 0.2),
      );
    }
  }

  function retryPolicies(): Promise<void> {
    if (store.getState().state.status === 'policyUnavailable') goTo('consents');
    return Promise.resolve();
  }

  function advanceFrom(step: SignupStep): void {
    const next = steps[steps.indexOf(step) + 1];
    if (next) goTo(next);
    else void submit(step);
  }

  function isEditing(step: SignupStep): boolean {
    const { state } = store.getState();
    return state.status === 'editing' && state.step === step;
  }

  function completeNickname(): void {
    if (!isEditing('nickname') || !isSignupNicknameValid(draftStore.getState().nickname)) return;
    advanceFrom('nickname');
  }

  function completeConsents(): void {
    const { state } = store.getState();
    const { consents } = draftStore.getState();
    if (
      state.status !== 'editing' ||
      state.step !== 'consents' ||
      state.policies !== 'ready' ||
      !consents.terms.agreed ||
      !consents.privacy.agreed
    )
      return;
    advanceFrom('consents');
  }

  function completePhoneVerification(): void {
    if (!isEditing('phone') || !phone.isVerified()) return;
    advanceFrom('phone');
  }

  /** 첫 단계면 'confirm-exit'을 돌려 화면이 경고 팝업을 띄우게 한다. */
  function goBack(): 'handled' | 'confirm-exit' {
    const { state } = store.getState();
    switch (state.status) {
      case 'submitting':
        return 'handled';
      case 'failed':
        goTo(state.step);
        return 'handled';
      case 'policyUnavailable':
        goTo(steps[steps.indexOf('consents') - 1] ?? 'nickname');
        return 'handled';
      case 'editing': {
        const previous = steps[steps.indexOf(state.step) - 1];
        if (!previous) return 'confirm-exit';
        goTo(previous);
        return 'handled';
      }
    }
  }

  function fail(step: SignupStep, notice: SignupFailureNotice): void {
    setState({ status: 'failed', step, ...notice });
  }

  /** 서버가 발급한 MEMBER 세션을 코디네이터에 넘긴다. 승격 요청과 다른 try로 감싸 분류를 섞지 않는다. */
  async function complete(session: AuthSession, step: SignupStep): Promise<void> {
    try {
      await options.onComplete(session);
    } catch {
      if (!disposed)
        fail(step, {
          message: GUEST_UPGRADE_MESSAGES.activationFailed,
          nextAction: 'sign-in-again',
        });
    }
  }

  /** 새 enrollment의 필수 약관 version으로 바꾼다. 같으면 초안의 동의가 유지되고, 바뀌면 다시 받는다. */
  function applyEnrollment(next: GuestIdentityEnrollment): void {
    enrollment = next;
    steps = decideSignupSteps(next);
    draftStore.setPolicyVersions({
      terms: next.termConsentVersion,
      privacy: next.privacyConsentVersion,
      qualityReview: draftStore.getState().consents.qualityReview.version,
    });
  }

  /** prepare 결과를 반영한다. 'continue'면 새 enrollment로 제출을 이어간다. */
  function followPreparation(result: IdentityGuestPreparationResult): 'continue' | 'stop' {
    if (result.kind === 'merge-required') {
      options.onMergeRequired();
      return 'stop';
    }
    applyEnrollment(result.enrollment);
    if (steps.includes('phone') && !phone.isVerified()) {
      goTo('phone');
      return 'stop';
    }
    return 'continue';
  }

  /** prepare 요청 실패. 409 MERGE_REQUIRED는 결과와 같은 뜻이다. */
  function failPreparation(error: unknown, step: SignupStep): void {
    if (error instanceof ApiError && error.code === 'MERGE_REQUIRED') {
      options.onMergeRequired();
      return;
    }
    fail(step, decideRequestFailureNotice(error));
  }

  /** 만료·enrollment 충돌 시 같은 ID를 재사용하지 않고 prepare부터 다시 받는다. 입력 초안은 유지한다. */
  async function restartEnrollment(
    current: number,
    step: SignupStep,
  ): Promise<'continue' | 'stop'> {
    const proof = await dependencies.refreshProof(uid);
    if (!isCurrent(current)) return 'stop';
    if (proof.kind !== 'proof-ready') {
      fail(step, decideProofFailureNotice(proof));
      return 'stop';
    }
    let result: IdentityGuestPreparationResult;
    try {
      const guest = await dependencies.prepareRequest();
      if (!isCurrent(current)) return 'stop';
      result = await dependencies.prepare(proof.firebaseIdToken, guest.accessToken, abort.signal);
    } catch (error) {
      if (isCurrent(current)) failPreparation(error, step);
      return 'stop';
    }
    if (!isCurrent(current)) return 'stop';
    return followPreparation(result);
  }

  /**
   * 승격 결과를 모를 때 판별한다. exchange의 AUTHENTICATED는 "이 SNS 계정에 MEMBER가 있다"일 뿐이라
   * 바로 수락하지 않는다. 승격에 쓴 Guest 토큰으로 prepare를 불러 Guest가 아직 살아 있는지 본다.
   *   403 GUEST_UPGRADE_NOT_ALLOWED → Guest가 승격됨 = 내 승격 성공 → exchange 세션 수락
   *   MERGE_REQUIRED → Guest가 살아 있고 다른 MEMBER가 주인 → 병합
   *   ENROLLMENT_REQUIRED → 승격되지 않음 → 새 enrollment로 제출
   * exchange가 ENROLLMENT_REQUIRED면 승격되지 않은 것이다. direct signup이 아니라 prepare로 돌아간다.
   */
  async function reconcile(
    current: number,
    step: SignupStep,
    guestToken: string,
  ): Promise<'continue' | 'stop'> {
    const proof = await dependencies.refreshProof(uid);
    if (!isCurrent(current)) return 'stop';
    if (proof.kind !== 'proof-ready') {
      fail(step, decideProofFailureNotice(proof));
      return 'stop';
    }
    let exchanged: IdentityExchangeResult;
    try {
      exchanged = await dependencies.exchange(proof.firebaseIdToken, abort.signal);
    } catch (error) {
      if (isCurrent(current)) fail(step, decideRequestFailureNotice(error));
      return 'stop';
    }
    if (!isCurrent(current)) return 'stop';
    // 승격되지 않았으니 새 enrollment를 받는다. 충돌·만료 재시작 횟수(`attempts.restarted`)와 따로 센다.
    if (exchanged.kind === 'enrollment-required') return restartEnrollment(current, step);

    let result: IdentityGuestPreparationResult;
    try {
      result = await dependencies.prepare(proof.firebaseIdToken, guestToken, abort.signal);
    } catch (error) {
      if (!isCurrent(current)) return 'stop';
      if (error instanceof ApiError && error.code === 'GUEST_UPGRADE_NOT_ALLOWED') {
        await complete(exchanged.session, step);
        return 'stop';
      }
      failPreparation(error, step);
      return 'stop';
    }
    if (!isCurrent(current)) return 'stop';
    return followPreparation(result);
  }

  /** 판단 함수가 고른 행동을 실행한다. 'continue'면 제출 루프를 이어간다. */
  async function carryOut(
    decision: GuestUpgradeRecoveryDecision,
    attempts: GuestUpgradeAttempts,
    current: number,
    step: SignupStep,
    guestToken: string | null,
  ): Promise<'continue' | 'stop'> {
    switch (decision.kind) {
      case 'resubmit':
        attempts.proofRetried = true;
        return 'continue';
      case 'restart-enrollment':
        attempts.restarted = true;
        return restartEnrollment(current, step);
      case 'reconcile':
        attempts.reconciled = true;
        // 토큰 없이 판별할 수 없다. 제출 전에 실패한 경우라 일어나지 않지만 실패로 둔다.
        if (guestToken === null) {
          fail(step, { message: GUEST_UPGRADE_MESSAGES.outcomeUnknown, nextAction: 'retry' });
          return 'stop';
        }
        return reconcile(current, step, guestToken);
      case 'merge-required':
        options.onMergeRequired();
        return 'stop';
      case 'phone-required':
        if (!steps.includes('phone')) steps = [...steps, 'phone'];
        phone.reset(GUEST_UPGRADE_MESSAGES.phoneRequired);
        goTo('phone');
        return 'stop';
      case 'fail':
        fail(step, decision);
        return 'stop';
    }
  }

  async function submit(step: SignupStep): Promise<void> {
    if (store.getState().state.status === 'submitting') return;
    run += 1;
    const current = run;
    clearPolicyTimer();
    setState({ status: 'submitting', step });
    const attempts: GuestUpgradeAttempts = {
      proofRetried: false,
      restarted: false,
      reconciled: false,
    };

    for (;;) {
      if (Date.now() >= enrollment.expiresAt) {
        const decision = decideGuestIdentityEnrollmentRestart(attempts);
        if ((await carryOut(decision, attempts, current, step, null)) === 'stop') return;
      }

      const draft = draftStore.getState();
      const { terms, privacy, qualityReview } = draft.consents;
      if (
        !terms.agreed ||
        !privacy.agreed ||
        qualityReview.version === null ||
        !isSignupNicknameValid(draft.nickname)
      ) {
        goTo(isSignupNicknameValid(draft.nickname) ? 'consents' : 'nickname');
        return;
      }

      const proof = await dependencies.refreshProof(uid);
      if (!isCurrent(current)) return;
      if (proof.kind !== 'proof-ready') {
        fail(step, decideProofFailureNotice(proof));
        return;
      }

      let guest: RequestAuthSnapshot;
      try {
        guest = await dependencies.prepareRequest();
      } catch (error) {
        // Guest 세션이 무효면 세션 컨트롤러 알림으로 코디네이터가 흐름을 끝낸다.
        if (isCurrent(current)) fail(step, decideRequestFailureNotice(error));
        return;
      }
      if (!isCurrent(current)) return;

      let session: AuthSession;
      try {
        session = await dependencies.submit(
          {
            enrollmentId: enrollment.enrollmentId,
            firebaseIdToken: proof.firebaseIdToken,
            nickname: draft.nickname.trim(),
            privacyConsentVersion: privacy.version,
            termConsentVersion: terms.version,
            isQualityReviewConsented: qualityReview.agreed,
            qualityReviewConsentVersion: qualityReview.version,
          },
          guest.accessToken,
          abort.signal,
        );
      } catch (error) {
        if (!isCurrent(current)) return;
        const decision = decideGuestUpgradeRecovery(error, attempts);
        if ((await carryOut(decision, attempts, current, step, guest.accessToken)) === 'stop')
          return;
        continue;
      }
      if (!isCurrent(current)) return;
      await complete(session, step);
      return;
    }
  }

  /** 전화 인증 중 Firebase 사용자가 바뀌었거나 재인증이 필요할 때. */
  function requireSignInAgain(): void {
    if (disposed) return;
    const { state } = store.getState();
    const step = state.status === 'policyUnavailable' ? 'consents' : state.step;
    run += 1;
    clearPolicyTimer();
    fail(step, { message: GUEST_UPGRADE_MESSAGES.signInAgain, nextAction: 'sign-in-again' });
  }

  function retrySubmit(): void {
    const { state } = store.getState();
    if (state.status !== 'failed') return;
    switch (state.nextAction) {
      case 'retry':
        void submit(state.step);
        return;
      case 'edit':
        goTo(steps[0] ?? 'nickname');
        return;
      case 'sign-in-again':
      case 'exit':
        // 로그인 화면 복귀는 화면이 onCancel로 처리한다.
        return;
    }
    const unhandled: never = state.nextAction;
    throw new Error(`처리하지 않은 승격 실패 행동: ${unhandled}`);
  }

  function getForegroundRecoveryState(): AuthForegroundRecoveryState {
    const { state } = store.getState();
    if (state.status === 'policyUnavailable') return 'retryable';
    if (state.status === 'editing' && state.step === 'consents' && state.policies === 'loading')
      return 'busy';
    return 'settled';
  }

  // 약관 조회 오류 화면에 있는 동안 앱이 다시 활성화되면 한 번 더 조회한다.
  const stopForegroundRecovery = observeAuthForegroundRecovery({
    getState: getForegroundRecoveryState,
    subscribe: store.subscribe,
    retry: retryPolicies,
  });

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    abort.abort();
    clearPolicyTimer();
    stopForegroundRecovery();
    phone.dispose();
  }

  return {
    getState: store.getState,
    getInitialState: store.getInitialState,
    subscribe: store.subscribe,
    getSteps: () => steps,
    completeNickname,
    completeConsents,
    completePhoneVerification,
    goBack,
    retryPolicies,
    retrySubmit,
    requireSignInAgain,
    dispose,
  };
}
