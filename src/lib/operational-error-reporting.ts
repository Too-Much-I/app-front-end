import {
  captureOperationalEvent,
  type OperationalCaptureResult,
  type OperationalEventPayload,
} from '@/lib/sentry';
import { ApiError } from '@/lib/api/transport';
import type { OperationalErrorCode } from '@/lib/operational-error-codes';
import type { AudioPlaybackErrorKind, AudioPlaybackFailureOrigin } from '@/types/audio';
import type { ExamPartPreludeInvalidReason } from '@/types/exam';

export type { OperationalErrorCode } from '@/lib/operational-error-codes';

type ReportAttempt = 'initial' | 'retry';
type LoginProvider = 'google' | 'apple' | 'kakao';
type SafeCause = { cause?: unknown };
type RecordingStartOperation =
  | 'playback-pause'
  | 'permission-check'
  | 'permission-request'
  | 'audio-mode'
  | 'recorder-prepare'
  | 'record-start';

/**
 * 필수 음성이 실패한 사유와, 그 사유에서만 뜻이 있는 자료.
 *
 * `playback`은 "플레이어가 에러를 뱉었다"는 말일 뿐이라 그 자체로는 조사할 방향이
 * 없다. 어디서 감지했는지(`origin`)와 무엇이었는지(`errorKind`)를 사유에 묶어 두어,
 * 다른 사유에는 붙지 않고 `playback`에는 반드시 붙게 한다.
 */
export type ExamAudioFailureDetail =
  /**
   * `load-timeout`은 음원을 받아 오지 못한 것이고 `timeout`은 받아 놓고 소리가 나지
   * 않은 것이다. 대응이 서로 달라 한 값으로 묶지 않는다.
   */
  | { reason: 'missing' | 'unsupported' | 'load-timeout' | 'timeout' | 'media-reset' }
  | {
      reason: 'playback';
      origin: AudioPlaybackFailureOrigin;
      errorKind: AudioPlaybackErrorKind;
    };

