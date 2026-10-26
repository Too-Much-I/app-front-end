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

describe('보고 수준(level)', () => {
  it('흐름을 막은 실패는 error다', () => {
    expect(previewOperationalError({ code: 'LEARNING_COMPLETION_FAILED' }).level).toBe('error');
  });

  it('흐름은 계속되는 chunks 누락은 warning이고 콘텐츠 unitId가 태그로 남는다', () => {
    const payload = previewOperationalError({
      code: 'LEARNING_CHUNKS_MISSING',
      part: 3,
      unitId: 'unit:p3_set_001',
      missingSentences: 2,
    });

    expect(payload.level).toBe('warning');
    expect(payload.tags).toMatchObject({
      part: '3',
      unitId: 'unit:p3_set_001',
      missingSentences: '2',
    });
  });
});
