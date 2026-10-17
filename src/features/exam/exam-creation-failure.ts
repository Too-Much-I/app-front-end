import { ApiError } from '@/lib/api/transport';

/**
 * 시험 생성(`POST /exams`) 거절을 앱이 다루는 단위로 나눈다(서버 답 2026-10-17, 결정 2026-10-17).
 *
 * - `pass-required`(402): 응시권이 없다. 팝업으로 결제가 필요하다는 것을 알리고 이용권 화면으로 보낸다.
 * - `processing`(409 EXAM_CREATION_PROCESSING): 서버가 아직 만드는 중. 같은 키로 자동 재시도.
 * - `rate-limited`(429): Retry-After가 짧으면 기다렸다 같은 키로 자동 재시도.
 * - `key-rejected`(400 IDEMPOTENCY_KEY_INVALID·409 IDEMPOTENCY_KEY_CONFLICT): 앱 버그다. 새 키로 자동
 *   우회하지 않는다(명세).
 * - `unknown`: 네트워크 끊김·그 밖의 오류. 서버가 만들었을 수 있으니 키를 유지한다.
 */
export type ExamCreationFailure =
  | { kind: 'pass-required' }
  | { kind: 'processing' }
  | { kind: 'rate-limited'; retryAfterSeconds: number | null }
  | { kind: 'revoked' }
  | { kind: 'transition-conflict' }
  | { kind: 'deletion-in-progress' }
  | { kind: 'unavailable' }
  | { kind: 'key-rejected' }
  | { kind: 'unknown' };

export type ExamCreationFailureKind = ExamCreationFailure['kind'];

// 서버가 모르는 코드를 보낼 수 있어 부분 표다. 없으면 아래에서 상태 코드로 나눈다.
const FAILURE_BY_CODE: Partial<Record<string, ExamCreationFailure>> = {
  ENTITLEMENT_INSUFFICIENT: { kind: 'pass-required' },
  EXAM_CREATION_PROCESSING: { kind: 'processing' },
  ENTITLEMENT_REVOKED: { kind: 'revoked' },
  EXAM_TRANSITION_CONFLICT: { kind: 'transition-conflict' },
  LEARNING_RECORD_DELETION_IN_PROGRESS: { kind: 'deletion-in-progress' },
  BILLING_TEMPORARILY_UNAVAILABLE: { kind: 'unavailable' },
  IDEMPOTENCY_KEY_INVALID: { kind: 'key-rejected' },
  IDEMPOTENCY_KEY_CONFLICT: { kind: 'key-rejected' },
};

export function classifyExamCreationFailure(error: unknown): ExamCreationFailure {
  if (!(error instanceof ApiError)) return { kind: 'unknown' };
  if (error.code === 'BILLING_RATE_LIMITED' || error.status === 429)
    return { kind: 'rate-limited', retryAfterSeconds: error.retryAfterSeconds ?? null };
  const byCode = error.code ? FAILURE_BY_CODE[error.code] : undefined;
  if (byCode) return byCode;
  // 코드 없이 오는 402도 응시권 없음으로 본다.
  if (error.status === 402) return { kind: 'pass-required' };
  return { kind: 'unknown' };
}

/** 한 번 누를 때 자동으로 다시 보내는 최대 횟수. 넘으면 사용자에게 알린다. */
export const MAX_AUTO_RETRIES = 5;
const PROCESSING_RETRY_DELAY_MS = 2000;
/** Retry-After가 이보다 길면 "시작 중"에 붙잡아 두지 않고 알린다. */
const MAX_RATE_LIMIT_WAIT_SECONDS = 10;

/** 자동으로 다시 보낼 때까지 기다릴 시간. 다시 보내지 않으면 null. `retriesSoFar`는 이번 누름의 자동 재시도 수. */
export function autoRetryDelayMs(
  failure: ExamCreationFailure,
  retriesSoFar: number,
): number | null {
  if (retriesSoFar >= MAX_AUTO_RETRIES) return null;
  switch (failure.kind) {
    case 'processing':
      return PROCESSING_RETRY_DELAY_MS;
    case 'rate-limited':
      return failure.retryAfterSeconds !== null &&
        failure.retryAfterSeconds <= MAX_RATE_LIMIT_WAIT_SECONDS
        ? failure.retryAfterSeconds * 1000
        : null;
    default:
      return null;
  }
}

interface FailureHandling {
  /** 결론이 나지 않았다 — 다음 시도도 같은 키로 보낸다. */
  keepsKey: boolean;
  /** 이용권 상태가 바뀌었을 수 있어 진입 확인을 다시 불러온다. */
  refreshesAdmission: boolean;
  /** 사용자 상황이 아니라 앱·서버 문제라 Sentry로 보고한다. */
  reports: boolean;
  /** 시작 버튼 위에 보여 줄 문구. `pass-required`는 팝업이 대신한다. */
  message: string;
}

const RETRY_LATER = '잠시 후 다시 시도해 주세요.';
const LOAD_FAILED = '시험 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.';

const HANDLING_BY_KIND = {
  'pass-required': {
    keepsKey: false,
    refreshesAdmission: true,
    reports: false,
    message: '응시권이 없어요.',
  },
  processing: {
    keepsKey: true,
    refreshesAdmission: false,
    reports: true,
    message: '시험을 준비하는 데 시간이 걸리고 있어요. 잠시 후 다시 시도해 주세요.',
  },
  'rate-limited': {
    keepsKey: true,
    refreshesAdmission: false,
    reports: true,
    message: RETRY_LATER,
  },
  revoked: {
    keepsKey: false,
    refreshesAdmission: true,
    reports: false,
    message: '이용권이 취소되어 시험을 시작할 수 없어요.',
  },
  'transition-conflict': {
    keepsKey: false,
    refreshesAdmission: true,
    reports: true,
    message: '시험 상태가 바뀌었어요. 다시 시도해 주세요.',
  },
  'deletion-in-progress': {
    keepsKey: false,
    refreshesAdmission: false,
    reports: false,
    message: '학습 기록을 삭제하는 중이라 지금은 시작할 수 없어요.',
  },
  unavailable: { keepsKey: true, refreshesAdmission: false, reports: true, message: RETRY_LATER },
  'key-rejected': {
    keepsKey: true,
    refreshesAdmission: false,
    reports: true,
    message: LOAD_FAILED,
  },
  unknown: { keepsKey: true, refreshesAdmission: false, reports: true, message: LOAD_FAILED },
} satisfies Record<ExamCreationFailureKind, FailureHandling>;

export function examCreationFailureHandling(failure: ExamCreationFailure): FailureHandling {
  return HANDLING_BY_KIND[failure.kind];
}
