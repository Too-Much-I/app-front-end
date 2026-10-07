import {
  AuthCredential,
  deleteUser,
  getAuth,
  getIdToken,
  PhoneAuthProvider,
  signInWithCredential,
  verifyPhoneNumber,
} from '@react-native-firebase/auth';
import { AppState } from 'react-native';
import { createStore } from 'zustand/vanilla';

import type {
  AccountRecoveryResult,
  AccountRecoveryTicket,
} from '@/features/auth/account-recovery-mapper';
import { AUTH_RECOVERY_MESSAGES, classifyAuthRecovery } from '@/features/auth/auth-recovery';
import {
  readFirebaseSdkErrorCode,
  type PhoneCollisionCredential,
} from '@/features/auth/firebase-auth-errors';
import type { FirebaseLoginProvider } from '@/features/auth/firebase-auth-types';
import { ApiError } from '@/lib/api/transport';

// 레포 관례(약관 조회)와 같은 자동 재시도 간격(지연 + 20% 지터). 세 번을 합쳐도 접수번호를
// 다시 받기 시작하는 시점(만료 1분 전) 안에 끝난다.
const RETRY_DELAYS_MS = [5_000, 10_000, 20_000] as const;
// 남은 시간이 이보다 짧으면 접수번호를 새로 받는다(2026-10-07 사용자 결정).
const TICKET_REFRESH_MARGIN_MS = 60_000;
// 코드 확인 직후 바로 조회하므로 이 정도만 남아 있으면 된다.
const LOOKUP_MARGIN_MS = 10_000;
// 서버가 Retry-After를 주지 않았을 때. 서버 제한 구간이 1분이다.
const DEFAULT_RATE_LIMIT_MS = 60_000;
// 아래 네 값은 가입 전화 인증(signup-phone-verification.ts)과 같다.
const MAX_SEND_ATTEMPTS = 5;
const RESEND_DELAYS_SECONDS = [15, 30, 45, 60] as const;
const AUTO_RETRIEVAL_TIMEOUT_SECONDS = 30;
const SEND_TIMEOUT_MS = 45_000;
const KOREAN_MOBILE_PATTERN = /^010\d{8}$/;

const ACCOUNT_RECOVERY_MESSAGES = {
  rateLimited: '요청을 너무 많이 보냈어요.',
  expired: '인증 시간이 지났어요. 전화번호를 다시 인증해 주세요.',
  verifyAgain: '전화번호를 다시 인증해 주세요.',
  unexpected: '계정을 찾지 못했어요. 처음부터 다시 시도해 주세요.',
  invalidPhone: '휴대전화 번호를 확인해 주세요.',
  sendLimit: '인증번호 요청 횟수를 넘었어요. 잠시 후 다시 시도해 주세요.',
  sendDelayed: '인증번호 발송이 늦어지고 있어요. 조금 더 기다리거나 다시 요청해 주세요.',
  wrongCode: '인증번호가 일치하지 않아요. 다시 확인해 주세요.',
  codeExpired: '인증번호가 만료됐어요. 인증번호를 다시 받아 주세요.',
  tooManyCodes: '인증 요청이 너무 많아요. 잠시 후 다시 시도해 주세요.',
  phoneFailed: '인증을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.',
} as const;

/** 계정 찾기 진입 자료. 가입 중 충돌에서 오면 번호와 교환용 자격 증명, 버릴 SNS 사용자가 있다. */
export type AccountRecoveryEntry = {
  phone: string;
  credential: PhoneCollisionCredential | null;
  /** 가입 중이던 SNS Firebase 사용자. 전화번호 로그인 전에 지운다(실패해도 넘어간다). */
  abandonedUid: string | null;
};

