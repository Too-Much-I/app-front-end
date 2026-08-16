import { createContext, useContext } from "react";

import type { AuthBootstrapState } from "@/features/auth/types";

export type AuthContextValue = {
  state: AuthBootstrapState;
  acceptConsent: () => Promise<void>;
  retry: () => Promise<void>;
  deleteGuestAccount: () => Promise<void>;
  readQualityReviewConsent: () => Promise<boolean>;
  setQualityReviewConsent: (consented: boolean) => Promise<void>;
  setPendingQualityReviewConsent: (consented: boolean) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth는 AuthProvider 안에서 사용해야 합니다.");
  }
  return context;
}