export type OperationalErrorInput =
  | ({
      code: 'AUTH_BOOTSTRAP_FAILED';
      source: 'startup' | 'consent-submit';
      operation:
        | 'read-local'
        | 'persist-consent'
        | 'persist-installation'
        | 'reissue'
        | 'guest'
        | 'persist-session'
        | 'check-consent'
        | 'update-consent';
      attempt: ReportAttempt;
    } & SafeCause)
  | ({
      code: 'EXAM_SESSION_CREATE_FAILED';
      stage: 'session-create';
      attempt: ReportAttempt;
    } & SafeCause)
  | ({
      code: 'EXAM_REQUIRED_AUDIO_FAILED';
      cueKind: 'sound-test' | 'part-directions' | 'part-intro' | 'phase' | 'question';
      partNumber?: number;
      questionNumber?: number;
      issueCount?: number;
    } & ExamAudioFailureDetail)
  | {
      code: 'EXAM_PRELUDE_FAILED';
      partNumber: 3 | 4;
      reason: ExamPartPreludeInvalidReason | 'missing-prelude';
    }
  | ({
      code: 'ANSWER_RECORDING_FAILED';
      surface: 'microphone-test';
      stage: 'prepare';
      operation: RecordingStartOperation;
      permissionGranted: boolean;
      attempt: number;
    } & SafeCause)
  | ({
      code: 'ANSWER_RECORDING_FAILED';
      surface: 'live' | 'reanswer';
      stage: 'prepare' | 'stop' | 'file-validation';
      operation?: Exclude<RecordingStartOperation, 'playback-pause'>;
      permissionGranted?: boolean;
      questionNumber: number;
      retryCount: number;
      attempt: number;
    } & SafeCause)
  | ({
      code: 'ANSWER_SUBMISSION_FAILED';
      stage: 'upload' | 'notify';
      reason: 'request' | 'server-processing';
      retryable: boolean;
      questionNumber: number;
      retryCount: number;
      attempt: number;
    } & SafeCause)
  | ({
      code: 'EXAM_GRADING_FAILED';
      stage: 'polling' | 'retry-request';
      reason: 'server-failed' | 'timeout' | 'request-failed';
      attempt: 'retry';
    } & SafeCause)
  | {
      code: 'FEEDBACK_PAGE_LOAD_FAILED';
      reason: 'network' | 'http' | 'render';
      attempt: number;
    }
  | ({
      code: 'FEEDBACK_DATA_LOAD_FAILED';
      resource: 'EXAM_SUMMARY' | 'QUESTION_FEEDBACK';
    } & SafeCause)
  | ({
      code: 'FEEDBACK_HISTORY_LOAD_FAILED';
      surface: 'home' | 'exam-history' | 'reanswer-history';
      attempt: number;
    } & SafeCause)
  | {
      code: 'SUMMARY_FEEDBACK_RETRY_FAILED';
      stage: 'retry-request' | 'retry-polling';
      reason: 'request-failed' | 'poll-failed' | 'poll-timeout';
    }
  | ({
      code: 'REANSWER_QUESTION_LOAD_FAILED';
      questionNumber: number;
    } & SafeCause)
  | ({
      code: 'REANSWER_SUBMISSION_FAILED';
      reason: 'request-failed' | 'server-processing';
      questionNumber: number;
      retryCount: number;
    } & SafeCause)
  | {
      code: 'REANSWER_GRADING_FAILED';
      reason: 'server-failed' | 'timeout';
      questionNumber: number;
      retryCount: number;
    }
  | ({
      code: 'LEARNING_RECORD_DELETE_FAILED';
      operation: 'delete-learning-records';
    } & SafeCause)
  | ({
      code: 'QUALITY_REVIEW_CONSENT_UPDATE_FAILED';
      operation: 'set-quality-review-consent';
    } & SafeCause)
  | {
      code: 'API_RESPONSE_VALIDATION_FAILED';
      resource: ApiResponseResource;
      /**
       * `enforced`는 요청을 실패시켰고, `observed`는 기록만 하고 화면은 그대로 뒀다.
       * 관찰 단계의 스키마는 아직 실제 트래픽과 맞지 않을 수 있어 대응이 다르다.
       */
      mode: 'enforced' | 'observed';
      /** 우리 스키마 기준의 필드 경로. 서버가 보낸 값은 담지 않는다. */
      issuePath: string;
      issueCode: string;
    }
  | PostLoginErrorInput;

/**
 * 로그인 이후 기능의 포기 지점(2026-10-11 결정). 사유는 각 흐름이 이미 쓰는 닫힌 이름이고,
 * 서버 원인은 `cause`에서 status·서버 code만 꺼낸다. `firebaseCode`는 `auth/...` 모양만 받는다.
 */
