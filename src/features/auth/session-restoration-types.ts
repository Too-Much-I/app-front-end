import type { AuthSession } from "@/features/auth/types";

export type AuthRecoveryReason =
  | "connection"
  | "server"
  | "storage"
  | "session-format"
  | "response-format"
  | "refresh-uncertain"
  | "unexpected";

export type AuthRecoveryAction = "retry" | "get-help";

export type AuthSessionRestoreResult =
  | { kind: "ready"; accountType: "MEMBER" | "GUEST" }
  | { kind: "login-required" }
  | {
      kind: "recovery-required";
      reason: AuthRecoveryReason;
      action: AuthRecoveryAction;
    };

/** 한 레코드 안에서 토큰과 그 토큰의 재발급 요청 ID를 함께 저장한다. */
export type AuthRestorationRecord = { schemaVersion: 2 } & (
  | { phase: "active"; session: AuthSession }
  | {
      phase: "refresh-pending";
      session: AuthSession;
      requestId: string;
      replaySupported: boolean;
    }
  | { phase: "signed-out" }
);

export class SessionRestorationError extends Error {
  constructor(public readonly reason: AuthRecoveryReason) {
    super("인증 복원 작업을 완료하지 못했습니다.");
    this.name = "SessionRestorationError";
  }
}
