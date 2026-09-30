import { createStore } from 'zustand/vanilla';

import type { PolicyVersions } from '@/features/auth/api/get-policy-versions';
import type { FirebaseSignupRequest } from '@/features/auth/api/submit-firebase-signup';
import {
  observeAuthForegroundRecovery,
  type AuthForegroundRecoveryState,
} from '@/features/auth/auth-foreground-recovery';
import { AUTH_RECOVERY_MESSAGES, classifyAuthRecovery } from '@/features/auth/auth-recovery';
import type { FirebaseProofResult } from '@/features/auth/firebase-auth-types';
import type {
  IdentityEnrollment,
  IdentityExchangeResult,
} from '@/features/auth/identity-login-types';
import type { createSignupDraftStore } from '@/features/auth/signup-draft-store';
import type { AuthSession } from '@/features/auth/types';
import { ApiError } from '@/lib/api/transport';

export type SignupStep = 'nickname' | 'consents' | 'phone';

/**
 * retry: 같은 제출을 다시 시도 / edit: 입력을 고치러 첫 단계로
 * sign-in-again: SNS 로그인부터 다시 / exit: 가입을 멈추고 로그인 화면으로
 */
export type SignupFailureAction = 'retry' | 'edit' | 'sign-in-again' | 'exit';

export type SignupFlowState =
  | { status: 'editing'; step: 'nickname' }
  | { status: 'editing'; step: 'consents'; policies: 'loading' | 'ready' }
  | { status: 'editing'; step: 'phone' }
  | { status: 'policyUnavailable'; message: string }
  | { status: 'submitting'; step: SignupStep }
  | {
      status: 'failed';
      step: SignupStep;
      message: string;
      nextAction: SignupFailureAction;
    };

// 세션 저장 재시도와 같은 방식(지연 + 20% 지터)이며 간격만 약관 조회에 맞췄다.
const POLICY_RETRY_DELAYS_MS = [5_000, 10_000, 20_000] as const;
// 입력 검증 실패로 볼 HTTP 상태. 계약에 입력 검증 오류 code가 없어 상태로만 구분한다.
const INPUT_ERROR_STATUSES: readonly number[] = [400, 422];
const NICKNAME_MIN_LENGTH = 2;
const NICKNAME_MAX_LENGTH = 20;

const SIGNUP_MESSAGES = {
  policyUnavailable: '약관 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
  signInAgain: '로그인 확인이 필요해요. SNS 로그인부터 다시 진행해 주세요.',
  withdrawalPending: '이전 탈퇴 처리가 아직 끝나지 않았어요. 잠시 후 다시 가입해 주세요.',
  invalidInput: '가입 정보를 확인하지 못했어요. 입력한 내용을 확인한 뒤 다시 시도해 주세요.',
  phoneRequired: '휴대전화 인증을 다시 진행해 주세요.',
  unexpected: '가입을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.',
} as const;

/**
 * 닉네임·약관은 signup body에 항상 필요하고 이를 서버에 보내는 API가 signup뿐이라 항상 받는다.
 * 요구사항에 따라 건너뛰는 단계는 전화 인증뿐이다(이미 Firebase 사용자에 번호가 연결된 경우).
 */
export function resolveSignupSteps(enrollment: IdentityEnrollment): SignupStep[] {
  return enrollment.missingRequirements.includes('PHONE_VERIFICATION')
    ? ['nickname', 'consents', 'phone']
    : ['nickname', 'consents'];
}

export function isSignupNicknameValid(nickname: string): boolean {
  const length = Array.from(nickname.trim()).length;
  return length >= NICKNAME_MIN_LENGTH && length <= NICKNAME_MAX_LENGTH;
}

export type SignupFailure = { message: string; nextAction: SignupFailureAction };

/** 이번 제출에서 이미 한 번씩 써 버린 자동 복구. 같은 복구를 반복하지 않는 기준이다. */
export type SignupSubmitAttempts = { proofRetried: boolean; restarted: boolean };

/**
 * resubmit: 증명을 다시 강제 갱신해 같은 enrollment로 제출
 * restart-enrollment: 같은 ID를 버리고 exchange로 새 enrollment를 받아 제출
 * phone-required: 전화 인증을 처음부터 다시 받는다
 */
export type SignupSubmitDecision =
  | { kind: 'resubmit' }
  | { kind: 'restart-enrollment' }
  | { kind: 'phone-required' }
  | ({ kind: 'fail' } & SignupFailure);

/** 만료·enrollment 충돌 공통. 재시작은 제출 한 번에 한 번만 한다. */
export function resolveEnrollmentRestart(attempts: SignupSubmitAttempts): SignupSubmitDecision {
  return attempts.restarted
    ? { kind: 'fail', message: SIGNUP_MESSAGES.unexpected, nextAction: 'retry' }
    : { kind: 'restart-enrollment' };
}

