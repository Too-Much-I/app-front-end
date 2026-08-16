import { type ReactNode, useEffect, useMemo, useSyncExternalStore } from "react";

import { authController } from "@/features/auth/auth-controller";
import { AuthContext, type AuthContextValue } from "@/features/auth/auth-context";

/**
 * 컨트롤러로 위임하는 액션들. 컴포넌트 밖에 한 번만 만든다.
 *
 * `useMemo` 안에서 만들면 `state`가 바뀔 때마다 새 참조가 되는데, 이 함수들은
 * `state`를 전혀 쓰지 않고 모듈 싱글턴에 위임하기만 하므로 바뀔 이유가 없다.
 * 참조가 흔들리면 이 값을 의존성에 넣은 소비자의 `useEffect`·`useCallback`이
 * 인증 상태가 움직일 때마다 덩달아 다시 돌아, 요청이 진행 중인 화면이 초기값으로
 * 되돌아가는 식의 버그를 만든다.
 */
const AUTH_ACTIONS = {
  acceptConsent: () => authController.acceptConsent(),
  retry: () => authController.retry(),
  deleteGuestAccount: () => authController.deleteGuestAccount(),
  readQualityReviewConsent: () => authController.readQualityReviewConsent(),
  setQualityReviewConsent: (consented: boolean) =>
    authController.setQualityReviewConsent(consented),
  setPendingQualityReviewConsent: (consented: boolean) =>
    authController.setPendingQualityReviewConsent(consented),
} as const satisfies Omit<AuthContextValue, "state">;

export function AuthProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(
    authController.subscribe,
    authController.getState,
    authController.getState,
  );

  useEffect(() => authController.startBootstrap(), []);

  const value = useMemo<AuthContextValue>(
    () => ({ state, ...AUTH_ACTIONS }),
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
