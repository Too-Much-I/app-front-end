import {
  autoRetryDelayMs,
  classifyExamCreationFailure,
  examCreationFailureHandling,
  MAX_AUTO_RETRIES,
} from '@/features/exam/exam-creation-failure';
import { ApiError, TransportConnectionError } from '@/lib/api/transport';

function apiError(status: number, code?: string, retryAfterSeconds?: number): ApiError {
  return new ApiError(status, 'test', code, undefined, retryAfterSeconds);
}

describe('시험 생성 실패 분류', () => {
  it.each([
    [402, 'ENTITLEMENT_INSUFFICIENT', 'pass-required'],
    [409, 'EXAM_CREATION_PROCESSING', 'processing'],
    [403, 'ENTITLEMENT_REVOKED', 'revoked'],
    [409, 'EXAM_TRANSITION_CONFLICT', 'transition-conflict'],
    [409, 'LEARNING_RECORD_DELETION_IN_PROGRESS', 'deletion-in-progress'],
    [503, 'BILLING_TEMPORARILY_UNAVAILABLE', 'unavailable'],
    [400, 'IDEMPOTENCY_KEY_INVALID', 'key-rejected'],
    [409, 'IDEMPOTENCY_KEY_CONFLICT', 'key-rejected'],
  ])('%i %s는 %s다', (status, code, kind) => {
    expect(classifyExamCreationFailure(apiError(status, code)).kind).toBe(kind);
  });

  it('코드 없는 402도 응시권 없음이다', () => {
    expect(classifyExamCreationFailure(apiError(402))).toEqual({ kind: 'pass-required' });
  });

  it('429는 코드와 상관없이 Retry-After를 들고 rate-limited다', () => {
    expect(classifyExamCreationFailure(apiError(429, undefined, 3))).toEqual({
      kind: 'rate-limited',
      retryAfterSeconds: 3,
    });
    expect(classifyExamCreationFailure(apiError(503, 'BILLING_RATE_LIMITED'))).toEqual({
      kind: 'rate-limited',
      retryAfterSeconds: null,
    });
  });

  it('모르는 코드와 연결 실패는 unknown이고 키를 유지한다', () => {
    const unknownCode = classifyExamCreationFailure(apiError(409, 'SOMETHING_NEW'));
    const connection = classifyExamCreationFailure(new TransportConnectionError());

    expect(unknownCode).toEqual({ kind: 'unknown' });
    expect(connection).toEqual({ kind: 'unknown' });
    // 서버가 이미 만들었을 수 있으므로 새 키로 다시 보내면 시험이 두 번 생길 수 있다.
    expect(examCreationFailureHandling(connection).keepsKey).toBe(true);
  });

  it('응시권이 없으면 키를 버리고 진입 확인을 다시 불러온다', () => {
    const handling = examCreationFailureHandling({ kind: 'pass-required' });
    expect(handling.keepsKey).toBe(false);
    expect(handling.refreshesAdmission).toBe(true);
  });
});

describe('시험 생성 자동 재시도 대기 시간', () => {
  it('서버가 만드는 중이면 2초 뒤 다시 보낸다', () => {
    expect(autoRetryDelayMs({ kind: 'processing' }, 0)).toBe(2000);
  });

  it('Retry-After가 10초 이하면 그만큼 기다리고, 넘거나 없으면 다시 보내지 않는다', () => {
    expect(autoRetryDelayMs({ kind: 'rate-limited', retryAfterSeconds: 10 }, 0)).toBe(10_000);
    expect(autoRetryDelayMs({ kind: 'rate-limited', retryAfterSeconds: 11 }, 0)).toBeNull();
    expect(autoRetryDelayMs({ kind: 'rate-limited', retryAfterSeconds: null }, 0)).toBeNull();
  });

  it('최대 횟수에 닿으면 어떤 실패도 다시 보내지 않는다', () => {
    expect(autoRetryDelayMs({ kind: 'processing' }, MAX_AUTO_RETRIES - 1)).toBe(2000);
    expect(autoRetryDelayMs({ kind: 'processing' }, MAX_AUTO_RETRIES)).toBeNull();
  });

  it.each(['pass-required', 'unknown', 'key-rejected'] as const)(
    '%s는 자동으로 다시 보내지 않는다',
    (kind) => {
      expect(autoRetryDelayMs({ kind }, 0)).toBeNull();
    },
  );
});