type PostLoginErrorInput =
  | ({
      code: 'AUTH_SIGN_IN_FAILED';
      provider: LoginProvider;
      stage: 'firebase';
      step: 'provider-sign-in' | 'get-id-token';
      reason: string;
      firebaseCode?: string;
    } & SafeCause)
  | ({
      code: 'AUTH_SIGN_IN_FAILED';
      provider: LoginProvider;
      stage: 'identity' | 'session-activate';
      reason: string;
    } & SafeCause)
  | ({
      code: 'AUTH_PHONE_VERIFICATION_FAILED';
      flow: 'signup' | 'account-recovery';
      step: 'send-code' | 'confirm-code';
      reason: string;
      firebaseCode?: string;
    } & SafeCause)
  | ({
      code: 'AUTH_SIGNUP_FAILED';
      flow: 'signup' | 'guest-upgrade';
      step: 'nickname' | 'consents' | 'phone';
      reason: string;
      nextAction: string;
    } & SafeCause)
  | ({
      code: 'GUEST_MERGE_FAILED';
      work: 'merge' | 'continue-signup';
      reason: string;
      nextAction: string;
    } & SafeCause)
  | ({
      code: 'ACCOUNT_RECOVERY_FAILED';
      step: string;
      reason: string;
    } & SafeCause)
  | ({
      code: 'ACCOUNT_WITHDRAWAL_FAILED';
      stage: string;
      reason: 'connection' | 'failed';
    } & SafeCause)
  | ({
      code: 'CHALLENGE_LOAD_FAILED';
      resource: 'today' | 'question' | 'attempt' | 'result';
    } & SafeCause)
  | ({
      code: 'CHALLENGE_SUBMISSION_FAILED';
      stage: string;
    } & SafeCause)
  | ({
      code: 'SUPPORT_INQUIRY_SUBMIT_FAILED';
      category: 'AUTH' | 'GENERAL';
    } & SafeCause)
  | ({
      code: 'MYPAGE_LOAD_FAILED';
      resource: 'profile' | 'calendar';
    } & SafeCause)
  | ({
      code: 'LEARNING_LOAD_FAILED';
      /** `media`는 서버 음성(주소 재발급·모범 음성), `recording`은 기기 안 내 녹음 재생이다. */
      resource: 'units' | 'detail' | 'resume' | 'media' | 'recording';
    } & SafeCause)
  | ({
      code: 'LEARNING_COMPLETION_FAILED';
    } & SafeCause)
  | ({
      code: 'LEARNING_GRADING_FAILED';
      /**
       * 어디서 멈췄는지. `capabilities`는 준비 조회 요청 자체의 실패이고, 서버가 준비 안 됨이라고 답한 것은
       * 보고하지 않는다. `job`은 서버가 채점을 `failed`로 끝낸 것이라 HTTP 오류가 없고, 서버 오류 코드는
       * `jobErrorCode`에 싣는다.
       */
      stage:
        | 'capabilities'
        | 'create'
        | 'upload-url'
        | 'upload'
        | 'submit'
        | 'polling'
        | 'retry'
        | 'job';
      jobErrorCode?: string;
    } & SafeCause)
  /**
   * Part 2~5 세트에 퍼즐 조각(`chunks`)이 없는 문장이 있다. 운영에서는 모두 있어야 한다(2026-10-26 결정).
   * 앱은 세 단어로 잘라 계속 쓰므로 흐름을 막지 않아 warning으로 보내고(`LEVEL_BY_CODE`), cause가 없다.
   * `unitId`는 서버가 고칠 세트를 찾게 싣는다 — 사용자와 무관한 콘텐츠 ID라 식별자 제외 원칙의 예외다.
   */
  | {
      code: 'LEARNING_CHUNKS_MISSING';
      part: number;
      unitId: string;
      missingSentences: number;
    }
  | ({
      code: 'PUSH_REGISTRATION_FAILED';
      operation: string;
    } & SafeCause)
  | ({
      code: 'APP_VERSION_CHECK_FAILED';
    } & SafeCause)
  | ({
      code: 'PASS_PURCHASE_FAILED';
      stage: 'purchase-account' | 'store-purchase';
      /** RevenueCat이 붙인 오류 이름(`STORE_PROBLEM` 같은 닫힌 식별자). */
      storeErrorCode?: string;
    } & SafeCause)
  | {
      code: 'PASS_PURCHASE_FAILED';
      stage: 'sync';
      /** 결제는 됐는데 반영을 확인하지 못했다. 이 사용자는 문의하거나 웹훅을 기다린다. */
      outcome: 'pending' | 'contact-support';
    }
  /**
   * 앱이 따로 다루지 않는 401로 세션을 지웠다. 서버에 앱이 모르는 401 코드가 생겼다는 뜻이다.
   * `serverCode`는 cause에서 나온다.
   */
  | ({
      code: 'AUTH_SESSION_REJECTED';
      stage: 'reissue' | 'account-check';
    } & SafeCause);