/** code로 구분되지 않는 요청 실패(입력 검증·연결·서버 장애 등). */
export function resolveSignupRequestFailure(error: unknown): SignupFailure {
  if (error instanceof ApiError && INPUT_ERROR_STATUSES.includes(error.status)) {
    // 닉네임 형식·약관 버전 불일치 등. 서버 오류 code가 확정되면 해당 단계로 좁힌다.
    // 그 밖의 4xx(404·401 등)는 입력을 고쳐도 해결되지 않으므로 아래 복구 분류를 따른다.
    return { message: SIGNUP_MESSAGES.invalidInput, nextAction: 'edit' };
  }
  const recovery = classifyAuthRecovery(error);
  return recovery.action === 'retry'
    ? { message: AUTH_RECOVERY_MESSAGES[recovery.reason], nextAction: 'retry' }
    : { message: SIGNUP_MESSAGES.unexpected, nextAction: 'exit' };
}

export function resolveSignupProofFailure(
  proof: Exclude<FirebaseProofResult, { kind: 'proof-ready' }>,
): SignupFailure {
  if (proof.kind === 'failed' && proof.nextAction === 'retry')
    return { message: AUTH_RECOVERY_MESSAGES.connection, nextAction: 'retry' };
  if (proof.kind === 'failed' && proof.nextAction === 'get-help')
    return { message: SIGNUP_MESSAGES.unexpected, nextAction: 'exit' };
  // 강제 갱신을 못 하면 같은 Firebase 사용자를 더 이상 증명할 수 없다.
  return { message: SIGNUP_MESSAGES.signInAgain, nextAction: 'sign-in-again' };
}

/** signup 실패를 다음 행동으로 바꾼다. 서버 code는 열린 집합이라 알 수 없는 값은 요청 실패로 분류한다. */
export function resolveSignupSubmitFailure(
  error: unknown,
  attempts: SignupSubmitAttempts,
): SignupSubmitDecision {
  const code = error instanceof ApiError ? error.code : undefined;
  switch (code) {
    case 'INVALID_FIREBASE_ID_TOKEN':
      // 계약: 강제 갱신 후 한 번만 다시 제출하고, 또 실패하면 SNS 재로그인.
      return attempts.proofRetried
        ? { kind: 'fail', message: SIGNUP_MESSAGES.signInAgain, nextAction: 'sign-in-again' }
        : { kind: 'resubmit' };
    case 'FIREBASE_RECENT_AUTH_REQUIRED':
      return { kind: 'fail', message: SIGNUP_MESSAGES.signInAgain, nextAction: 'sign-in-again' };
    case 'FIREBASE_PHONE_VERIFICATION_REQUIRED':
      return { kind: 'phone-required' };
    case 'FIREBASE_ENROLLMENT_CONFLICT':
    case 'FIREBASE_ENROLLMENT_RESTART_REQUIRED':
      return resolveEnrollmentRestart(attempts);
    case 'WITHDRAWAL_CLEANUP_PENDING':
      // 자동 재시도하지 않는다. 정리가 끝난 뒤 사용자가 다시 시작한다.
      return { kind: 'fail', message: SIGNUP_MESSAGES.withdrawalPending, nextAction: 'exit' };
    default:
      return { kind: 'fail', ...resolveSignupRequestFailure(error) };
  }
}

interface SignupPhoneVerificationPort {
  isVerified: () => boolean;
  reset: (message?: string | null) => void;
  dispose: () => void;
}

export interface SignupFlowDependencies {
  /** 같은 Firebase 사용자의 ID Token을 강제 갱신한다. */
  refreshProof: (uid: string) => Promise<FirebaseProofResult>;
  exchange: (proof: string, signal?: AbortSignal) => Promise<IdentityExchangeResult>;
  submit: (request: FirebaseSignupRequest, signal?: AbortSignal) => Promise<AuthSession>;
  loadPolicyVersions: (signal?: AbortSignal) => Promise<PolicyVersions>;
}

/**
 * direct signup 한 번의 흐름을 소유한다. 코디네이터는 진입(signingUp)과 출구(onComplete/onCancel)만 맡는다.
 * 화면이 사라지면 소유자가 dispose해 늦게 도착한 응답을 무시한다.
 */
