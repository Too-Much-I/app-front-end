import * as Crypto from "expo-crypto";

import { getCurrentAccount } from "@/features/auth/api/get-current-account";
import { reissueSession } from "@/features/auth/api/reissue-session";
import { isDefinitiveRefreshFailure } from "@/features/auth/api/reissue-tokens";
import { classifyAuthRecovery } from "@/features/auth/auth-recovery";
import {
  readAuthRestorationRecord,
  removeLegacyAuthSession,
  writeAuthRestorationRecord,
} from "@/features/auth/auth-restoration-storage";
import {
  SessionRestorationError,
  SessionRequestError,
  type AuthRestorationRecord,
  type AuthSessionRestoreResult,
} from "@/features/auth/session-restoration-types";
import type { AuthSession, RequestAuthSnapshot } from "@/features/auth/types";

// 기존 요청 경로와 동일하게 만료 1분 전부터 재발급한다.
const RESTORE_REFRESH_WINDOW_MS = 60_000;
type PendingRefresh = Extract<
  AuthRestorationRecord,
  { phase: "refresh-pending" }
>;
type RestorationProgress =
  | { step: "read" }
  | { step: "save-refresh"; record: PendingRefresh }
  | { step: "refresh"; record: PendingRefresh }
  | { step: "save-session"; session: AuthSession }
  | { step: "check-account"; session: AuthSession }
  | { step: "clear-session" }
  | { step: "remove-legacy" }
  | {
      step: "blocked";
      result: Extract<AuthSessionRestoreResult, { kind: "recovery-required" }>;
    };

interface SessionControllerDependencies {
  read: () => Promise<AuthRestorationRecord | null>;
  write: (record: AuthRestorationRecord) => Promise<void>;
  removeLegacy: () => Promise<void>;
  reissue: typeof reissueSession;
  getAccount: typeof getCurrentAccount;
  createRequestId: () => string;
  now: () => number;
}

