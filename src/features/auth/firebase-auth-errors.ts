import {
  FirebaseAuthenticationError,
  type FirebaseAuthFailure,
  type FirebaseAuthFailureReason,
} from '@/features/auth/firebase-auth-types';

export function readFirebaseSdkErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}

/** RNFirebase의 사용자 취소만 해당한다. cancelled-popup-request는 중복 실행 오류다. */
export function isFirebaseProviderCancellation(error: unknown): boolean {
  const code = readFirebaseSdkErrorCode(error);
  return code === 'auth/popup-closed-by-user' || code === 'auth/web-context-cancelled';
}

export function resolveFirebaseAuthFailure(reason: FirebaseAuthFailureReason): FirebaseAuthFailure {
  switch (reason) {
    case 'connection':
    case 'service-unavailable':
      return { kind: 'failed', reason, nextAction: 'retry' };
    case 'reauthentication-required':
      return { kind: 'failed', reason, nextAction: 'sign-in-again' };
    case 'provider-unavailable':
    case 'unexpected':
      return { kind: 'failed', reason, nextAction: 'get-help' };
  }
}

export function classifyFirebaseAuthFailure(error: unknown): FirebaseAuthFailure {
  if (error instanceof FirebaseAuthenticationError) return resolveFirebaseAuthFailure(error.reason);
  const code = readFirebaseSdkErrorCode(error);
  switch (code) {
    case 'auth/network-request-failed':
      return resolveFirebaseAuthFailure('connection');
    case 'auth/too-many-requests':
    case 'auth/quota-exceeded':
      return resolveFirebaseAuthFailure('service-unavailable');
    case 'auth/requires-recent-login':
    case 'auth/user-token-expired':
    case 'auth/invalid-user-token':
    case 'auth/user-mismatch':
      return resolveFirebaseAuthFailure('reauthentication-required');
    case 'app/no-app':
    case 'auth/operation-not-allowed':
    case 'auth/invalid-api-key':
    case 'auth/app-not-authorized':
    case 'auth/unauthorized-domain':
    case 'auth/invalid-oauth-client-id':
      return resolveFirebaseAuthFailure('provider-unavailable');
    default:
      // 외부 오류 코드는 열린 집합이다. internal-error·계정 충돌·정지를 재시도로 추정하지 않는다.
      return resolveFirebaseAuthFailure('unexpected');
  }
}

/**
 * 전화번호 연결이 다른 Firebase 사용자와 충돌했을 때 SDK가 실어 주는 교환용 자격 증명.
 * token은 네이티브 메모리에 보관된 자격 증명의 해시라 앱이 재시작되면 쓸 수 없다. 저장·로그 금지.
 */
export type PhoneCollisionCredential = { token: string };

/**
 * RNFirebase는 updated credential을 `userInfo.authCredential`에 넣는다. JS의
 * `PhoneAuthProvider.credentialFromError()`는 항상 null이라 쓰지 않는다.
 * `userInfo`는 열거되지 않는 속성이라 직접 읽는다.
 */
export function readPhoneCollisionCredential(error: unknown): PhoneCollisionCredential | null {
  if (typeof error !== 'object' || error === null || !('userInfo' in error)) return null;
  const { userInfo } = error;
  if (typeof userInfo !== 'object' || userInfo === null || !('authCredential' in userInfo))
    return null;
  const { authCredential } = userInfo;
  if (
    typeof authCredential !== 'object' ||
    authCredential === null ||
    !('providerId' in authCredential) ||
    !('token' in authCredential) ||
    authCredential.providerId !== 'phone' ||
    typeof authCredential.token !== 'string' ||
    !authCredential.token
  )
    return null;
  return { token: authCredential.token };
}