export type AccountRecoveryView =
  /** 가입 충돌의 자격 증명으로 SMS 없이 확인하는 중 */
  | { step: 'checking' }
  | { step: 'phone'; sending: boolean }
  | { step: 'code'; verificationId: string; verifying: boolean }
  | { step: 'looking-up' }
  | { step: 'found'; provider: FirebaseLoginProvider; maskedEmail: string | null }
  | { step: 'not-found' }
  | { step: 'action-required' }
  /** retryAt은 429에서 다시 시도 버튼을 막을 시각이다. */
  | { step: 'lookup-failed'; message: string; action: 'retry' | 'restart'; retryAt: number | null };

export type AccountRecoveryState = {
  view: AccountRecoveryView;
  phone: string;
  code: string;
  error: string | null;
  /** prepare 429. 이 시각까지 인증번호 요청을 막고 화면은 버튼 안에 남은 시간을 센다. */
  blockedUntil: number | null;
  /** 사용자가 기다리는 접수번호 요청이 진행 중이다. */
  preparing: boolean;
  /** 가입 충돌의 자격 증명을 접수번호 문제로 못 썼고, 번호가 그대로라 SMS 없이 다시 시도할 수 있다. */
  canRetryCredential: boolean;
};

/**
 * verify-again: 접수번호·인증을 처음부터 다시 받는다(만료·충돌·인증 거절)
 * retry: 같은 접수번호·토큰으로 다시 보낼 수 있다
 * restart: 요청 자체가 잘못됐다. 처음부터 다시 한다
 */
type LookupFailure =
  | { kind: 'verify-again'; message: string }
  | { kind: 'retry'; message: string; retryAt: number | null }
  | { kind: 'restart'; message: string };

export function decideLookupFailure(error: unknown, now: number): LookupFailure {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'RECOVERY_EXPIRED':
        return { kind: 'verify-again', message: ACCOUNT_RECOVERY_MESSAGES.expired };
      case 'RECOVERY_CONFLICT':
      case 'INVALID_RECOVERY_PROOF':
      case 'RECOVERY_RECENT_AUTH_REQUIRED':
        return { kind: 'verify-again', message: ACCOUNT_RECOVERY_MESSAGES.verifyAgain };
    }
    if (error.status === 429)
      return {
        kind: 'retry',
        message: ACCOUNT_RECOVERY_MESSAGES.rateLimited,
        retryAt: now + (error.retryAfterSeconds ?? DEFAULT_RATE_LIMIT_MS / 1000) * 1000,
      };
  }
  const recovery = classifyAuthRecovery(error);
  return recovery.action === 'retry'
    ? { kind: 'retry', message: AUTH_RECOVERY_MESSAGES[recovery.reason], retryAt: null }
    : { kind: 'restart', message: ACCOUNT_RECOVERY_MESSAGES.unexpected };
}

/** 전화 로그인 실패. code는 같은 인증번호 화면에 남고, phone은 인증번호를 다시 받는다. */
function describePhoneFailure(error: unknown): { stay: 'code' | 'phone'; message: string } {
  switch (readFirebaseSdkErrorCode(error)) {
    case 'auth/invalid-verification-code':
      return { stay: 'code', message: ACCOUNT_RECOVERY_MESSAGES.wrongCode };
    case 'auth/session-expired':
    case 'auth/invalid-verification-id':
    case 'auth/code-expired':
      return { stay: 'phone', message: ACCOUNT_RECOVERY_MESSAGES.codeExpired };
    case 'auth/invalid-phone-number':
      return { stay: 'phone', message: ACCOUNT_RECOVERY_MESSAGES.invalidPhone };
    case 'auth/too-many-requests':
    case 'auth/quota-exceeded':
      return { stay: 'phone', message: ACCOUNT_RECOVERY_MESSAGES.tooManyCodes };
    case 'auth/network-request-failed':
      return { stay: 'code', message: AUTH_RECOVERY_MESSAGES.connection };
    default:
      return { stay: 'phone', message: ACCOUNT_RECOVERY_MESSAGES.phoneFailed };
  }
}

