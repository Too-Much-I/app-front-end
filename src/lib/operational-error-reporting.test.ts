import { previewOperationalError } from '@/lib/operational-error-reporting';

describe('이슈 묶음(fingerprint)', () => {
  it('로그인 실패는 단계와 사유가 다르면 다른 이슈가 된다', () => {
    const cancelledAsUnexpected = previewOperationalError({
      code: 'AUTH_SIGN_IN_FAILED',
      provider: 'kakao',
      stage: 'firebase',
      step: 'provider-sign-in',
      reason: 'unexpected',
      firebaseCode: 'auth/internal-error',
    });
    const serverConnection = previewOperationalError({
      code: 'AUTH_SIGN_IN_FAILED',
      provider: 'kakao',
      stage: 'identity',
      reason: 'connection',
    });

    expect(cancelledAsUnexpected.fingerprint).toEqual([
      'operational-error',
      'AUTH_SIGN_IN_FAILED',
      'firebase',
      'unexpected',
    ]);
    expect(serverConnection.fingerprint).toEqual([
      'operational-error',
      'AUTH_SIGN_IN_FAILED',
      'identity',
      'connection',
    ]);
  });

  it('로그인 수단과 Firebase 코드는 이슈를 나누지 않고 태그로만 남는다', () => {
    const kakao = previewOperationalError({
      code: 'AUTH_SIGN_IN_FAILED',
      provider: 'kakao',
      stage: 'firebase',
      step: 'provider-sign-in',
      reason: 'unexpected',
      firebaseCode: 'auth/internal-error',
    });
    const apple = previewOperationalError({
      code: 'AUTH_SIGN_IN_FAILED',
      provider: 'apple',
      stage: 'firebase',
      step: 'get-id-token',
      reason: 'unexpected',
      firebaseCode: 'auth/invalid-credential',
    });

    expect(apple.fingerprint).toEqual(kakao.fingerprint);
    expect(apple.tags).toMatchObject({
      provider: 'apple',
      firebaseCode: 'auth/invalid-credential',
    });
  });

  it('원인 축을 정하지 않은 오류는 오류 이름 하나로 묶인다', () => {
    const preview = previewOperationalError({
      code: 'EXAM_GRADING_FAILED',
      stage: 'polling',
      reason: 'timeout',
      attempt: 'retry',
    });

    expect(preview.fingerprint).toEqual(['operational-error', 'EXAM_GRADING_FAILED']);
  });
});