/** 앱 전체에서 한 인스턴스를 공유한다. 기존 authController와 동시에 활성화하지 않는다. */
export function createSessionController(
  options: { replaySupported: boolean },
  dependencies: SessionControllerDependencies = {
    read: readAuthRestorationRecord,
    write: writeAuthRestorationRecord,
    removeLegacy: removeLegacyAuthSession,
    reissue: reissueSession,
    getAccount: getCurrentAccount,
    createRequestId: Crypto.randomUUID,
    now: Date.now,
  },
) {
  let progress: RestorationProgress = { step: "read" };
  let activeSession: AuthSession | null = null;
  let pending: Promise<AuthSessionRestoreResult> | null = null;
  let generation = 0;
  const listeners = new Set<(result: AuthSessionRestoreResult) => void>();

  function prepareRefresh(session: AuthSession): void {
    progress = {
      step: "save-refresh",
      record: {
        schemaVersion: 2,
        phase: "refresh-pending",
        session,
        requestId: dependencies.createRequestId(),
        replaySupported: options.replaySupported,
      },
    };
  }

  async function runRestore(): Promise<AuthSessionRestoreResult> {
    // 한 복원 실행에서 재발급을 반복하지 않는다.
    let refreshed = false;
    activeSession = null;
    try {
      while (true) {
        switch (progress.step) {
          case "read": {
            const record = await dependencies.read();
            if (!record) return { kind: "login-required" };
            if (record.phase === "signed-out") {
              progress = { step: "remove-legacy" };
              break;
            }
            if (record.phase === "refresh-pending") {
              if (!record.replaySupported || !options.replaySupported) {
                throw new SessionRestorationError("refresh-uncertain");
              }
              progress = { step: "refresh", record };
            } else {
              // v1에서도 읽을 수 있으므로 먼저 v2로 안전하게 보존한다.
              progress = { step: "save-session", session: record.session };
            }
            break;
          }
          case "save-refresh":
            await dependencies.write(progress.record);
            progress = { step: "refresh", record: progress.record };
            break;
          case "refresh": {
            const { record } = progress;
            try {
              const session = await dependencies.reissue(
                record.session.refreshToken,
                record.requestId,
                record.replaySupported,
              );
              // 저장 실패에도 이 상태에 새 토큰이 남는다.
              progress = { step: "save-session", session };
              refreshed = true;
            } catch (error) {
              if (isDefinitiveRefreshFailure(error)) {
                activeSession = null;
                progress = { step: "clear-session" };
                break;
              }
              if (!record.replaySupported) {
                // 성공 여부를 모르는 회전을 같은 옛 토큰으로 반복하지 않는다.
                progress = {
                  step: "blocked",
                  result: classifyAuthRecovery(
                    new SessionRestorationError("refresh-uncertain"),
                  ),
                };
                return progress.result;
              }
              throw error;
            }
            break;
          }
          case "save-session":
            await dependencies.write({
              schemaVersion: 2,
              phase: "active",
              session: progress.session,
            });
            progress = { step: "check-account", session: progress.session };
            break;
          case "check-account": {
            const { session } = progress;
            if (session.refreshTokenExpiresAt <= dependencies.now()) {
              activeSession = null;
              progress = { step: "clear-session" };
              break;
            }
            if (
              session.accessTokenExpiresAt - dependencies.now() <=
              RESTORE_REFRESH_WINDOW_MS
            ) {
              if (refreshed)
                throw new SessionRestorationError("response-format");
              prepareRefresh(session);
              break;
            }
            const accountType = await dependencies.getAccount(
              session.accessToken,
            );
            activeSession = session;
            generation += 1;
            return { kind: "ready", accountType };
          }
          case "clear-session":
            await dependencies.write({ schemaVersion: 2, phase: "signed-out" });
            progress = { step: "remove-legacy" };
            break;
          case "remove-legacy":
            await dependencies.removeLegacy();
            activeSession = null;
            return { kind: "login-required" };
          case "blocked":
            return progress.result;
          default: {
            const unhandled: never = progress;
            throw new Error(`처리하지 않은 복원 단계: ${unhandled}`);
          }
        }
      }
    } catch (error) {
      const result = classifyAuthRecovery(error);
      if (result.action === "get-help") progress = { step: "blocked", result };
      return result;
    }
  }

  function restore(): Promise<AuthSessionRestoreResult> {
    if (pending) return pending;
    pending = runRestore()
      .then((result) => {
        listeners.forEach((listener) => listener(result));
        return result;
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  }

  async function prepareRequest(): Promise<RequestAuthSnapshot> {
    if (
      pending ||
      !activeSession ||
      activeSession.accessTokenExpiresAt - dependencies.now() <=
        RESTORE_REFRESH_WINDOW_MS
    ) {
      const result = await restore();
      if (result.kind !== "ready") throw new SessionRequestError(result);
    }
    if (!activeSession)
      throw new SessionRequestError({ kind: "login-required" });
    return { accessToken: activeSession.accessToken, generation };
  }

  async function recoverUnauthorized(
    usedGeneration: number,
    code?: string,
  ): Promise<RequestAuthSnapshot> {
    if (pending) {
      const result = await pending;
      if (result.kind !== "ready") throw new SessionRequestError(result);
    } else if (generation === usedGeneration && activeSession) {
      if (
        code === "ACCOUNT_MERGED_TOKEN_REJECTED" ||
        code === "WITHDRAWAL_CLEANUP_PENDING"
      ) {
        progress = {
          step: "blocked",
          result: classifyAuthRecovery(
            new SessionRestorationError("unexpected"),
          ),
        };
      } else {
        // 기존 읽기 API의 401 복구는 한 번만 허용한다. 동시에 실패한 요청은 세대를 공유한다.
        prepareRefresh(activeSession);
      }
      const result = await restore();
      if (result.kind !== "ready") throw new SessionRequestError(result);
    }
    return prepareRequest();
  }

  function subscribeRestoration(
    listener: (result: AuthSessionRestoreResult) => void,
  ): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return {
    restore,
    prepareRequest,
    recoverUnauthorized,
    subscribeRestoration,
    getSession: (): AuthSession | null => activeSession,
  };
}
