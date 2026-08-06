import { type ReactNode, useEffect, useMemo, useSyncExternalStore } from "react";

import { authController } from "@/features/auth/auth-controller";
import { AuthContext, type AuthContextValue } from "@/features/auth/auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(
    authController.subscribe,
    authController.getState,
    authController.getState,
  );

  useEffect(() => authController.startBootstrap(), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      acceptConsent: () => authController.acceptConsent(),
      retry: () => authController.retry(),
      deleteGuestAccount: () => authController.deleteGuestAccount(),
    }),
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
