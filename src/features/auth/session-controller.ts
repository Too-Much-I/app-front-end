import * as Crypto from 'expo-crypto';

import { createSessionPersistence } from '@/features/auth/session-persistence';

import { getCurrentAccount } from '@/features/auth/api/get-current-account';
import { reissueSession } from '@/features/auth/api/reissue-session';
import { isDefinitiveRefreshFailure } from '@/features/auth/api/reissue-tokens';
import { classifyAuthRecovery } from '@/features/auth/auth-recovery';
import {
  readAuthRestorationRecord,
  removeLegacyAuthSession,
  writeAuthRestorationRecord,
} from '@/features/auth/auth-restoration-storage';
import {
  SessionRestorationError,
  SessionRequestError,
  type AuthRestorationRecord,
  type AuthSessionRestoreResult,
} from '@/features/auth/session-restoration-types';
import type { AuthSession, RequestAuthSnapshot } from '@/features/auth/types';
import { ApiError } from '@/lib/api/transport';

// 기존 요청 경로와 동일하게 만료 1분 전부터 재발급한다.
const RESTORE_REFRESH_WINDOW_MS = 60_000;
type PendingRefresh = Extract<AuthRestorationRecord, { phase: 'refresh-pending' }>;
type RestorationProgress =
  | { step: 'read' }
  | { step: 'save-refresh'; record: PendingRefresh }
  | { step: 'refresh'; record: PendingRefresh }
  | { step: 'save-session'; session: AuthSession; refreshed: boolean }
  | { step: 'check-account'; session: AuthSession; refreshed: boolean }
  | { step: 'clear-session' }
  | { step: 'remove-legacy' }
  | {
      step: 'blocked';
      result: Extract<AuthSessionRestoreResult, { kind: 'recovery-required' }>;
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

function blocksUnauthorizedRefresh(code?: string): boolean {
  return code === 'ACCOUNT_MERGED_TOKEN_REJECTED' || code === 'WITHDRAWAL_CLEANUP_PENDING';
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
  const persistence = createSessionPersistence((record) => dependencies.write(record));
  let activationVersion = 0;
  let disposed = false;
  let progress: RestorationProgress = { step: 'read' };
  let activeSession: AuthSession | null = null;
  let pending: Promise<AuthSessionRestoreResult> | null = null;
  let generation = 0;
  const listeners = new Set<(result: AuthSessionRestoreResult) => void>();

  function prepareRefresh(session: AuthSession): void {
    progress = {
      step: 'save-refresh',
      record: {
        schemaVersion: 2,
        phase: 'refresh-pending',
        session,
        requestId: dependencies.createRequestId(),
        replaySupported: options.replaySupported,
      },
    };
  }

  async function runRestore(): Promise<AuthSessionRestoreResult> {
    activeSession = null;
    try {
      while (true) {
        switch (progress.step) {
          case 'read': {
            const record = await dependencies.read();
            if (!record) return { kind: 'login-required' };
            if (record.phase === 'signed-out') {
              progress = { step: 'remove-legacy' };
              break;
            }
            if (record.phase === 'refresh-pending') {
              if (!record.replaySupported || !options.replaySupported) {
                throw new SessionRestorationError('refresh-uncertain');
              }
              progress = { step: 'refresh', record };
            } else {
              // v1에서도 읽을 수 있으므로 먼저 v2로 안전하게 보존한다.
              progress = {
                step: 'save-session',
                session: record.session,
                refreshed: false,
              };
            }
            break;
          }
          case 'save-refresh':
            await persistence.writeRequired(progress.record);
            progress = { step: 'refresh', record: progress.record };
            break;
          case 'refresh': {
            const { record } = progress;
            try {
              const session = await dependencies.reissue(
                record.session.refreshToken,
                record.requestId,
                record.replaySupported,
              );
              // 저장 실패에도 이 상태에 새 토큰이 남는다.
              // 저장·계정 조회 실패 뒤 재개할 때도 재발급 성공 이력을 유지한다.
              progress = { step: 'save-session', session, refreshed: true };
            } catch (error) {
              if (isDefinitiveRefreshFailure(error)) {
                activeSession = null;
                progress = { step: 'clear-session' };
                break;
              }
              if (!record.replaySupported) {
                // 성공 여부를 모르는 회전을 같은 옛 토큰으로 반복하지 않는다.
                progress = {
                  step: 'blocked',
                  result: classifyAuthRecovery(new SessionRestorationError('refresh-uncertain')),
                };
                return progress.result;
              }
              throw error;
            }
            break;
          }
          case 'save-session':
            await persistence.writeRequired({
              schemaVersion: 2,
              phase: 'active',
              session: progress.session,
            });
            progress = { ...progress, step: 'check-account' };
            break;
          case 'check-account': {
            const { session, refreshed } = progress;
            if (session.refreshTokenExpiresAt <= dependencies.now()) {
              activeSession = null;
              progress = { step: 'clear-session' };
              break;
            }
            if (session.accessTokenExpiresAt - dependencies.now() <= RESTORE_REFRESH_WINDOW_MS) {
              if (refreshed) throw new SessionRestorationError('response-format');
              prepareRefresh(session);
              break;
            }
            let accountType: Awaited<ReturnType<typeof getCurrentAccount>>;
            try {
              accountType = await dependencies.getAccount(session.accessToken);
            } catch (error) {
              if (
                error instanceof ApiError &&
                error.status === 401 &&
                !blocksUnauthorizedRefresh(error.code) &&
                !refreshed
              ) {
                prepareRefresh(session);
                break;
              }
              throw error;
            }
            activeSession = session;
            generation += 1;
            // 복원 완료 후 시작되는 별도 복원에는 다시 한 번 재발급을 허용한다.
            progress = { step: 'check-account', session, refreshed: false };
            return { kind: 'ready', accountType };
          }
          case 'clear-session':
            await persistence.writeRequired({
              schemaVersion: 2,
              phase: 'signed-out',
            });
            progress = { step: 'remove-legacy' };
            break;
          case 'remove-legacy':
            await dependencies.removeLegacy();
            activeSession = null;
            return { kind: 'login-required' };
          case 'blocked':
            return progress.result;
          default: {
            const unhandled: never = progress;
            throw new Error(`처리하지 않은 복원 단계: ${unhandled}`);
          }
        }
      }
    } catch (error) {
      const result = classifyAuthRecovery(error);
      if (result.action === 'get-help') progress = { step: 'blocked', result };
      return result;
    }
  }

  function restore(): Promise<AuthSessionRestoreResult> {
    if (pending) return pending;
    const restoration = runRestore()
      .then((result) => {
        if (!disposed) listeners.forEach((listener) => listener(result));
        return result;
      })
      .finally(() => {
        if (pending === restoration) pending = null;
      });
    pending = restoration;
    return restoration;
  }

  /** 서버가 발급한 MEMBER 세션을 활성화한다. 디스크 저장 성공을 기다리지 않는다. */
  async function acceptSession(session: AuthSession, signal?: AbortSignal): Promise<boolean> {
    const version = ++activationVersion;
    const previous = pending;
    let accepted = false;
    const activation = (async (): Promise<AuthSessionRestoreResult> => {
      const previousResult: AuthSessionRestoreResult = previous
        ? await previous
        : { kind: 'login-required' };
      if (disposed || signal?.aborted || version !== activationVersion) return previousResult;
      activeSession = session;
      generation += 1;
      progress = { step: 'check-account', session, refreshed: false };
      persistence.saveInBackground(session);
      accepted = true;
      return { kind: 'ready', accountType: 'MEMBER' };
    })();
    pending = activation;
    try {
      await activation;
      return accepted;
    } finally {
      if (pending === activation) pending = null;
    }
  }

  function dispose(): void {
    disposed = true;
    activationVersion += 1;
    persistence.dispose();
    listeners.clear();
  }

  async function prepareRequest(): Promise<RequestAuthSnapshot> {
    if (
      pending ||
      !activeSession ||
      activeSession.accessTokenExpiresAt - dependencies.now() <= RESTORE_REFRESH_WINDOW_MS
    ) {
      const result = await restore();
      if (result.kind !== 'ready') throw new SessionRequestError(result);
    }
    if (!activeSession) throw new SessionRequestError({ kind: 'login-required' });
    return { accessToken: activeSession.accessToken, generation };
  }

  async function recoverUnauthorized(
    usedGeneration: number,
    code?: string,
  ): Promise<RequestAuthSnapshot> {
    if (pending) {
      const result = await pending;
      if (result.kind !== 'ready') throw new SessionRequestError(result);
    } else if (generation === usedGeneration && activeSession) {
      if (blocksUnauthorizedRefresh(code)) {
        progress = {
          step: 'blocked',
          result: classifyAuthRecovery(new SessionRestorationError('unexpected')),
        };
      } else {
        // 기존 읽기 API의 401 복구는 한 번만 허용한다. 동시에 실패한 요청은 세대를 공유한다.
        prepareRefresh(activeSession);
      }
      const result = await restore();
      if (result.kind !== 'ready') throw new SessionRequestError(result);
    }
    return prepareRequest();
  }

  function subscribeRestoration(listener: (result: AuthSessionRestoreResult) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return {
    restore,
    acceptSession,
    retryPersistence: persistence.retryPersistence,
    dispose,
    prepareRequest,
    recoverUnauthorized,
    subscribeRestoration,
    getSession: (): AuthSession | null => activeSession,
  };
}
