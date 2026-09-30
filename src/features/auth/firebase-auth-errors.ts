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