function toE164(phone: string): string {
  return `+82${phone.slice(1)}`;
}

function withJitter(delay: number): number {
  return delay + Math.floor(Math.random() * delay * 0.2);
}

export interface AccountRecoveryDependencies {
  prepare: (signal?: AbortSignal) => Promise<AccountRecoveryTicket>;
  lookup: (
    recoveryId: string,
    firebaseIdToken: string,
    signal?: AbortSignal,
  ) => Promise<AccountRecoveryResult>;
}

/**
 * 계정 찾기 한 번: prepare → 전화번호 로그인 → lookup. 로그인·병합은 하지 않는다.
 *
 * lookup은 토큰의 `auth_time`(전화 로그인 시각)이 접수번호 발급 뒤여야 받는다. 그래서 접수번호는
 * 전화 로그인 전에 새로 받아 두고, 남은 시간이 1분보다 짧아지면 앱 복귀·타이머로 다시 받는다.
 * 전화번호로 로그인한 Firebase 사용자는 남겨 둔다. 그 토큰으로는 exchange가 거절해 할 수 있는 일이 없고,
 * 다음 SNS 로그인이 currentUser를 바꾼다(2026-10-07 결정).
 * 화면이 사라지면 소유자가 dispose해 늦게 도착한 응답을 무시한다.
 */
