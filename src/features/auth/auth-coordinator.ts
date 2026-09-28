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
 * 실제 앱의 새 경로 활성화와 Firebase 연동 전이므로 App은 아직 기존 인증 경로를 사용한다.
 */

export type AuthCoordinatorState =
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

export function createAuthCoordinator(
  sessionController: AuthSessionRestorer,
  consentGate?: MemberConsentGate,
) {
  // 상태는 한 벌만 두고, 외부에는 구독·읽기와 도메인 액션만 노출한다.
  const store = createStore<{ state: AuthCoordinatorState }>(() => ({
    state: { status: "idle" },
  }));
  let restorationPromise: Promise<void> | null = null;
  let flowGeneration = 0;

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

  function retry(): Promise<void> {
    if (restorationPromise) return restorationPromise;
    const { state } = store.getState();
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
 * SNS 로그인·가입·병합과 진행 취소 상태는 후속 작업에서 확장한다.
 */
