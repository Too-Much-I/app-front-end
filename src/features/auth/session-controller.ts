import * as Crypto from 'expo-crypto';

import { createSessionPersistence } from '@/features/auth/session-persistence';

import { getCurrentAccount } from '@/features/auth/api/get-current-account';
import { reissueSession } from '@/features/auth/api/reissue-session';
import { revokeRefreshSession } from '@/features/auth/api/revoke-refresh-session';
import {
  isAccountInactiveFailure,
  isDefinitiveRefreshFailure,
} from '@/features/auth/api/reissue-tokens';
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
type SignedOutNotice = Extract<AuthSessionRestoreResult, { kind: 'login-required' }>['notice'];
type RestorationProgress =
  | { step: 'read' }
  | { step: 'save-refresh'; record: PendingRefresh }
  | { step: 'refresh'; record: PendingRefresh }
  | { step: 'save-session'; session: AuthSession; refreshed: boolean }
  | { step: 'check-account'; session: AuthSession; refreshed: boolean }
  | { step: 'clear-session'; notice?: SignedOutNotice }
  | { step: 'remove-legacy'; notice?: SignedOutNotice }
  | {
      step: 'blocked';
      result: Extract<AuthSessionRestoreResult, { kind: 'recovery-required' }>;
    };

interface SessionControllerDependencies {
  read: () => Promise<AuthRestorationRecord | null>;
  write: (record: AuthRestorationRecord) => Promise<void>;
  removeLegacy: () => Promise<void>;
  reissue: typeof reissueSession;
  revoke: typeof revokeRefreshSession;
  getAccount: typeof getCurrentAccount;
  createRequestId: () => string;
  now: () => number;
}

function blocksUnauthorizedRefresh(code?: string): boolean {
  return code === 'ACCOUNT_MERGED_TOKEN_REJECTED' || code === 'WITHDRAWAL_CLEANUP_PENDING';
}

/** 비활성 계정의 세션은 지우고, 다음 화면이 사용자에게 알리도록 표시를 남긴다. */
const CLEAR_INACTIVE_SESSION = { step: 'clear-session', notice: 'account-inactive' } as const;

/** 앱 전체에서 한 인스턴스를 공유한다. 기존 authController와 동시에 활성화하지 않는다. */
export function createSessionController(
  options: { replaySupported: boolean },
  dependencies: SessionControllerDependencies = {
    read: readAuthRestorationRecord,
    write: writeAuthRestorationRecord,
    removeLegacy: removeLegacyAuthSession,
    reissue: reissueSession,
    revoke: revokeRefreshSession,
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
  const accountChangeListeners = new Set<() => void>();

  // 토큰 회전은 같은 계정이므로 알리지 않는다. 새 세션 활성화와 세션 삭제만 알린다.
  function notifyAccountChange(): void {
    if (!disposed) accountChangeListeners.forEach((listener) => listener());
  }

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
              if (isAccountInactiveFailure(error)) {
                activeSession = null;
                progress = CLEAR_INACTIVE_SESSION;
                break;
              }
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
              if (isAccountInactiveFailure(error)) {
                activeSession = null;
                progress = CLEAR_INACTIVE_SESSION;
                break;
              }
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
            progress = { step: 'remove-legacy', notice: progress.notice };
            break;
          case 'remove-legacy': {
            const { notice } = progress;
            await dependencies.removeLegacy();
            activeSession = null;
            notifyAccountChange();
            return notice ? { kind: 'login-required', notice } : { kind: 'login-required' };
          }
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
      notifyAccountChange();
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

  /**
   * 사용자 로그아웃. 기기 정리를 먼저 끝내고 서버 폐기는 기다리지 않는다(2026-10-06 결정).
   * 진행 중인 복원·토큰 회전이 끝난 뒤 지워야 늦게 도착한 세션이 다시 활성화되지 않고,
   * 서버에도 회전 뒤의 refresh token을 보낸다.
   */
  async function signOut(): Promise<void> {
    activationVersion += 1;
    if (pending) await pending;
    const session = activeSession;
    activeSession = null;
    generation += 1;
    // 다음 복원은 저장된 signed-out 기록을 읽어 로그인 필요로 끝난다.
    progress = { step: 'read' };
    try {
      await persistence.writeRequired({ schemaVersion: 2, phase: 'signed-out' });
    } catch {
      // 디스크에 옛 세션이 남아도 서버 폐기가 성공하면 다음 실행의 재발급이 확정 실패로 정리한다.
    }
    notifyAccountChange();
    // 실패해도 기기 토큰은 이미 지워졌다. 남은 서버 세션은 만료까지 고립된다.
    if (session) dependencies.revoke(session.refreshToken).catch(() => {});
  }

  function dispose(): void {
    disposed = true;
    activationVersion += 1;
    persistence.dispose();
    listeners.clear();
    accountChangeListeners.clear();
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
      if (code === 'ACCOUNT_MERGED_TOKEN_REJECTED') {
        activeSession = null;
        progress = CLEAR_INACTIVE_SESSION;
      } else if (blocksUnauthorizedRefresh(code)) {
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

  function subscribeAccountChange(listener: () => void): () => void {
    accountChangeListeners.add(listener);
    return () => {
      accountChangeListeners.delete(listener);
    };
  }

  return {
    restore,
    acceptSession,
    signOut,
    retryPersistence: persistence.retryPersistence,
    dispose,
    prepareRequest,
    recoverUnauthorized,
    subscribeRestoration,
    subscribeAccountChange,
    getSession: (): AuthSession | null => activeSession,
  };
}