export function createAccountRecoveryFlow(options: {
  entry: AccountRecoveryEntry;
  dependencies: AccountRecoveryDependencies;
}) {
  const { entry, dependencies } = options;
  const store = createStore<AccountRecoveryState>(() => ({
    view: entry.credential ? { step: 'checking' } : { step: 'phone', sending: false },
    phone: entry.phone,
    code: '',
    error: null,
    blockedUntil: null,
    preparing: false,
    canRetryCredential: false,
  }));
  const abort = new AbortController();
  let disposed = false;
  let ticket: AccountRecoveryTicket | null = null;
  let preparing: Promise<void> | null = null;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let sendTimer: ReturnType<typeof setTimeout> | null = null;
  const waitTimers = new Set<ReturnType<typeof setTimeout>>();
  // 번호 수정·재발송·다시 시작으로 올라간다. 이전 발송·확인의 늦은 결과를 버리는 기준이다.
  let generation = 0;
  let sendAttempts = 0;
  let nextSendAt = 0;
  let lookupProof: { recoveryId: string; firebaseIdToken: string } | null = null;
  let abandonedUid = entry.abandonedUid;
  // 접수번호를 받지 못해 아직 쓰지 못한 가입 충돌 자격 증명. 로그인 시도가 실패하면 버린다.
  let pendingCredential: PhoneCollisionCredential | null = null;

  const setView = (view: AccountRecoveryView) => store.setState({ view });

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        waitTimers.delete(timer);
        resolve();
      }, ms);
      waitTimers.add(timer);
    });
  }

  function hasTicket(margin: number): boolean {
    return ticket !== null && ticket.deadline - Date.now() > margin;
  }

  /** 아직 전화 로그인 전이라 새 접수번호가 의미 있는 단계. */
  function canRefreshTicket(): boolean {
    const { view } = store.getState();
    return view.step === 'phone' || (view.step === 'code' && !view.verifying);
  }

  function clearRefreshTimer(): void {
    if (refreshTimer !== null) clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  // 앱이 화면에 있는 동안 남은 시간이 1분이 되면 다시 받는다. 백그라운드에서는 JS 타이머가 늦을 수 있어
  // 앱 복귀 때도 확인한다.
  function scheduleRefresh(): void {
    clearRefreshTimer();
    if (!ticket) return;
    const delay = Math.max(0, ticket.deadline - TICKET_REFRESH_MARGIN_MS - Date.now());
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      refreshInBackground();
    }, delay);
  }

  function refreshInBackground(): void {
    if (disposed || !canRefreshTicket() || preparing) return;
    if (hasTicket(TICKET_REFRESH_MARGIN_MS)) {
      scheduleRefresh();
      return;
    }
    void prepareTicket('background');
  }

  /**
   * user: 사용자가 기다리는 요청. 실패를 화면에 알린다.
   * background: 화면에 알리지 않는다. 실패하면 기존 접수번호를 쓰다가 만료되면 lookup의 410으로 안내한다.
   */
  function prepareTicket(mode: 'user' | 'background'): Promise<void> {
    preparing ??= runPrepare(mode).finally(() => {
      preparing = null;
    });
    return preparing;
  }

  async function runPrepare(mode: 'user' | 'background'): Promise<void> {
    if (mode === 'user') store.setState({ preparing: true });
    try {
      for (let attempt = 0; ; attempt += 1) {
        try {
          const next = await dependencies.prepare(abort.signal);
          if (disposed) return;
          ticket = next;
          scheduleRefresh();
          return;
        } catch (error) {
          if (disposed) return;
          if (error instanceof ApiError && error.status === 429) {
            // 자동 재시도하지 않는다. 사용자가 시작한 요청이면 남은 시간 동안 버튼을 막는다.
            if (mode === 'user')
              store.setState({
                blockedUntil:
                  Date.now() + (error.retryAfterSeconds ?? DEFAULT_RATE_LIMIT_MS / 1000) * 1000,
                error: ACCOUNT_RECOVERY_MESSAGES.rateLimited,
              });
            return;
          }
          const recovery = classifyAuthRecovery(error);
          const delay = RETRY_DELAYS_MS[attempt];
          if (recovery.action === 'retry' && delay !== undefined) {
            await wait(withJitter(delay));
            if (disposed) return;
            continue;
          }
          if (mode === 'user')
            store.setState({
              error:
                recovery.action === 'retry'
                  ? AUTH_RECOVERY_MESSAGES[recovery.reason]
                  : ACCOUNT_RECOVERY_MESSAGES.unexpected,
            });
          return;
        }
      }
    } finally {
      if (mode === 'user' && !disposed) store.setState({ preparing: false });
    }
  }

  /**
   * 지금 접수번호로 충분하면 뒤에서 다시 받는 중이어도 기다리지 않는다. 연결이 나쁘면 그 재시도가 1분 넘게 걸린다.
   * 모자라면 진행 중인 요청(뒤에서 시작한 것 포함)을 기다리고, 그래도 모자라면 사용자 요청으로 다시 받는다.
   */
  async function ensureTicket(margin: number): Promise<boolean> {
    if (disposed) return false;
    if (hasTicket(margin)) return true;
    if (preparing) await preparing;
    if (disposed) return false;
    if (hasTicket(margin)) return true;
    const { blockedUntil } = store.getState();
    if (blockedUntil !== null && blockedUntil > Date.now()) {
      store.setState({ error: ACCOUNT_RECOVERY_MESSAGES.rateLimited });
      return false;
    }
    await prepareTicket('user');
    return !disposed && hasTicket(margin);
  }

  /** 가입 중이던 SNS Firebase 사용자를 한 번만 지운다. 최근 로그인 요구 등으로 실패하면 서버 정리에 맡긴다. */
  async function deleteAbandonedUser(): Promise<void> {
    const uid = abandonedUid;
    abandonedUid = null;
    const user = getAuth().currentUser;
    if (!uid || user?.uid !== uid) return;
    try {
      await deleteUser(user);
    } catch {
      // 다시 SNS 인증을 받게 하지 않는다(2026-10-06 결정).
    }
  }

  async function lookup(proof: { recoveryId: string; firebaseIdToken: string }): Promise<void> {
    lookupProof = proof;
    clearRefreshTimer();
    setView({ step: 'looking-up' });
    for (let attempt = 0; ; attempt += 1) {
      let result: AccountRecoveryResult;
      try {
        result = await dependencies.lookup(proof.recoveryId, proof.firebaseIdToken, abort.signal);
      } catch (error) {
        if (disposed) return;
        const failure = decideLookupFailure(error, Date.now());
        const delay = RETRY_DELAYS_MS[attempt];
        if (failure.kind === 'retry' && failure.retryAt === null && delay !== undefined) {
          await wait(withJitter(delay));
          if (disposed) return;
          continue;
        }
        switch (failure.kind) {
          case 'verify-again':
            verifyAgain(failure.message);
            return;
          case 'retry':
            setView({
              step: 'lookup-failed',
              message: failure.message,
              action: 'retry',
              retryAt: failure.retryAt,
            });
            return;
          case 'restart':
            setView({
              step: 'lookup-failed',
              message: failure.message,
              action: 'restart',
              retryAt: null,
            });
            return;
        }
      }
      if (disposed) return;
      switch (result.status) {
        case 'found':
          setView({ step: 'found', provider: result.provider, maskedEmail: result.maskedEmail });
          return;
        case 'not-found':
          setView({ step: 'not-found' });
          return;
        case 'action-required':
          setView({ step: 'action-required' });
          return;
      }
    }
  }

  /** 이 인증은 더 쓸 수 없다. 새 접수번호를 받고 같은 번호로 인증부터 다시 한다. */
  function verifyAgain(message: string): void {
    generation += 1;
    ticket = null;
    lookupProof = null;
    store.setState({ view: { step: 'phone', sending: false }, code: '', error: message });
    void prepareTicket('user');
  }

  async function checkWithCollisionCredential(credential: PhoneCollisionCredential): Promise<void> {
    // 정리는 접수번호보다 먼저 시작한다. currentUser를 바로 읽어 두므로, prepare를 기다리는 사이 화면을 떠나
    // 다른 SNS로 로그인해도 가입 중이던 사용자를 지운다.
    const cleanup = deleteAbandonedUser();
    const ready = await ensureTicket(LOOKUP_MARGIN_MS);
    await cleanup;
    if (disposed) return;
    // 접수번호를 받지 못하면 번호 화면에서 이어 간다. 안내는 prepare가 남겼다. 자격 증명은 아직 쓸 수 있어
    // 막힘이 풀리면 SMS 없이 다시 시도하게 남긴다.
    const current = ticket;
    if (!ready || !current) {
      pendingCredential = credential;
      store.setState({
        view: { step: 'phone', sending: false },
        canRetryCredential: store.getState().phone === entry.phone,
      });
      return;
    }
    pendingCredential = null;
    store.setState({ canRetryCredential: false });
    let firebaseIdToken: string;
    try {
      // 네이티브가 해시(token)로 보관한 자격 증명을 찾아 쓴다. 앱이 재시작됐으면 실패한다.
      const { user } = await signInWithCredential(
        getAuth(),
        new AuthCredential('phone', 'phone', credential.token, ''),
      );
      firebaseIdToken = await getIdToken(user, false);
    } catch {
      // 이 경로에서는 prepare가 성공해 남긴 안내가 없다. SMS를 다시 받아야 하는 이유를 알린다.
      if (!disposed)
        store.setState({
          view: { step: 'phone', sending: false },
          error: ACCOUNT_RECOVERY_MESSAGES.verifyAgain,
        });
      return;
    }
    if (disposed) return;
    await lookup({ recoveryId: current.recoveryId, firebaseIdToken });
  }

  function clearSendTimer(): void {
    if (sendTimer !== null) clearTimeout(sendTimer);
    sendTimer = null;
  }

  function setPhone(phone: string): void {
    const { view } = store.getState();
    if (view.step !== 'phone' || view.sending) return;
    const next = phone.replace(/\D/g, '').slice(0, 11);
    // 자격 증명은 가입 때 번호의 것이다. 번호를 고치면 그 번호는 SMS로만 확인한다.
    store.setState({
      phone: next,
      error: null,
      canRetryCredential: pendingCredential !== null && next === entry.phone,
    });
  }

  /** 접수번호 문제로 멈춘 가입 충돌 자격 증명 확인을 다시 한다. 429 남은 시간 동안은 막는다. */
  function retryCredential(): void {
    const current = store.getState();
    const { view } = current;
    const credential = pendingCredential;
    if (
      disposed ||
      !credential ||
      !current.canRetryCredential ||
      current.preparing ||
      view.step !== 'phone' ||
      view.sending
    )
      return;
    if (current.blockedUntil !== null && current.blockedUntil > Date.now()) return;
    generation += 1;
    clearSendTimer();
    store.setState({ view: { step: 'checking' }, error: null });
    void checkWithCollisionCredential(credential);
  }

  function setCode(code: string): void {
    const { view } = store.getState();
    if (view.step !== 'code' || view.verifying) return;
    store.setState({ code: code.replace(/\D/g, '').slice(0, 6), error: null });
  }

  /** 번호 입력·인증번호 단계 모두에서 부른다(다시 받기). */
  async function requestCode(): Promise<void> {
    const current = store.getState();
    const { view } = current;
    if (
      disposed ||
      current.preparing ||
      (view.step !== 'phone' && view.step !== 'code') ||
      (view.step === 'phone' && view.sending) ||
      (view.step === 'code' && view.verifying)
    )
      return;
    if (current.blockedUntil !== null && current.blockedUntil > Date.now()) return;
    if (!KOREAN_MOBILE_PATTERN.test(current.phone)) {
      store.setState({ error: ACCOUNT_RECOVERY_MESSAGES.invalidPhone });
      return;
    }
    if (sendAttempts >= MAX_SEND_ATTEMPTS) {
      store.setState({ error: ACCOUNT_RECOVERY_MESSAGES.sendLimit });
      return;
    }
    const waitSeconds = Math.ceil((nextSendAt - Date.now()) / 1000);
    if (waitSeconds > 0) {
      store.setState({ error: `${waitSeconds}초 후에 인증번호를 다시 받을 수 있어요.` });
      return;
    }

    generation += 1;
    const attempt = generation;
    clearSendTimer();
    store.setState({ view: { step: 'phone', sending: true }, code: '', error: null });
    if (!(await ensureTicket(TICKET_REFRESH_MARGIN_MS))) {
      if (attempt === generation) setView({ step: 'phone', sending: false });
      return;
    }
    if (attempt !== generation) return;

    const delaySeconds =
      RESEND_DELAYS_SECONDS[Math.min(sendAttempts, RESEND_DELAYS_SECONDS.length - 1)];
    const forceResend = sendAttempts > 0;
    // 응답이 유실돼도 발송됐을 수 있으므로 시도 횟수에 포함한다.
    sendAttempts += 1;
    nextSendAt = Date.now() + delaySeconds * 1000;
    sendTimer = setTimeout(() => {
      sendTimer = null;
      if (attempt !== generation) return;
      store.setState({
        view: { step: 'phone', sending: false },
        error: ACCOUNT_RECOVERY_MESSAGES.sendDelayed,
      });
    }, SEND_TIMEOUT_MS);

    const fail = (error: unknown) => {
      clearSendTimer();
      store.setState({
        view: { step: 'phone', sending: false },
        error: describePhoneFailure(error).message,
      });
    };
    try {
      verifyPhoneNumber(
        getAuth(),
        toE164(current.phone),
        AUTO_RETRIEVAL_TIMEOUT_SECONDS,
        forceResend,
      ).on('state_changed', (snapshot) => {
        if (attempt !== generation) return;
        if (snapshot.state === 'error') {
          fail(snapshot.error);
          return;
        }
        if (!snapshot.verificationId) return;
        clearSendTimer();
        const latest = store.getState().view;
        // 자동 인증이 늦게 오면 코드만 채우고 사용자가 확인을 누르게 한다.
        if (latest.step === 'code' && latest.verifying) return;
        store.setState({
          view: { step: 'code', verificationId: snapshot.verificationId, verifying: false },
          code: snapshot.code ? snapshot.code.slice(0, 6) : store.getState().code,
          error: null,
        });
      });
    } catch (error) {
      fail(error);
    }
  }

  async function verifyCode(): Promise<void> {
    const current = store.getState();
    const { view } = current;
    if (disposed || view.step !== 'code' || view.verifying || !/^\d{6}$/.test(current.code)) return;
    const attempt = generation;
    const { verificationId } = view;
    store.setState({ view: { step: 'code', verificationId, verifying: true }, error: null });
    // 접수번호는 전화 로그인보다 먼저 있어야 lookup이 이 인증을 인정한다. 뒤에서 다시 받는 중이면 기다린다.
    const ready = await ensureTicket(LOOKUP_MARGIN_MS);
    if (attempt !== generation) return;
    const proofTicket = ticket;
    if (!ready || !proofTicket) {
      setView({ step: 'code', verificationId, verifying: false });
      return;
    }
    let firebaseIdToken: string;
    try {
      const credential = PhoneAuthProvider.credential(verificationId, current.code);
      const { user } = await signInWithCredential(getAuth(), credential);
      firebaseIdToken = await getIdToken(user, false);
    } catch (error) {
      if (attempt !== generation) return;
      const failure = describePhoneFailure(error);
      store.setState(
        failure.stay === 'code'
          ? { view: { step: 'code', verificationId, verifying: false }, error: failure.message }
          : { view: { step: 'phone', sending: false }, code: '', error: failure.message },
      );
      return;
    }
    if (attempt !== generation) return;
    await lookup({ recoveryId: proofTicket.recoveryId, firebaseIdToken });
  }

  /** 인증번호 단계에서 번호를 고친다. 진행 중인 발송 결과는 무시한다. */
  function editPhone(): void {
    const { view } = store.getState();
    if (view.step !== 'code' || view.verifying) return;
    generation += 1;
    clearSendTimer();
    store.setState({ view: { step: 'phone', sending: false }, code: '', error: null });
  }

  function retryLookup(): void {
    const { view } = store.getState();
    if (view.step !== 'lookup-failed') return;
    if (view.retryAt !== null && view.retryAt > Date.now()) return;
    if (view.action === 'restart' || !lookupProof) {
      restart();
      return;
    }
    void lookup(lookupProof);
  }

  /** 번호 입력부터 다시 한다. 접수번호가 모자라면 다시 받는다. */
  function restart(): void {
    generation += 1;
    lookupProof = null;
    clearSendTimer();
    store.setState({ view: { step: 'phone', sending: false }, code: '', error: null });
    if (hasTicket(TICKET_REFRESH_MARGIN_MS)) scheduleRefresh();
    else void prepareTicket('user');
  }

  const appState = AppState.addEventListener('change', (next) => {
    if (next === 'active') refreshInBackground();
  });

  if (entry.credential) {
    void checkWithCollisionCredential(entry.credential);
  } else {
    // 분기 없이 먼저 받는다. 가입된 번호에만 부르면 호출 여부가 계정 존재 신호가 된다.
    void prepareTicket('user');
    void deleteAbandonedUser();
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    generation += 1;
    abort.abort();
    appState.remove();
    clearRefreshTimer();
    clearSendTimer();
    waitTimers.forEach(clearTimeout);
    waitTimers.clear();
  }

  return {
    getState: store.getState,
    getInitialState: store.getInitialState,
    subscribe: store.subscribe,
    setPhone,
    setCode,
    retryCredential,
    requestCode,
    verifyCode,
    editPhone,
    retryLookup,
    restart,
    dispose,
  };
}