export function createSignupFlow(options: {
  enrollment: IdentityEnrollment;
  uid: string;
  draftStore: ReturnType<typeof createSignupDraftStore>;
  phone: SignupPhoneVerificationPort;
  dependencies: SignupFlowDependencies;
  onComplete: (session: AuthSession) => Promise<void>;
}) {
  const { uid, draftStore, phone, dependencies } = options;
  let enrollment = options.enrollment;
  let steps = resolveSignupSteps(enrollment);
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

  /** 약관 화면에 들어올 때마다 부른다. 버전이 같으면 초안의 기존 동의가 유지된다. */
  async function loadPolicies(current: number, attempt: number): Promise<void> {
    try {
      const versions = await dependencies.loadPolicyVersions(abort.signal);
      if (!isCurrent(current)) return;
      draftStore.setPolicyVersions(versions);
      setState({ status: 'editing', step: 'consents', policies: 'ready' });
    } catch (error) {
      if (!isCurrent(current)) return;
      const delay = POLICY_RETRY_DELAYS_MS[attempt];
      if (classifyAuthRecovery(error).action !== 'retry' || delay === undefined) {
        setState({ status: 'policyUnavailable', message: SIGNUP_MESSAGES.policyUnavailable });
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

  function hasRequiredConsents(): boolean {
    const { consents } = draftStore.getState();
    return consents.terms.agreed && consents.privacy.agreed;
  }

  function completeConsents(): void {
    const { state } = store.getState();
    if (
      state.status !== 'editing' ||
      state.step !== 'consents' ||
      state.policies !== 'ready' ||
      !hasRequiredConsents()
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

  function fail(step: SignupStep, failure: SignupFailure): void {
    setState({ status: 'failed', step, ...failure });
  }

  /**
   * 만료·enrollment 충돌 시 같은 ID를 재사용하지 않고 exchange부터 다시 받는다. 입력 초안은 유지한다.
   * 'continue'면 새 enrollment로 제출을 이어간다. 그 밖에는 이 함수가 다음 상태를 정했다.
   */
  async function restartEnrollment(
    current: number,
    step: SignupStep,
  ): Promise<'continue' | 'stop'> {
    const proof = await dependencies.refreshProof(uid);
    if (!isCurrent(current)) return 'stop';
    if (proof.kind !== 'proof-ready') {
      fail(step, resolveSignupProofFailure(proof));
      return 'stop';
    }
    try {
      const result = await dependencies.exchange(proof.firebaseIdToken, abort.signal);
      if (!isCurrent(current)) return 'stop';
      if (result.kind === 'authenticated') {
        // 이전 제출이 서버에서 성공했지만 응답을 받지 못한 경우다.
        await options.onComplete(result.session);
        return 'stop';
      }
      enrollment = result.enrollment;
      steps = resolveSignupSteps(enrollment);
      if (steps.includes('phone') && !phone.isVerified()) {
        goTo('phone');
        return 'stop';
      }
      return 'continue';
    } catch (error) {
      if (isCurrent(current)) fail(step, resolveSignupRequestFailure(error));
      return 'stop';
    }
  }

  /** 판단 함수가 고른 행동을 실행한다. 'continue'면 제출 루프를 이어간다. */
  async function carryOut(
    decision: SignupSubmitDecision,
    attempts: SignupSubmitAttempts,
    current: number,
    step: SignupStep,
  ): Promise<'continue' | 'stop'> {
    switch (decision.kind) {
      case 'resubmit':
        attempts.proofRetried = true;
        return 'continue';
      case 'restart-enrollment':
        attempts.restarted = true;
        return restartEnrollment(current, step);
      case 'phone-required':
        if (!steps.includes('phone')) steps = [...steps, 'phone'];
        phone.reset(SIGNUP_MESSAGES.phoneRequired);
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
    const attempts: SignupSubmitAttempts = { proofRetried: false, restarted: false };

    for (;;) {
      if (Date.now() >= enrollment.expiresAt) {
        const decision = resolveEnrollmentRestart(attempts);
        if ((await carryOut(decision, attempts, current, step)) === 'stop') return;
      }

      const draft = draftStore.getState();
      const { terms, privacy } = draft.consents;
      if (!terms.agreed || !privacy.agreed || !isSignupNicknameValid(draft.nickname)) {
        goTo(isSignupNicknameValid(draft.nickname) ? 'consents' : 'nickname');
        return;
      }

      const proof = await dependencies.refreshProof(uid);
      if (!isCurrent(current)) return;
      if (proof.kind !== 'proof-ready') {
        fail(step, resolveSignupProofFailure(proof));
        return;
      }

      try {
        const session = await dependencies.submit(
          {
            enrollmentId: enrollment.enrollmentId,
            firebaseIdToken: proof.firebaseIdToken,
            nickname: draft.nickname.trim(),
            privacyConsentVersion: privacy.version,
            termConsentVersion: terms.version,
          },
          abort.signal,
        );
        if (!isCurrent(current)) return;
        await options.onComplete(session);
        return;
      } catch (error) {
        if (!isCurrent(current)) return;
        const decision = resolveSignupSubmitFailure(error, attempts);
        if ((await carryOut(decision, attempts, current, step)) === 'stop') return;
      }
    }
  }

  /** 전화 인증 중 Firebase 사용자가 바뀌었거나 재인증이 필요할 때. */
  function requireSignInAgain(): void {
    if (disposed) return;
    const { state } = store.getState();
    const step = state.status === 'policyUnavailable' ? 'consents' : state.step;
    run += 1;
    clearPolicyTimer();
    fail(step, { message: SIGNUP_MESSAGES.signInAgain, nextAction: 'sign-in-again' });
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
    throw new Error(`처리하지 않은 가입 실패 행동: ${unhandled}`);
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
