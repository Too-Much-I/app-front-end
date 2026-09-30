import {
  getAuth,
  linkWithCredential,
  PhoneAuthProvider,
  verifyPhoneNumber,
} from '@react-native-firebase/auth';
import { createStore } from 'zustand/vanilla';

import { readFirebaseSdkErrorCode } from '@/features/auth/firebase-auth-errors';
import type { createSignupDraftStore } from '@/features/auth/signup-draft-store';

const MAX_SEND_ATTEMPTS = 5;
const RESEND_DELAYS_SECONDS = [15, 30, 45, 60] as const;
// Android 자동 인증을 기다리는 시간(초). SMS 코드 만료 시간이 아니다.
const AUTO_RETRIEVAL_TIMEOUT_SECONDS = 30;
// SDK 응답이 없을 때 발송 중 화면에 갇히지 않게 재요청을 허용하는 기한.
const SEND_TIMEOUT_MS = 45_000;
const KOREAN_MOBILE_PATTERN = /^010\d{8}$/;

export type SignupPhoneStage =
  | { status: 'idle' }
  | { status: 'sending'; delayed: boolean }
  | { status: 'code'; verificationId: string }
  | { status: 'verifying'; verificationId: string }
  | { status: 'verified' };

type SignupPhoneVerificationState = {
  /** 이 인증 상태가 속한 초안의 phoneRevision. 번호가 바뀌면 이전 인증을 버린다. */
  revision: number;
  stage: SignupPhoneStage;
  code: string;
  attempts: number;
  nextSendAt: number;
  error: string | null;
};

function emptyPhoneVerification(revision: number): SignupPhoneVerificationState {
  return {
    revision,
    stage: { status: 'idle' },
    code: '',
    attempts: 0,
    nextSendAt: 0,
    error: null,
  };
}

function toE164(phone: string): string {
  return `+82${phone.slice(1)}`;
}

type PhoneFailure = { stage: 'idle' | 'code' | 'verified' | 'reauth'; message: string | null };

function classifyPhoneFailure(error: unknown): PhoneFailure {
  switch (readFirebaseSdkErrorCode(error)) {
    case 'auth/invalid-verification-code':
      return { stage: 'code', message: '인증번호가 일치하지 않아요. 다시 확인해 주세요.' };
    case 'auth/session-expired':
    case 'auth/invalid-verification-id':
    case 'auth/code-expired':
      return { stage: 'idle', message: '인증번호가 만료됐어요. 인증번호를 다시 받아 주세요.' };
    case 'auth/credential-already-in-use':
    case 'auth/account-exists-with-different-credential':
      return {
        stage: 'idle',
        message: '다른 계정에 연결된 번호예요. 다른 번호로 인증해 주세요.',
      };
    case 'auth/provider-already-linked':
      // 이 Firebase 사용자에 이미 번호가 연결돼 있다. 서버가 가입 제출에서 증명으로 확인한다.
      return { stage: 'verified', message: null };
    case 'auth/invalid-phone-number':
      return { stage: 'idle', message: '휴대전화 번호를 확인해 주세요.' };
    case 'auth/too-many-requests':
    case 'auth/quota-exceeded':
      return {
        stage: 'idle',
        message: '인증 요청이 너무 많아요. 잠시 후 다시 시도해 주세요.',
      };
    case 'auth/network-request-failed':
      return {
        stage: 'idle',
        message: '연결이 원활하지 않아요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
      };
    case 'auth/requires-recent-login':
    case 'auth/user-token-expired':
    case 'auth/invalid-user-token':
    case 'auth/user-mismatch':
      return { stage: 'reauth', message: null };
    default:
      return { stage: 'idle', message: '인증을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.' };
  }
}

/**
 * 가입 중인 Firebase 사용자(uid)에 전화번호를 연결한다. 번호로 별도 사용자를 로그인시키지 않는다.
 * 가입 흐름이 소유하므로 단계를 오가도 인증 완료를 유지하고, 번호가 바뀌면 다시 받는다.
 * 인증번호·credential은 메모리에만 두며 로그로 남기지 않는다.
 */
