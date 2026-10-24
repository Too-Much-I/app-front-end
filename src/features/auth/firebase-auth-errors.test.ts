import {
  classifyFirebaseAuthFailure,
  isFirebaseProviderCancellation,
} from '@/features/auth/firebase-auth-errors';

/** RNFirebase가 네이티브 오류를 JS로 넘길 때의 모양. `code`만 본다. */
function sdkError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

describe('소셜 로그인 창을 닫은 것은 취소로 본다', () => {
  it.each([
    // iOS: RNFBAuthHelper.m이 FIRAuthErrorCodeWebContextCancelled를 이 이름으로 바꾼다.
    'auth/popup-closed-by-user',
    // Android: ERROR_WEB_CONTEXT_CANCELED를 소문자·하이픈으로 바꾼 값(l 하나). 카카오·Apple 웹 로그인.
    'auth/web-context-canceled',
  ])('%s', (code) => {
    expect(isFirebaseProviderCancellation(sdkError(code))).toBe(true);
  });

  it.each([
    // 중복 실행 오류라 취소가 아니다.
    'auth/cancelled-popup-request',
    'auth/network-request-failed',
    'auth/internal-error',
  ])('%s는 취소가 아니다', (code) => {
    expect(isFirebaseProviderCancellation(sdkError(code))).toBe(false);
  });

  it('code가 없는 오류는 취소가 아니다', () => {
    expect(isFirebaseProviderCancellation(new Error('closed'))).toBe(false);
  });
});

describe('Firebase 오류 분류', () => {
  it('모르는 코드는 재시도로 추정하지 않고 문의로 보낸다', () => {
    expect(classifyFirebaseAuthFailure(sdkError('auth/internal-error'))).toEqual({
      kind: 'failed',
      reason: 'unexpected',
      nextAction: 'get-help',
    });
  });
});
