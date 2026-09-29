import type { createFirebaseAuthController } from "@/features/auth/firebase-auth-controller";
import type { AuthForegroundRecoveryState } from "@/features/auth/auth-foreground-recovery";
import type {
  FirebaseLoginProvider,
  FirebaseProofResult,
} from "@/features/auth/firebase-auth-types";
import type {
  IdentityEnrollment,
  IdentityExchangeResult,
  IdentityGuestPreparationResult,
  IdentityLoginOrigin,
} from "@/features/auth/identity-login-types";
import type { AuthSession, RequestAuthSnapshot } from "@/features/auth/types";
import { ApiError } from "@/lib/api/transport";

import type { ServerConsentStatus } from "@/features/auth/types";
import { createStore } from "zustand/vanilla";

import {
  AUTH_RECOVERY_MESSAGES,
  classifyAuthRecovery,
} from "@/features/auth/auth-recovery";
import {
  SessionRequestError,
  type AuthRecoveryReason,
  type AuthSessionRestoreResult,
} from "@/features/auth/session-restoration-types";

/**
 * 인증 부트스트랩 상태와 복구 액션을 관리하는 코디네이터.
 *
 * 최초 실행: 앱 루트 useAuthBootstrap → coordinator.bootstrap()
 * 재시도: 오류 화면 버튼 → coordinator.retry()
 * 화면 선택: RootNavigator가 state를 구독해 결정한다.
 *
 * RootNavigator의 coordinator 진입점에서 루트 훅과 selector를 연결한다.
 * Firebase·Identity 흐름은 runtime에서 연결하며 App은 아직 기존 인증 경로를 사용한다.
 */

export type AuthCoordinatorState =
  | {
      status: "signingIn";
      origin: IdentityLoginOrigin;
      provider: FirebaseLoginProvider;
    }
  | { status: "submittingProof"; origin: IdentityLoginOrigin }
  | { status: "activatingSession" }
  | { status: "signingUp"; flowId: number; enrollment: IdentityEnrollment }
  | { status: "mergeRequired"; flowId: number }
  | {
      status: "loginError";
      origin: IdentityLoginOrigin;
      provider: FirebaseLoginProvider;
      message: string;
      nextAction: "retry" | "sign-in-again" | "get-help";
    }
  | { status: "idle" }
  | { status: "restoring" }
  | { status: "noSession" }
  | { status: "guest" }
  | { status: "authenticated" }
  | {
      status: "consent";
      requiredItems: { privacy: boolean; terms: boolean };
      qualityReviewConsented: boolean;
      submission:
        | { status: "idle" }
        | { status: "submitting" }
        | { status: "failed"; message: string };
    }
  | {
      status: "error";
      message: string;
      reason: AuthRecoveryReason;
      nextAction: "retry-session-restore" | "retry-consent-check" | "get-help";
      isRetrying: boolean;
    };

interface AuthSessionRestorer {
  restore: () => Promise<AuthSessionRestoreResult>;
}

function resolveAuthRestoration(
  result: AuthSessionRestoreResult,
): AuthCoordinatorState {
  switch (result.kind) {
    case "ready":
      switch (result.accountType) {
        case "MEMBER":
          return { status: "authenticated" };
        case "GUEST":
          // Guest 증명은 sessionController에 보존한 채 로그인 화면을 보여준다.
          return { status: "guest" };
      }
    case "login-required":
      return { status: "noSession" };
    case "recovery-required":
      return {
        status: "error",
        message: AUTH_RECOVERY_MESSAGES[result.reason],
        reason: result.reason,
        nextAction:
          result.action === "retry" ? "retry-session-restore" : "get-help",
        isRetrying: false,
      };
  }
}

interface MemberConsentGate {
  load: () => Promise<ServerConsentStatus>;
  accept: (qualityReview: boolean) => Promise<ServerConsentStatus>;
}

