import { createStore } from "zustand/vanilla";

/**
 * 합의한 상태·분기·재시도 흐름을 표현하는 뼈대. 앱에는 아직 연결하지 않는다.
 *
 * 최초 실행: 앱 루트 useAuthBootstrap → coordinator.bootstrap()
 * 재시도: 오류 화면 버튼 → coordinator.retry()
 * 화면 선택: RootNavigator가 state를 구독해 결정한다.
 *
 * RootNavigator의 coordinator 진입점에서 루트 훅과 selector를 연결한다.
 * 실제 sessionController와 Firebase 연동 전이므로 App은 아직 기존 인증 경로를 사용한다.
 */

export type AuthCoordinatorDraftState =
  | { status: "idle" }
  | { status: "restoring" }
  | { status: "noSession" }
  | { status: "guest" }
  | { status: "authenticated" }
  | {
      status: "error";
      message: string;
      nextAction: "retry-session-restore";
      isRetrying: boolean;
    };

/**
 * restore는 기존 저장 형식 해석, 토큰 재발급·저장, 계정 종류 확인을 맡는다.
 * ready는 단순히 저장된 토큰을 읽었다는 뜻이 아니라 사용 가능한 세션이다.
 * login-required는 세션이 없거나 무효가 확정돼 필요한 정리까지 완료된 경우다.
 * 읽기 실패를 세션 없음으로 취급하지 않는다. 세부 오류와 토큰은 내부에 보관한다.
 * 재발급 성공 후 저장 실패 시 새 토큰을 보존하고 다음 restore에서 저장을 재개한다.
 */
export type AuthSessionRestoreDraftResult =
  | { kind: "ready"; accountType: "MEMBER" | "GUEST" }
  | { kind: "login-required" }
  | { kind: "recovery-required" };

interface AuthSessionDraftController {
  restore: () => Promise<AuthSessionRestoreDraftResult>;
}

function resolveAuthRestorationDraft(
  result: AuthSessionRestoreDraftResult,
): AuthCoordinatorDraftState {
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
        message: "로그인 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
        nextAction: "retry-session-restore",
        isRetrying: false,
      };
  }
}

export function createAuthCoordinatorDraft(sessionController: AuthSessionDraftController) {
  // 상태는 한 벌만 두고, 외부에는 구독·읽기와 도메인 액션만 노출한다.
  const store = createStore<{ state: AuthCoordinatorDraftState }>(() => ({
    state: { status: "idle" },
  }));
  let restorationPromise: Promise<void> | null = null;

  async function restoreAndUpdate(): Promise<void> {
    try {
      const result = await sessionController.restore();
      store.setState({ state: resolveAuthRestorationDraft(result) });
    } catch {
      // 예상한 실패는 restore의 결과로 반환한다. 예외도 세션 없음으로 바꾸지 않는다.
      // 후속 구현에서 예상 밖 예외는 기존 관측 도구로 보고한다(토큰 등은 제외).
      store.setState({ state: resolveAuthRestorationDraft({ kind: "recovery-required" }) });
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
  };
}

/**
 * RootNavigator에서 표현할 UI 대응(여기서 router.replace를 호출하지 않는다):
 * idle / restoring → 초기 로딩
 * noSession / guest → 로그인(이후 exchange/prepare 분기를 위해 상태는 구분)
 * authenticated → 메인
 * error → 안내·재시도 버튼. isRetrying이면 진행 표시 및 버튼 비활성화
 *
 * SNS 로그인·가입·병합과 진행 취소 상태는 다음 뼈대에서 확장한다.
 */