/**
 * 쿼리 캐시가 대신 보고하는 조회 실패. 쿼리 옵션의 `meta.failureReport`에 싣는다(`query-client.ts`).
 * 같은 조회를 여러 화면이 함께 써도 실패한 요청마다 한 번만 보고하려고 화면이 아니라 캐시가 보낸다.
 */
export type QueryFailureReport =
  | { code: 'CHALLENGE_LOAD_FAILED'; resource: 'today' }
  | { code: 'MYPAGE_LOAD_FAILED'; resource: 'profile' | 'calendar' }
  | { code: 'LEARNING_LOAD_FAILED'; resource: 'units' | 'detail' | 'resume' };

/**
 * 스키마 검증을 붙인 엔드포인트. 옮겨올 때마다 여기에 하나씩 추가한다.
 *
 * feature 태그는 code 단위로만 붙어서(`FEATURE_BY_CODE`) 어느 응답이 어긋났는지는
 * 이 값으로 구분한다. `FEEDBACK_DATA_LOAD_FAILED`의 `resource`와 같은 방식이다.
 */
export type ApiResponseResource =
  | 'CHALLENGE_TODAY'
  | 'EXAM_HISTORY'
  | 'CHALLENGE_QUESTION'
  | 'CHALLENGE_ATTEMPT'
  | 'CHALLENGE_UPLOAD_URL'
  | 'CHALLENGE_ANSWER'
  | 'CHALLENGE_HISTORY'
  | 'MY_PROFILE'
  | 'PURCHASE_ACCOUNT'
  | 'PAYMENT_PRODUCTS'
  | 'PAYMENT_SYNC'
  | 'ENTITLEMENTS'
  | 'LEARNING_UNITS'
  | 'LEARNING_UNIT_DETAIL'
  | 'LEARNING_RESUME'
  | 'LEARNING_MEDIA_URL'
  | 'LEARNING_COMPLETION'
  | 'LEARNING_CAPABILITIES'
  | 'LEARNING_UPLOAD_URL'
  | 'LEARNING_SUBMISSION';

type SafeValue = string | number | boolean;

const FEATURE_BY_CODE: Record<OperationalErrorCode, string> = {
  AUTH_BOOTSTRAP_FAILED: 'auth',
  EXAM_SESSION_CREATE_FAILED: 'mock-exam',
  EXAM_REQUIRED_AUDIO_FAILED: 'mock-exam',
  EXAM_PRELUDE_FAILED: 'mock-exam',
  ANSWER_RECORDING_FAILED: 'exam-answer',
  ANSWER_SUBMISSION_FAILED: 'exam-answer',
  EXAM_GRADING_FAILED: 'grading',
  FEEDBACK_PAGE_LOAD_FAILED: 'feedback',
  FEEDBACK_DATA_LOAD_FAILED: 'feedback',
  FEEDBACK_HISTORY_LOAD_FAILED: 'feedback',
  SUMMARY_FEEDBACK_RETRY_FAILED: 'feedback',
  REANSWER_QUESTION_LOAD_FAILED: 'reanswer',
  REANSWER_SUBMISSION_FAILED: 'reanswer',
  REANSWER_GRADING_FAILED: 'reanswer',
  LEARNING_RECORD_DELETE_FAILED: 'settings',
  QUALITY_REVIEW_CONSENT_UPDATE_FAILED: 'settings',
  API_RESPONSE_VALIDATION_FAILED: 'api',
  AUTH_SIGN_IN_FAILED: 'auth',
  AUTH_PHONE_VERIFICATION_FAILED: 'auth',
  AUTH_SIGNUP_FAILED: 'auth',
  GUEST_MERGE_FAILED: 'auth',
  ACCOUNT_RECOVERY_FAILED: 'auth',
  ACCOUNT_WITHDRAWAL_FAILED: 'auth',
  CHALLENGE_LOAD_FAILED: 'challenge',
  CHALLENGE_SUBMISSION_FAILED: 'challenge',
  SUPPORT_INQUIRY_SUBMIT_FAILED: 'support',
  MYPAGE_LOAD_FAILED: 'mypage',
  LEARNING_LOAD_FAILED: 'learning',
  LEARNING_COMPLETION_FAILED: 'learning',
  LEARNING_GRADING_FAILED: 'learning',
  LEARNING_CHUNKS_MISSING: 'learning',
  PUSH_REGISTRATION_FAILED: 'push',
  APP_VERSION_CHECK_FAILED: 'app-version',
  PASS_PURCHASE_FAILED: 'pass',
  AUTH_SESSION_REJECTED: 'auth',
};

