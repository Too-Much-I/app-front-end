import type { User } from '@react-native-firebase/auth';
import { createStore } from 'zustand/vanilla';

import {
  classifyFirebaseAuthFailure,
  readReportableFirebaseCode,
} from '@/features/auth/firebase-auth-errors';
import {
  FirebaseAuthenticationError,
  type FirebaseAuthOperationState,
  type FirebaseAuthSdk,
  type FirebaseLoginProvider,
  type FirebaseProofResult,
} from '@/features/auth/firebase-auth-types';
import { reportOperationalError } from '@/lib/operational-error-reporting';

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
  /** 실패한 시도를 다시 할 때도 처음 시도의 보고 여부를 따른다. */
  let retryReportFailure = false;
  let provedUser: { user: User; provider: FirebaseLoginProvider } | null = null;
  let pending: {
    abort: AbortController;
    resolve: (result: FirebaseProofResult) => void;
  } | null = null;

  function assertCurrentUser(user: User): void {
    if (sdk.getCurrentUid() !== user.uid)
      throw new FirebaseAuthenticationError('reauthentication-required');
  }

  /**
   * `reportFailure`: 실패를 여기서 `AUTH_SIGN_IN_FAILED`로 보고할지. 원래 SDK 오류 코드는 여기서만
   * 알지만, 가입·승격·병합이 부르는 증명 갱신의 실패는 그 흐름이 자기 이름으로 보고하므로 끈다.
   */
  async function execute(
    initial: ActiveFirebaseProgress,
    signal: AbortSignal,
    forceRefresh: boolean,
    reportFailure: boolean,
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
      if (signal.aborted) return { kind: 'cancelled' };
      const failure = classifyFirebaseAuthFailure(error);
      if (!reportFailure) return failure;
      // 원래 SDK 오류 코드는 여기서만 안다. 코디네이터는 접힌 사유만 받으므로 이 단계는 여기서 보고한다.
      reportOperationalError({
        code: 'AUTH_SIGN_IN_FAILED',
        provider: initial.provider,
        stage: 'firebase',
        step: progress.step === 'get-id-token' ? 'get-id-token' : initial.step,
        reason: failure.reason,
        firebaseCode: readReportableFirebaseCode(error),
        cause: error,
      });
      return failure;
    }
  }

  function start(
    initial: ActiveFirebaseProgress,
    forceRefresh: boolean,
    reportFailure: boolean,
  ): Promise<FirebaseProofResult> {
    // 다른 Provider여도 이전 네이티브 작업이 끝날 때까지 중복 실행하지 않는다.
    if (pending) return Promise.resolve({ kind: 'ignored', reason: 'busy' });
    const abort = new AbortController();
    return new Promise<FirebaseProofResult>((resolve) => {
      const attempt = { abort, resolve };
      pending = attempt;
      progress = initial;
      retryForceRefresh = forceRefresh;
      retryReportFailure = reportFailure;
      store.setState({
        operation: {
          status: 'running',
          provider: initial.provider,
          step: initial.step,
        },
      });
      void execute(initial, abort.signal, forceRefresh, reportFailure).then((result) => {
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
    return start({ step: 'provider-sign-in', provider }, false, true);
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
    return start(progress, retryForceRefresh, retryReportFailure);
  }

  /**
   * 강제 갱신한 증명. 가입·승격·병합은 실패를 자기 흐름 이름으로 보고하므로 기본은 보고하지 않는다.
   * 로그인 중의 갱신(코디네이터)만 `reportFailure`를 켠다.
   */
  function refreshProof(
    uid: string,
    options: { reportFailure?: boolean } = {},
  ): Promise<FirebaseProofResult> {
    if (!provedUser || provedUser.user.uid !== uid || sdk.getCurrentUid() !== uid)
      return Promise.resolve({
        kind: 'failed',
        reason: 'reauthentication-required',
        nextAction: 'sign-in-again',
      });
    return start({ step: 'get-id-token', ...provedUser }, true, options.reportFailure ?? false);
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

  /** 로그아웃 뒤 이전 사용자의 증명으로 재시도·재발급하지 않게 함께 비운다. */
  async function signOut(): Promise<void> {
    cancel();
    retryForceRefresh = false;
    retryReportFailure = false;
    await sdk.signOut();
  }

  return {
    getState: store.getState,
    getInitialState: store.getInitialState,
    subscribe: store.subscribe,
    signIn,
    refreshProof,
    retry,
    cancel,
    signOut,
  };
}