export function createSignupPhoneVerification(options: {
  uid: string;
  draftStore: ReturnType<typeof createSignupDraftStore>;
  /** 연결 대상 Firebase 사용자가 바뀌었거나 SNS 재인증이 필요할 때 호출한다. */
  onReauthRequired: () => void;
}) {
  const { uid, draftStore } = options;
  const store = createStore<SignupPhoneVerificationState>(() =>
    emptyPhoneVerification(draftStore.getState().phoneRevision),
  );
  let generation = 0;
  let sendTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  function clearSendTimer(): void {
    if (sendTimer !== null) clearTimeout(sendTimer);
    sendTimer = null;
  }

  function invalidate(): void {
    generation += 1;
    clearSendTimer();
  }

  /** 초안의 번호가 바뀌었으면 진행 중인 요청과 이전 인증을 버린다. */
  function syncRevision(): void {
    const revision = draftStore.getState().phoneRevision;
    if (store.getState().revision === revision) return;
    invalidate();
    store.setState(emptyPhoneVerification(revision));
  }
  const stopDraftSync = draftStore.subscribe(syncRevision);

  function currentUser() {
    const user = getAuth().currentUser;
    return user?.uid === uid ? user : null;
  }

  function requireReauth(): void {
    invalidate();
    options.onReauthRequired();
  }

  function requestCode(): void {
    syncRevision();
    const current = store.getState();
    const { stage } = current;
    if (
      disposed ||
      stage.status === 'verifying' ||
      stage.status === 'verified' ||
      (stage.status === 'sending' && !stage.delayed)
    )
      return;
    const { phone } = draftStore.getState();
    if (!KOREAN_MOBILE_PATTERN.test(phone)) {
      store.setState({ error: '휴대전화 번호를 확인해 주세요.' });
      return;
    }
    const user = currentUser();
    if (!user) {
      requireReauth();
      return;
    }
    const e164 = toE164(phone);
    if (user.phoneNumber === e164) {
      store.setState({ stage: { status: 'verified' }, code: '', error: null });
      return;
    }
    if (current.attempts >= MAX_SEND_ATTEMPTS) {
      store.setState({ error: '인증번호 요청 횟수를 넘었어요. 잠시 후 다시 시도해 주세요.' });
      return;
    }
    const waitSeconds = Math.ceil((current.nextSendAt - Date.now()) / 1000);
    if (waitSeconds > 0) {
      store.setState({ error: `${waitSeconds}초 후에 인증번호를 다시 받을 수 있어요.` });
      return;
    }

    invalidate();
    const attempt = generation;
    const delaySeconds =
      RESEND_DELAYS_SECONDS[Math.min(current.attempts, RESEND_DELAYS_SECONDS.length - 1)];
    // 응답이 유실돼도 발송됐을 수 있으므로 시도 횟수에 포함한다.
    store.setState({
      stage: { status: 'sending', delayed: false },
      code: '',
      attempts: current.attempts + 1,
      nextSendAt: Date.now() + delaySeconds * 1000,
      error: null,
    });
    sendTimer = setTimeout(() => {
      sendTimer = null;
      if (attempt !== generation) return;
      store.setState({
        stage: { status: 'sending', delayed: true },
        error: '인증번호 발송이 늦어지고 있어요. 조금 더 기다리거나 다시 요청해 주세요.',
      });
    }, SEND_TIMEOUT_MS);

    try {
      verifyPhoneNumber(getAuth(), e164, AUTO_RETRIEVAL_TIMEOUT_SECONDS, current.attempts > 0).on(
        'state_changed',
        (snapshot) => {
          if (attempt !== generation) return;
          if (snapshot.state === 'error') {
            clearSendTimer();
            const failure = classifyPhoneFailure(snapshot.error);
            if (failure.stage === 'reauth') requireReauth();
            else store.setState({ stage: { status: 'idle' }, error: failure.message });
            return;
          }
          if (!snapshot.verificationId) return;
          clearSendTimer();
          const { stage: latest } = store.getState();
          // 자동 인증이 늦게 오면 코드만 채우고 사용자가 확인을 누르게 한다.
          if (latest.status === 'verifying' || latest.status === 'verified') return;
          store.setState({
            stage: { status: 'code', verificationId: snapshot.verificationId },
            code: snapshot.code ? snapshot.code.slice(0, 6) : store.getState().code,
            error: null,
          });
        },
      );
    } catch (error) {
      clearSendTimer();
      const failure = classifyPhoneFailure(error);
      if (failure.stage === 'reauth') requireReauth();
      else store.setState({ stage: { status: 'idle' }, error: failure.message });
    }
  }

  function setCode(code: string): void {
    if (store.getState().stage.status !== 'code') return;
    store.setState({ code: code.replace(/\D/g, '').slice(0, 6), error: null });
  }

  async function verifyCode(): Promise<void> {
    syncRevision();
    const current = store.getState();
    if (disposed || current.stage.status !== 'code' || !/^\d{6}$/.test(current.code)) return;
    const user = currentUser();
    if (!user) {
      requireReauth();
      return;
    }
    const attempt = generation;
    const { verificationId } = current.stage;
    store.setState({ stage: { status: 'verifying', verificationId }, error: null });
    try {
      await linkWithCredential(user, PhoneAuthProvider.credential(verificationId, current.code));
      if (attempt !== generation) return;
      if (!currentUser()) {
        requireReauth();
        return;
      }
      store.setState({ stage: { status: 'verified' }, code: '', error: null });
    } catch (error) {
      if (attempt !== generation) return;
      const failure = classifyPhoneFailure(error);
      switch (failure.stage) {
        case 'reauth':
          requireReauth();
          return;
        case 'verified':
          store.setState({ stage: { status: 'verified' }, code: '', error: null });
          return;
        case 'code':
          store.setState({ stage: { status: 'code', verificationId }, error: failure.message });
          return;
        case 'idle':
          store.setState({ stage: { status: 'idle' }, code: '', error: failure.message });
          return;
      }
      const unhandled: never = failure.stage;
      throw new Error(`처리하지 않은 전화 인증 실패: ${unhandled}`);
    }
  }

  /** 번호 수정. 진행 중인 발송·확인 결과는 무시한다. 이미 연결된 번호는 Firebase에 남는다. */
  function editPhone(): void {
    invalidate();
    const { attempts, nextSendAt } = store.getState();
    store.setState({ stage: { status: 'idle' }, code: '', error: null, attempts, nextSendAt });
  }

  function isVerified(): boolean {
    syncRevision();
    return store.getState().stage.status === 'verified';
  }

  /** 서버가 전화 인증이 안 됐다고 판단했을 때 처음부터 다시 받는다. */
  function reset(message: string | null = null): void {
    invalidate();
    store.setState({
      ...emptyPhoneVerification(draftStore.getState().phoneRevision),
      error: message,
    });
  }

  function dispose(): void {
    disposed = true;
    invalidate();
    stopDraftSync();
  }

  return {
    getState: store.getState,
    getInitialState: store.getInitialState,
    subscribe: store.subscribe,
    requestCode,
    setCode,
    verifyCode,
    editPhone,
    isVerified,
    reset,
    dispose,
  };
}
