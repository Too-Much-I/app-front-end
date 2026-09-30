import {
  getAuth,
  getIdToken,
  linkWithCredential,
  onAuthStateChanged,
  PhoneAuthProvider,
  verifyPhoneNumber,
} from '@react-native-firebase/auth';
import { createStore } from 'zustand/vanilla';

import { readFirebaseSdkErrorCode } from '@/features/auth/firebase-auth-errors';

// 사용자 확인을 받은 Firebase 콘솔 테스트 번호. 실제 가입 경로에서는 사용하지 않는다.
const TEST_PHONE = '+821012345678';
const RETRY_DELAYS = [15, 30, 45, 60] as const;
// SDK 응답이 없을 때 검증 화면에 갇히지 않게 하는 복구 기한이며 SMS 만료 시간이 아니다.
const REQUEST_TIMEOUT_MS = 45_000;

type PhoneValidationStage =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'send-delayed' }
  | { status: 'code'; verificationId: string }
  | { status: 'verifying'; verificationId: string }
  | { status: 'linked' }
  | { status: 'refreshing' }
  | { status: 'complete' };

interface PhoneValidationData {
  uid: string | null;
  connection: { status: 'idle' } | { status: 'running' | 'delayed'; uid: string };
  stage: PhoneValidationStage;
  code: string;
  attempts: number;
  nextSendAt: number;
  message: string;
}

function emptyPhoneValidation(uid: string | null): PhoneValidationData {
  return {
    uid,
    connection: { status: 'idle' },
    stage: { status: 'idle' },
    code: '',
    attempts: 0,
    nextSendAt: 0,
    message: '테스트 번호로 인증을 요청하세요.',
  };
}

function phoneValidationError(error: unknown): string {
  switch (readFirebaseSdkErrorCode(error)) {
    case 'auth/credential-already-in-use':
      return '다른 계정에 연결된 번호입니다. 다른 번호로 인증해주세요. 이 검증 화면은 지정된 테스트 번호만 사용합니다.';
    case 'auth/provider-already-linked':
      return '현재 계정에 전화번호가 이미 연결돼 있습니다. 연결된 번호를 확인해주세요.';
    case 'auth/invalid-verification-code':
      return '인증번호가 일치하지 않아요. 다시 확인해주세요.';
    case 'auth/session-expired':
    case 'auth/invalid-verification-id':
      return '인증 시도가 만료됐어요. 인증번호를 다시 받아주세요.';
    case 'auth/too-many-requests':
    case 'auth/quota-exceeded':
      return 'Firebase 발송 제한에 도달했어요. 잠시 후 다시 시도해주세요.';
    case 'auth/requires-recent-login':
      return 'SNS 로그인을 다시 진행해주세요.';
    default:
      return '요청을 완료하지 못했어요. 연결과 Firebase 설정을 확인해주세요.';
  }
}