/** 오류 이름의 모든 입력이 공통으로 가진 필드. 원인 축은 여기서만 고를 수 있다. */
type InputFieldOf<C extends OperationalErrorCode> = Exclude<
  keyof Extract<OperationalErrorInput, { code: C }>,
  'code' | 'cause'
> &
  string;

/**
 * 오류 이름 하나에 대응이 다른 원인이 섞이는 코드만 원인 축을 이슈 묶음(fingerprint)에 더한다.
 * 나머지는 오류 이름 하나로 묶고 원인은 태그 분포로 본다. 축은 닫힌 값만 넣는다
 * (`firebaseCode`처럼 외부가 정하는 열린 값은 이슈를 끝없이 쪼갠다).
 * 근거: docs/decisions/2026-10-24-로그인-실패-이슈-원인별-분리.md
 */
const FINGERPRINT_FIELDS_BY_CODE: { [C in OperationalErrorCode]?: readonly InputFieldOf<C>[] } = {
  AUTH_SIGN_IN_FAILED: ['stage', 'reason'],
};

/**
 * 흐름을 막지 않는 서버 계약 위반만 warning으로 낮춘다. 나머지는 사용자 흐름을 막은 실패라 error다.
 * 근거: 관례 42(docs/architecture/02-conventions.md), 2026-10-26 결정.
 */
const WARNING_CODES: ReadonlySet<OperationalErrorCode> = new Set(['LEARNING_CHUNKS_MISSING']);

const SAFE_SERVER_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
/** expo가 예외 클래스 이름에서 만들어 내는 코드. 자유 텍스트가 아니라 닫힌 식별자다. */
const EXPO_ERROR_CODE_PATTERN = /^ERR_[A-Z0-9_]{1,60}$/;
const OS_STATUS_PATTERN = /OSStatus error (-?\d{1,12})/;
const NATIVE_CAUSE_CHAIN_LIMIT = 2;

/**
 * expo-audio의 네이티브 실패를 우리가 정한 이름으로 접는다.
 *
 * `code`만으로는 갈리지 않는다 — `AudioRecordingException` 하나가 세션 설정 실패,
 * 리코더 생성 실패, 준비 거부를 모두 덮어 전부 `ERR_AUDIO_RECORDING`으로 온다. 구분은
 * 메시지에만 있는데 원문은 경로·URL이 섞일 수 있는 자유 텍스트라 싣지 않는다.
 * 여기 적힌 말머리에 걸린 것만 고정된 이름으로 바꿔 내보낸다.
 * `ApiError`를 status와 code로만 접어 보내는 것과 같은 기준이다.
 */
const NATIVE_AUDIO_FAILURE_REASONS: readonly (readonly [string, string])[] = [
  ['Failed to configure audio session', 'session-configure'],
  ['Failed to create recorder', 'recorder-create'],
  ['Failed to prepare recorder', 'prepare-rejected'],
  ['Failed to change audio state', 'session-state'],
  ['shared object that was already released', 'shared-object-released'],
];

function classifyApiError(cause: ApiError): Record<string, SafeValue> {
  return {
    ...(Number.isInteger(cause.status) && cause.status >= 100 && cause.status <= 599
      ? { httpStatus: cause.status }
      : {}),
    ...(cause.code && SAFE_SERVER_CODE_PATTERN.test(cause.code) ? { serverCode: cause.code } : {}),
  };
}

