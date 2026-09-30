import type { User } from '@react-native-firebase/auth';
import { createStore } from 'zustand/vanilla';

import { classifyFirebaseAuthFailure } from '@/features/auth/firebase-auth-errors';
import {
  FirebaseAuthenticationError,
  type FirebaseAuthOperationState,
  type FirebaseAuthSdk,
  type FirebaseLoginProvider,
  type FirebaseProofResult,
} from '@/features/auth/firebase-auth-types';

type FirebaseProgress =
  | { step: 'idle' }
  | { step: 'provider-sign-in'; provider: FirebaseLoginProvider }
  | { step: 'get-id-token'; provider: FirebaseLoginProvider; user: User };

type ActiveFirebaseProgress = Exclude<FirebaseProgress, { step: 'idle' }>;

/** 하나의 Firebase Auth 인스턴스에 하나의 controller를 공유한다. */
export function createFirebaseAuthController(sdk: FirebaseAuthSdk) {
  const store = createStore<{ operation: FirebaseAuthOperationState }>(() => ({
    operation: { status: 'idle' },
  }));
  let progress: FirebaseProgress = { step: 'idle' };
  let retryForceRefresh = false;
  let provedUser: { user: User; provider: FirebaseLoginProvider } | null = null;
  let pending: {
    abort: AbortController;
    resolve: (result: FirebaseProofResult) => void;
  } | null = null;

  function assertCurrentUser(user: User): void {
    if (sdk.getCurrentUid() !== user.uid)
      throw new FirebaseAuthenticationError('reauthentication-required');
  }

  async function execute(
    initial: ActiveFirebaseProgress,
    signal: AbortSignal,
    forceRefresh: boolean,
  ): Promise<FirebaseProofResult> {
    try {
      if (signal.aborted) return { kind: 'cancelled' };
      let tokenProgress = initial;
      if (tokenProgress.step === 'provider-sign-in') {
        const login = await sdk.signInProvider(tokenProgress.provider, signal);
        if (signal.aborted || login.kind === 'cancelled') return { kind: 'cancelled' };
        tokenProgress = {
          step: 'get-id-token',
          provider: tokenProgress.provider,
          user: login.user,
        };
        progress = tokenProgress;
        store.setState({
          operation: {
            status: 'running',
            provider: tokenProgress.provider,
            step: 'get-id-token',
          },
        });
      }
      if (signal.aborted) return { kind: 'cancelled' };
      assertCurrentUser(tokenProgress.user);
      const firebaseIdToken = await sdk.getIdToken(tokenProgress.user, forceRefresh);
      if (signal.aborted) return { kind: 'cancelled' };
      // 토큰 획득 중 발생한 로그아웃·계정 변경도 확인한다.
      assertCurrentUser(tokenProgress.user);
      if (!firebaseIdToken.trim()) throw new FirebaseAuthenticationError('unexpected');
      provedUser = {
        user: tokenProgress.user,
        provider: tokenProgress.provider,
      };
      return {
        kind: 'proof-ready',
        uid: tokenProgress.user.uid,
        firebaseIdToken,
      };
    } catch (error) {
      return signal.aborted ? { kind: 'cancelled' } : classifyFirebaseAuthFailure(error);
    }
  }

  function start(
    initial: ActiveFirebaseProgress,
    forceRefresh = false,
  ): Promise<FirebaseProofResult> {
    // 다른 Provider여도 이전 네이티브 작업이 끝날 때까지 중복 실행하지 않는다.
    if (pending) return Promise.resolve({ kind: 'ignored', reason: 'busy' });
    const abort = new AbortController();
    return new Promise<FirebaseProofResult>((resolve) => {
      const attempt = { abort, resolve };
      pending = attempt;
      progress = initial;
      retryForceRefresh = forceRefresh;
      store.setState({
        operation: {
          status: 'running',
          provider: initial.provider,
          step: initial.step,
        },
      });
      void execute(initial, abort.signal, forceRefresh).then((result) => {
        // cancel()은 호출자에게 즉시 반환하지만, 이 지점까지 실제 작업의 잠금을 유지한다.
        if (abort.signal.aborted) result = { kind: 'cancelled' };
        if (result.kind !== 'failed' || result.nextAction !== 'retry') progress = { step: 'idle' };
        pending = null;
        resolve(result);
        store.setState({
          operation:
            result.kind === 'failed'
              ? {
                  status: 'failed',
                  provider: initial.provider,
                  failure: result,
                }
              : { status: 'idle' },
        });
      });
    });
  }

  function signIn(provider: FirebaseLoginProvider): Promise<FirebaseProofResult> {
    return start({ step: 'provider-sign-in', provider });
  }

  function retry(): Promise<FirebaseProofResult> {
    if (pending) return Promise.resolve({ kind: 'ignored', reason: 'busy' });
    const { operation } = store.getState();
    if (
      operation.status !== 'failed' ||
      operation.failure.nextAction !== 'retry' ||
      progress.step === 'idle'
    ) {
      return Promise.resolve({ kind: 'ignored', reason: 'no-retry' });
    }
    return start(progress, retryForceRefresh);
  }

  function refreshProof(uid: string): Promise<FirebaseProofResult> {
    if (!provedUser || provedUser.user.uid !== uid || sdk.getCurrentUid() !== uid)
      return Promise.resolve({
        kind: 'failed',
        reason: 'reauthentication-required',
        nextAction: 'sign-in-again',
      });
    return start({ step: 'get-id-token', ...provedUser }, true);
  }

  function cancel(): void {
    provedUser = null;
    progress = { step: 'idle' };
    if (!pending) {
      store.setState({ operation: { status: 'idle' } });
      return;
    }
    const attempt = pending;
    attempt.abort.abort();
    attempt.resolve({ kind: 'cancelled' });
    store.setState({ operation: { status: 'cancelling' } });
  }

  return {
    getState: store.getState,
    getInitialState: store.getInitialState,
    subscribe: store.subscribe,
    signIn,
    refreshProof,
    retry,
    cancel,
  };
}