/** 개발 검증 전용. 화면을 나가도 유지하며 디스크·로그에 인증 자료를 남기지 않는다. */
export function createFirebasePhoneValidation() {
  const store = createStore<PhoneValidationData>(() => emptyPhoneValidation(null));
  let generation = 0;
  const isConnecting = () => store.getState().connection.status !== 'idle';
  const busy = () => ['sending', 'verifying', 'refreshing'].includes(store.getState().stage.status);
  function syncUser(uid: string | null) {
    if (store.getState().uid !== uid) {
      generation++;
      // UID가 바뀌어도 실제 네이티브 연결 작업이 끝나기 전까지 추가 요청을 막는다.
      const connection = store.getState().connection;
      store.setState({ ...emptyPhoneValidation(uid), connection });
    }
  }
  function observeUser() {
    syncUser(getAuth().currentUser?.uid ?? null);
    return onAuthStateChanged(getAuth(), (user) => syncUser(user?.uid ?? null));
  }
  async function refreshProof() {
    if (busy() || isConnecting()) return;
    const user = getAuth().currentUser;
    if (!user || user.uid !== store.getState().uid || user.phoneNumber !== TEST_PHONE) return;
    const attempt = generation;
    store.setState({ stage: { status: 'refreshing' }, code: '' });
    const timer = setTimeout(() => {
      if (generation !== attempt) return;
      generation++;
      store.setState({
        stage: { status: 'linked' },
        message: '토큰 갱신 응답을 확인하지 못했어요. 다시 시도해주세요.',
      });
    }, REQUEST_TIMEOUT_MS);
    try {
      await getIdToken(user, true);
      if (generation !== attempt || getAuth().currentUser?.uid !== user.uid) return;
      store.setState({
        stage: { status: 'complete' },
        message:
          '같은 Firebase 사용자에 전화번호 연결과 토큰 갱신을 완료했어요. 서버 회원가입은 실행하지 않았어요.',
      });
    } catch (error) {
      if (generation === attempt)
        store.setState({ stage: { status: 'linked' }, message: phoneValidationError(error) });
    } finally {
      clearTimeout(timer);
    }
  }
  function requestCode() {
    if (isConnecting() || store.getState().stage.status === 'refreshing') return;
    const user = getAuth().currentUser;
    syncUser(user?.uid ?? null);
    if (!user) {
      store.setState({ message: '먼저 SNS 로그인을 완료해주세요.' });
      return;
    }
    if (user.phoneNumber === TEST_PHONE) {
      store.setState({ stage: { status: 'linked' }, code: '' });
      void refreshProof();
      return;
    }
    const current = store.getState();
    if (current.attempts >= 5 || Date.now() < current.nextSendAt) return;
    const attempt = ++generation;
    // 응답 유실도 발송됐을 수 있으므로 시도 횟수에 포함한다.
    store.setState({
      stage: { status: 'sending' },
      code: '',
      attempts: current.attempts + 1,
      nextSendAt: Date.now() + (RETRY_DELAYS[Math.min(current.attempts, 3)] ?? 60) * 1000,
      message: 'Firebase에 인증번호를 요청하고 있어요.',
    });
    let settled = false;
    const finish = () => {
      settled = true;
      clearTimeout(timer);
    };
    const timer = setTimeout(() => {
      if (settled || attempt !== generation) return;
      // 타임아웃은 이탈만 허용한다. 새 발송 전에는 늦게 도착한 응답도 유효하다.
      store.setState({
        stage: { status: 'send-delayed' },
        message: '발송 응답이 늦어지고 있어요. 응답을 기다리거나 인증번호를 다시 요청해주세요.',
      });
    }, REQUEST_TIMEOUT_MS);
    try {
      verifyPhoneNumber(getAuth(), TEST_PHONE, 20, current.attempts > 0).on(
        'state_changed',
        (snapshot) => {
          if (settled || generation !== attempt || getAuth().currentUser?.uid !== user.uid) return;
          if (snapshot.state === 'error') {
            finish();
            store.setState({
              stage: { status: 'idle' },
              message: phoneValidationError(snapshot.error),
            });
          } else if (snapshot.verificationId) {
            finish();
            store.setState({
              stage: { status: 'code', verificationId: snapshot.verificationId },
              message: '테스트 코드를 입력하고 인증 버튼을 눌러주세요.',
            });
          }
        },
      );
    } catch (error) {
      finish();
      store.setState({ stage: { status: 'idle' }, message: phoneValidationError(error) });
    }
  }
  async function verifyCode() {
    const current = store.getState();
    if (current.stage.status !== 'code' || !/^\d{6}$/.test(current.code) || isConnecting()) return;
    const user = getAuth().currentUser;
    if (!user || user.uid !== current.uid) {
      syncUser(user?.uid ?? null);
      return;
    }
    const attempt = generation;
    const verificationId = current.stage.verificationId;
    store.setState({
      stage: { status: 'verifying', verificationId },
      connection: { status: 'running', uid: user.uid },
    });
    const timer = setTimeout(() => {
      store.setState({ connection: { status: 'delayed', uid: user.uid } });
    }, REQUEST_TIMEOUT_MS);
    try {
      await linkWithCredential(user, PhoneAuthProvider.credential(verificationId, current.code));
      if (generation !== attempt || getAuth().currentUser?.uid !== user.uid) return;
      store.setState({ stage: { status: 'linked' }, code: '' });
    } catch (error) {
      if (generation === attempt)
        store.setState({
          stage: { status: 'code', verificationId },
          message: phoneValidationError(error),
        });
    } finally {
      clearTimeout(timer);
      store.setState({ connection: { status: 'idle' } });
    }
    if (generation === attempt && store.getState().stage.status === 'linked') await refreshProof();
  }
  return Object.assign(store, {
    observeUser,
    requestCode,
    verifyCode,
    refreshProof,
    setCode(code: string) {
      if (store.getState().stage.status === 'code')
        store.setState({ code: code.replace(/\D/g, '').slice(0, 6) });
    },
  });
}