interface IdentityLoginDependencies {
  firebase: Pick<
    ReturnType<typeof createFirebaseAuthController>,
    "signIn" | "retry" | "cancel" | "refreshProof"
  >;
  session: {
    acceptSession: (
      session: AuthSession,
      signal?: AbortSignal,
    ) => Promise<boolean>;
    prepareRequest: () => Promise<RequestAuthSnapshot>;
  };
  exchange: (
    proof: string,
    signal?: AbortSignal,
  ) => Promise<IdentityExchangeResult>;
  prepare: (
    proof: string,
    guestToken: string,
    signal?: AbortSignal,
  ) => Promise<IdentityGuestPreparationResult>;
}

type IdentityAttempt = {
  origin: IdentityLoginOrigin;
  provider: FirebaseLoginProvider;
  run: number;
  abort: AbortController;
};
type IdentityRetry =
  | { step: "sign-in" }
  | { step: "activate-session"; session: AuthSession }
  | { step: "firebase"; canRefreshProof: boolean }
  | {
      step: "submit";
      proof: Extract<FirebaseProofResult, { kind: "proof-ready" }>;
      canRefreshProof: boolean;
    };

export function createAuthCoordinator(
  sessionController: AuthSessionRestorer,
  consentGate?: MemberConsentGate,
  login?: IdentityLoginDependencies,
) {
  // 상태는 한 벌만 두고, 외부에는 구독·읽기와 도메인 액션만 노출한다.
  const store = createStore<{ state: AuthCoordinatorState }>(() => ({
    state: { status: "idle" },
  }));
  let restorationPromise: Promise<void> | null = null;
  let flowGeneration = 0;
  let loginAttempt: IdentityAttempt | null = null;
  let identityRetry: IdentityRetry | null = null;

  function consentState(status: ServerConsentStatus): AuthCoordinatorState {
    if (!status.privacy.requiresConsent && !status.terms.requiresConsent)
      return { status: "authenticated" };
    return {
      status: "consent",
      requiredItems: {
        privacy: status.privacy.requiresConsent,
        terms: status.terms.requiresConsent,
      },
      qualityReviewConsented: status.qualityReview.consented,
      submission: { status: "idle" },
    };
  }

  async function checkMemberConsent(run: number): Promise<void> {
    if (!consentGate) {
      store.setState({ state: { status: "authenticated" } });
      return;
    }
    try {
      const status = await consentGate.load();
      if (run === flowGeneration)
        store.setState({ state: consentState(status) });
    } catch (error) {
      if (run !== flowGeneration) return;
      const state = resolveAuthRestoration(
        error instanceof SessionRequestError
          ? error.result
          : classifyAuthRecovery(error),
      );
      store.setState({
        state:
          !(error instanceof SessionRequestError) &&
          state.status === "error" &&
          state.nextAction === "retry-session-restore"
            ? { ...state, nextAction: "retry-consent-check" }
            : state,
      });
    }
  }

  async function acceptConsent(qualityReview: boolean): Promise<void> {
    const { state } = store.getState();
    if (
      !consentGate ||
      state.status !== "consent" ||
      state.submission.status === "submitting"
    )
      return;
    const run = flowGeneration;
    store.setState({
      state: { ...state, submission: { status: "submitting" } },
    });
    try {
      const status = await consentGate.accept(qualityReview);
      if (run === flowGeneration)
        store.setState({ state: consentState(status) });
    } catch (error) {
      if (run !== flowGeneration) return;
      if (error instanceof SessionRequestError) {
        store.setState({ state: resolveAuthRestoration(error.result) });
        return;
      }
      const result = classifyAuthRecovery(error);
      store.setState({
        state:
          result.action === "get-help"
            ? resolveAuthRestoration(result)
            : {
                ...state,
                submission: {
                  status: "failed",
                  message: AUTH_RECOVERY_MESSAGES[result.reason],
                },
              },
      });
    }
  }

  function handleSessionResult(result: AuthSessionRestoreResult): void {
    const { state } = store.getState();
    if (state.status !== "authenticated" && state.status !== "consent") return;
    if (result.kind === "ready" && result.accountType === "MEMBER") return;
    // 일시적인 요청 실패는 현재 화면에서 처리한다. 세션 무효·복구 불가는 루트로 전달한다.
    if (result.kind === "recovery-required" && result.action === "retry")
      return;
    flowGeneration += 1;
    store.setState({ state: resolveAuthRestoration(result) });
  }

  async function restoreAndUpdate(): Promise<void> {
    const run = flowGeneration;
    try {
      const result = await sessionController.restore();
      if (run !== flowGeneration) return;
      if (result.kind === "ready" && result.accountType === "MEMBER")
        await checkMemberConsent(run);
      else store.setState({ state: resolveAuthRestoration(result) });
    } catch (error) {
      if (run !== flowGeneration) return;
      store.setState({
        state: resolveAuthRestoration(classifyAuthRecovery(error)),
      });
    }
  }

  function restoreSession(): Promise<void> {
    if (restorationPromise) return restorationPromise;

    restorationPromise = restoreAndUpdate().finally(() => {
      restorationPromise = null;
    });
    return restorationPromise;
  }

  function bootstrap(): Promise<void> {
    if (restorationPromise) return restorationPromise;
    if (store.getState().state.status !== "idle") return Promise.resolve();

    store.setState({ state: { status: "restoring" } });
    return restoreSession();
  }

  function isCurrent(attempt: IdentityAttempt): boolean {
    return (
      loginAttempt === attempt &&
      attempt.run === flowGeneration &&
      !attempt.abort.signal.aborted
    );
  }

  function showLoginFailure(
    attempt: IdentityAttempt,
    message: string,
    nextAction: "retry" | "sign-in-again" | "get-help",
    retryStep: IdentityRetry | null,
  ): void {
    if (!isCurrent(attempt)) return;
    identityRetry = retryStep;
    store.setState({
      state: {
        status: "loginError",
        origin: attempt.origin,
        provider: attempt.provider,
        message,
        nextAction,
      },
    });
  }

  async function activateIdentitySession(
    attempt: IdentityAttempt,
    session: AuthSession,
  ): Promise<void> {
    if (!login || !isCurrent(attempt)) return;
    store.setState({ state: { status: "activatingSession" } });
    let accepted: boolean;
    try {
      accepted = await login.session.acceptSession(
        session,
        attempt.abort.signal,
      );
    } catch {
      accepted = false;
    }
    if (!isCurrent(attempt)) return;
    if (!accepted) {
      showLoginFailure(
        attempt,
        "로그인을 마무리하지 못했어요. 다시 시도해 주세요.",
        "retry",
        { step: "activate-session", session },
      );
      return;
    }
    // 로그인 성공과 가입 완료 모두 같은 메모리 세션·약관 확인 경로를 사용한다.
    identityRetry = null;
    await checkMemberConsent(attempt.run);
  }

  async function submitIdentityProof(
    attempt: IdentityAttempt,
    proof: Extract<FirebaseProofResult, { kind: "proof-ready" }>,
    canRefreshProof = true,
  ): Promise<void> {
    if (!login || !isCurrent(attempt)) return;
    store.setState({
      state: { status: "submittingProof", origin: attempt.origin },
    });
    if (!isCurrent(attempt)) return;
    try {
      let result: IdentityExchangeResult | IdentityGuestPreparationResult;
      if (attempt.origin === "guest") {
        const guest = await login.session.prepareRequest();
        if (!isCurrent(attempt)) return;
        result = await login.prepare(
          proof.firebaseIdToken,
          guest.accessToken,
          attempt.abort.signal,
        );
      } else {
        result = await login.exchange(
          proof.firebaseIdToken,
          attempt.abort.signal,
        );
      }
      if (!isCurrent(attempt)) return;
      identityRetry = null;
      switch (result.kind) {
        case "authenticated":
          await activateIdentitySession(attempt, result.session);
          return;
        case "enrollment-required":
          store.setState({
            state: {
              status: "signingUp",
              flowId: attempt.run,
              enrollment: result.enrollment,
            },
          });
          return;
        case "merge-required":
          store.setState({
            state: { status: "mergeRequired", flowId: attempt.run },
          });
          return;
      }
      const unhandled: never = result;
      throw new Error(`처리하지 않은 Identity 응답: ${unhandled}`);
    } catch (error) {
      if (!isCurrent(attempt)) return;
      if (error instanceof SessionRequestError) {
        identityRetry = null;
        store.setState({ state: resolveAuthRestoration(error.result) });
        return;
      }
      if (error instanceof ApiError) {
        if (error.code === "INVALID_FIREBASE_ID_TOKEN" && canRefreshProof) {
          const refreshed = await login.firebase.refreshProof(proof.uid);
          await handleFirebaseProof(attempt, refreshed, false);
          return;
        }
        if (
          error.code === "INVALID_FIREBASE_ID_TOKEN" ||
          error.code === "FIREBASE_RECENT_AUTH_REQUIRED"
        ) {
          showLoginFailure(
            attempt,
            "다시 로그인해 인증을 확인해 주세요.",
            "sign-in-again",
            { step: "sign-in" },
          );
          return;
        }
        if (error.code === "MERGE_REQUIRED" && attempt.origin === "guest") {
          identityRetry = null;
          store.setState({
            state: { status: "mergeRequired", flowId: attempt.run },
          });
          return;
        }
      }
      const recovery = classifyAuthRecovery(error);
      showLoginFailure(
        attempt,
        AUTH_RECOVERY_MESSAGES[recovery.reason],
        recovery.action === "retry" ? "retry" : "get-help",
        recovery.action === "retry"
          ? { step: "submit", proof, canRefreshProof }
          : null,
      );
    }
  }

  async function handleFirebaseProof(
    attempt: IdentityAttempt,
    proof: FirebaseProofResult,
    canRefreshProof = true,
  ): Promise<void> {
    if (!isCurrent(attempt)) return;
    switch (proof.kind) {
      case "proof-ready":
        await submitIdentityProof(attempt, proof, canRefreshProof);
        return;
      case "cancelled":
        cancelLogin();
        return;
      case "ignored":
        // 인증 컨트롤러가 취소 중이면 새 흐름을 시작하지 않는다.
        // 코디네이터 상태를 로그인 대기로 돌려 사용자가 종료 후 다시 시작하게 한다.
        identityRetry = null;
        store.setState({ state: { status: attempt.origin } });
        return;
      case "failed":
        showLoginFailure(
          attempt,
          "인증을 완료하지 못했어요. 다시 시도해 주세요.",
          proof.nextAction,
          proof.nextAction === "retry"
            ? { step: "firebase", canRefreshProof }
            : proof.nextAction === "sign-in-again"
              ? { step: "sign-in" }
              : null,
        );
        return;
    }
    const unhandled: never = proof;
    throw new Error(`처리하지 않은 Firebase 결과: ${unhandled}`);
  }

  async function signIn(provider: FirebaseLoginProvider): Promise<void> {
    const { state } = store.getState();
    if (!login || (state.status !== "noSession" && state.status !== "guest"))
      return;
    const attempt: IdentityAttempt = {
      origin: state.status,
      provider,
      run: ++flowGeneration,
      abort: new AbortController(),
    };
    loginAttempt = attempt;
    identityRetry = null;
    store.setState({
      state: { status: "signingIn", origin: attempt.origin, provider },
    });
    if (!isCurrent(attempt)) return;
    await handleFirebaseProof(attempt, await login.firebase.signIn(provider));
  }

  function cancelLogin(): void {
    const attempt = loginAttempt;
    const { state } = store.getState();
    // 활성화된 세션은 취소로 되돌리지 않는다. 가입·Identity 응답 대기까지만 취소한다.
    if (
      !attempt ||
      ![
        "signingIn",
        "submittingProof",
        "signingUp",
        "mergeRequired",
        "loginError",
      ].includes(state.status)
    )
      return;
    attempt.abort.abort();
    login?.firebase.cancel();
    flowGeneration += 1;
    loginAttempt = null;
    identityRetry = null;
    store.setState({ state: { status: attempt.origin } });
  }

  /** 가입/병합 담당이 서버에서 받은 세션을 전달한다. 이전 가입 화면의 완료는 무시한다. */
  async function completeEnrollment(
    flowId: number,
    session: AuthSession,
  ): Promise<void> {
    const { state } = store.getState();
    const attempt = loginAttempt;
    if (
      !attempt ||
      (state.status !== "signingUp" && state.status !== "mergeRequired") ||
      state.flowId !== flowId
    )
      return;
    await activateIdentitySession(attempt, session);
  }

  async function retryIdentityLogin(): Promise<void> {
    const attempt = loginAttempt;
    const step = identityRetry;
    if (!login || !attempt || !step || !isCurrent(attempt)) return;
    // 상태를 먼저 바꿔 연속 클릭이 같은 작업을 중복 시작하지 못하게 한다.
    store.setState({
      state: {
        status: "signingIn",
        origin: attempt.origin,
        provider: attempt.provider,
      },
    });
    identityRetry = null;
    if (!isCurrent(attempt)) return;
    switch (step.step) {
      case "activate-session":
        await activateIdentitySession(attempt, step.session);
        return;
      case "submit":
        await submitIdentityProof(attempt, step.proof, step.canRefreshProof);
        return;
      case "firebase":
        await handleFirebaseProof(
          attempt,
          await login.firebase.retry(),
          step.canRefreshProof,
        );
        return;
      case "sign-in":
        await handleFirebaseProof(
          attempt,
          await login.firebase.signIn(attempt.provider),
        );
        return;
    }
    const unhandled: never = step;
    throw new Error(`처리하지 않은 로그인 재시도: ${unhandled}`);
  }

  function dispose(): void {
    flowGeneration += 1;
    loginAttempt?.abort.abort();
    login?.firebase.cancel();
    loginAttempt = null;
    identityRetry = null;
  }

  function getForegroundRecoveryState(): AuthForegroundRecoveryState {
    const { state } = store.getState();
    switch (state.status) {
      case "error":
        if (state.isRetrying) return "busy";
        return state.nextAction === "get-help" ? "settled" : "retryable";
      case "loginError":
        return state.nextAction === "retry" &&
          (identityRetry?.step === "submit" || identityRetry?.step === "activate-session")
          ? "retryable"
          : "settled";
      case "idle":
      case "restoring":
      case "signingIn":
      case "submittingProof":
      case "activatingSession":
        return "busy";
      case "signingUp":
      case "mergeRequired":
      case "noSession":
      case "guest":
      case "authenticated":
      case "consent":
        return "settled";
    }
  }

  function retry(): Promise<void> {
    if (restorationPromise) return restorationPromise;
    const { state } = store.getState();
    if (state.status === "loginError") return retryIdentityLogin();
    if (state.status !== "error") return Promise.resolve();

    const action = state.nextAction;
    switch (action) {
      case "get-help":
        return Promise.resolve();
      case "retry-consent-check":
        store.setState({ state: { ...state, isRetrying: true } });
        restorationPromise = checkMemberConsent(flowGeneration).finally(() => {
          restorationPromise = null;
        });
        return restorationPromise;
      case "retry-session-restore":
        // 재시도 중에는 오류 화면을 유지하고 버튼을 비활성화하는 안이다.
        store.setState({ state: { ...state, isRetrying: true } });
        return restoreSession();
    }

    const unhandled: never = action;
    throw new Error(`처리하지 않은 복구 행동: ${unhandled}`);
  }

  return {
    getForegroundRecoveryState,
    signIn,
    cancelLogin,
    completeEnrollment,
    dispose,
    getState: store.getState,
    getInitialState: store.getInitialState,
    subscribe: store.subscribe,
    bootstrap,
    retry,
    acceptConsent,
    handleSessionResult,
  };
}

/**
 * RootNavigator에서 표현할 UI 대응(여기서 router.replace를 호출하지 않는다):
 * idle / restoring → 초기 로딩
 * noSession / guest → 로그인(이후 exchange/prepare 분기를 위해 상태는 구분)
 * consent → 필수 약관 재동의
 * authenticated → 메인
 * error → 안내·재시도 버튼. isRetrying이면 진행 표시 및 버튼 비활성화
 *
 * signingIn / submittingProof / activatingSession → 단계별 로딩
 * signingUp / mergeRequired → 별도 가입·병합 영역에 연결
 * loginError → 로그인 단계별 복구, cancelLogin으로 시작 화면 복귀
 */