function classifyNativeError(cause: Error): Record<string, SafeValue> {
  const code: unknown = (cause as { code?: unknown }).code;
  const message = typeof cause.message === 'string' ? cause.message : '';
  const reason = NATIVE_AUDIO_FAILURE_REASONS.find(([marker]) => message.includes(marker))?.[1];
  // AVAudioSession이 붙여 주는 숫자 상태. 어떤 거절인지는 이 값으로만 갈린다.
  const osStatus = Number(OS_STATUS_PATTERN.exec(message)?.[1]);

  return {
    ...(typeof code === 'string' && EXPO_ERROR_CODE_PATTERN.test(code) ? { nativeCode: code } : {}),
    ...(reason ? { nativeReason: reason } : {}),
    ...(Number.isSafeInteger(osStatus) ? { nativeStatus: osStatus } : {}),
  };
}

/**
 * `AudioRecordingError`처럼 네이티브 오류를 한 겹 감싸 던지는 자리가 있어 사슬을 따라간다.
 * 감싼 쪽에는 우리가 쓴 한국어 문구만 있고 원인은 안쪽에 있다.
 */
function classifyCause(cause: unknown, depth = 0): Record<string, SafeValue> {
  if (cause instanceof ApiError) return classifyApiError(cause);
  if (!(cause instanceof Error)) return {};

  const classified = classifyNativeError(cause);
  if (Object.keys(classified).length > 0 || depth >= NATIVE_CAUSE_CHAIN_LIMIT) {
    return classified;
  }

  return classifyCause((cause as { cause?: unknown }).cause, depth + 1);
}

function toSafeContext(input: OperationalErrorInput): Record<string, SafeValue> {
  const { code: _code, cause, ...context } = input as OperationalErrorInput & SafeCause;
  const safeContext: Record<string, SafeValue> = {};

  for (const [key, value] of Object.entries(context)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      safeContext[key] = value;
    }
  }

  return { ...safeContext, ...classifyCause(cause) };
}

/**
 * 사용자 흐름을 실제로 막은 handled failure만 안정된 code와 허용 목록 metadata로 보고한다. 흐름은 계속되는
 * 서버 계약 위반은 예외로 warning 수준으로 보낸다(`WARNING_CODES`).
 * raw Error는 API status/code 분류 뒤 버리며 message, stack, URL과 response는 보내지 않는다.
 */
export function previewOperationalError(input: OperationalErrorInput): OperationalEventPayload {
  const context = toSafeContext(input);
  const tags = Object.fromEntries(
    Object.entries(context)
      // 숫자도 태그로 올린다. context에만 있으면 이벤트 하나를 열어봐야 보이고 집계가
      // 되지 않아, "몇 번 문항에서 몰리는가" 같은 질문에 답할 수 없다. 여기 오는 숫자는
      // partNumber·questionNumber·httpStatus처럼 값 범위가 좁은 분류값뿐이며,
      // 사용자·시험 식별자는 toSafeContext 이전 단계에서 이미 걸러진다. 예외는 사용자와 무관한
      // 콘텐츠 ID(`LEARNING_CHUNKS_MISSING`의 unitId)뿐이다.
      .filter(([, value]) => typeof value !== 'number' || Number.isFinite(value))
      .map(([key, value]) => [key, String(value)]),
  );

  const fingerprintFields: readonly string[] = FINGERPRINT_FIELDS_BY_CODE[input.code] ?? [];

  return {
    code: input.code,
    feature: FEATURE_BY_CODE[input.code],
    level: WARNING_CODES.has(input.code) ? 'warning' : 'error',
    fingerprint: [
      'operational-error',
      input.code,
      ...fingerprintFields.map((field) => String(context[field] ?? 'none')),
    ],
    tags,
    context,
  };
}

export interface OperationalReportReceipt extends OperationalCaptureResult {
  preview: OperationalEventPayload;
}

export function reportOperationalError(input: OperationalErrorInput): OperationalReportReceipt {
  const preview = previewOperationalError(input);
  return { preview, ...captureOperationalEvent(preview) };
}
