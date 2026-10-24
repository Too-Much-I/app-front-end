import { ApiError } from '@/lib/api/transport';
import {
  previewOperationalError,
  reportOperationalError,
  type OperationalErrorCode,
  type OperationalErrorInput,
  type OperationalReportReceipt,
} from '@/lib/operational-error-reporting';
import {
  flushOperationalEvents,
  type OperationalEventPayload,
  type OperationalFlushResult,
} from '@/lib/sentry';

type InputForCode<Code extends OperationalErrorCode> = Extract<
  OperationalErrorInput,
  { code: Code }
>;

type ValidationDefinitions = {
  [Code in OperationalErrorCode]: {
    title: string;
    input: InputForCode<Code>;
  };
};

const SYNTHETIC_API_CAUSE = new ApiError(
  503,
  'Synthetic validation cause must not be transmitted',
  'SYNTHETIC_VALIDATION',
);

/**
 * expo-audio가 iOS에서 던지는 형태를 흉내 낸 원인. 메시지 원문은 전송되지 않아야 하고
 * `nativeCode`·`nativeReason`·`nativeStatus`만 남아야 한다. 경로를 일부러 섞어 두었다.
 */
const SYNTHETIC_NATIVE_AUDIO_CAUSE = Object.assign(
  new Error(
    'Audio recording error: Failed to configure audio session: file:///var/mobile/Containers/Data/recording-synthetic.m4a (OSStatus error 561017449.)',
  ),
  { code: 'ERR_AUDIO_RECORDING' },
);

const DEFINITIONS = {
  AUTH_BOOTSTRAP_FAILED: {
    title: '인증 초기화 실패',
    input: {
      code: 'AUTH_BOOTSTRAP_FAILED',
      source: 'startup',
      operation: 'read-local',
      attempt: 'initial',
      cause: SYNTHETIC_API_CAUSE,
    },
  },
  EXAM_SESSION_CREATE_FAILED: {
    title: '시험 세션 생성 실패',
    input: {
      code: 'EXAM_SESSION_CREATE_FAILED',
      stage: 'session-create',
      attempt: 'initial',
      cause: SYNTHETIC_API_CAUSE,
    },
  },
  EXAM_REQUIRED_AUDIO_FAILED: {
    title: '필수 음성 실패',
    input: {
      code: 'EXAM_REQUIRED_AUDIO_FAILED',
      cueKind: 'question',
      // playback 변형이 필드를 가장 많이 채운다. partNumber·questionNumber는 숫자가
      // 태그로 올라가는지까지 함께 확인한다.
      reason: 'playback',
      origin: 'player-status',
      errorKind: 'forbidden',
      partNumber: 2,
      questionNumber: 3,
    },
  },
  EXAM_PRELUDE_FAILED: {
    title: '파트 사전 자료 실패',
    input: {
      code: 'EXAM_PRELUDE_FAILED',
      partNumber: 4,
      reason: 'missing-part4-table',
    },
  },
  ANSWER_RECORDING_FAILED: {
    title: '답변 녹음 실패',
    input: {
      code: 'ANSWER_RECORDING_FAILED',
      surface: 'live',
      stage: 'prepare',
      operation: 'recorder-prepare',
      permissionGranted: true,
      questionNumber: 1,
      retryCount: 0,
      attempt: 1,
      cause: SYNTHETIC_NATIVE_AUDIO_CAUSE,
    },
  },
  ANSWER_SUBMISSION_FAILED: {
    title: '답변 제출 실패',
    input: {
      code: 'ANSWER_SUBMISSION_FAILED',
      stage: 'upload',
      reason: 'request',
      retryable: true,
      questionNumber: 1,
      retryCount: 0,
      attempt: 1,
      cause: SYNTHETIC_API_CAUSE,
    },
  },
  EXAM_GRADING_FAILED: {
    title: '시험 채점 실패',
    input: {
      code: 'EXAM_GRADING_FAILED',
      stage: 'polling',
      reason: 'timeout',
      attempt: 'retry',
    },
  },
  FEEDBACK_PAGE_LOAD_FAILED: {
    title: '피드백 페이지 로드 실패',
    input: {
      code: 'FEEDBACK_PAGE_LOAD_FAILED',
      reason: 'http',
      attempt: 1,
    },
  },
  FEEDBACK_DATA_LOAD_FAILED: {
    title: '피드백 데이터 로드 실패',
    input: {
      code: 'FEEDBACK_DATA_LOAD_FAILED',
      resource: 'QUESTION_FEEDBACK',
      cause: SYNTHETIC_API_CAUSE,
    },
  },
  FEEDBACK_HISTORY_LOAD_FAILED: {
    title: '피드백 이력 로드 실패',
    input: {
      code: 'FEEDBACK_HISTORY_LOAD_FAILED',
      surface: 'exam-history',
      attempt: 1,
      cause: SYNTHETIC_API_CAUSE,
    },
  },
  SUMMARY_FEEDBACK_RETRY_FAILED: {
    title: '종합 피드백 재생성 실패',
    input: {
      code: 'SUMMARY_FEEDBACK_RETRY_FAILED',
      stage: 'retry-polling',
      reason: 'poll-timeout',
    },
  },
  REANSWER_QUESTION_LOAD_FAILED: {
    title: '재답변 문제 로드 실패',
    input: {
      code: 'REANSWER_QUESTION_LOAD_FAILED',
      questionNumber: 1,
      cause: SYNTHETIC_API_CAUSE,
    },
  },
  REANSWER_SUBMISSION_FAILED: {
    title: '재답변 제출 실패',
    input: {
      code: 'REANSWER_SUBMISSION_FAILED',
      reason: 'request-failed',
      questionNumber: 1,
      retryCount: 1,
      cause: SYNTHETIC_API_CAUSE,
    },
  },
  REANSWER_GRADING_FAILED: {
    title: '재답변 채점 실패',
    input: {
      code: 'REANSWER_GRADING_FAILED',
      reason: 'timeout',
      questionNumber: 1,
      retryCount: 1,
    },
  },
  LEARNING_RECORD_DELETE_FAILED: {
    title: '학습 기록 삭제 실패',
    input: {
      code: 'LEARNING_RECORD_DELETE_FAILED',
      operation: 'delete-learning-records',
      cause: SYNTHETIC_API_CAUSE,
    },
  },
  QUALITY_REVIEW_CONSENT_UPDATE_FAILED: {
    title: '채점 품질 개선 선택 동의 변경 실패',
    input: {
      code: 'QUALITY_REVIEW_CONSENT_UPDATE_FAILED',
      operation: 'set-quality-review-consent',
      cause: SYNTHETIC_API_CAUSE,
    },
  },
  API_RESPONSE_VALIDATION_FAILED: {
    title: '서버 응답 형식 불일치',
    input: {
      code: 'API_RESPONSE_VALIDATION_FAILED',
      resource: 'CHALLENGE_TODAY',
      mode: 'enforced',
      issuePath: 'questions.0.attemptStatus',
      issueCode: 'invalid_value',
    },
  },
  AUTH_SIGN_IN_FAILED: {
    title: '소셜 로그인 Firebase 단계 실패',
    input: {
      code: 'AUTH_SIGN_IN_FAILED',
      provider: 'google',
      stage: 'firebase',
      step: 'provider-sign-in',
      reason: 'connection',
      firebaseCode: 'auth/network-request-failed',
    },
  },
  AUTH_PHONE_VERIFICATION_FAILED: {
    title: '가입 인증번호 확인 실패',
    input: {
      code: 'AUTH_PHONE_VERIFICATION_FAILED',
      flow: 'signup',
      step: 'confirm-code',
      reason: 'wrong-code',
      firebaseCode: 'auth/invalid-verification-code',
    },
  },
  AUTH_SIGNUP_FAILED: {
    title: '가입 제출 실패',
    input: {
      code: 'AUTH_SIGNUP_FAILED',
      flow: 'signup',
      step: 'consents',
      reason: 'server',
      nextAction: 'retry',
      cause: SYNTHETIC_API_CAUSE,
    },
  },
  GUEST_MERGE_FAILED: {
    title: '게스트 병합 결과 확인 실패',
    input: {
      code: 'GUEST_MERGE_FAILED',
      work: 'merge',
      reason: 'outcomeUnknown',
      nextAction: 'retry',
    },
  },
  ACCOUNT_RECOVERY_FAILED: {
    title: '계정 찾기 조회 실패',
    input: {
      code: 'ACCOUNT_RECOVERY_FAILED',
      step: 'lookup',
      reason: 'server',
      cause: SYNTHETIC_API_CAUSE,
    },
  },
  ACCOUNT_WITHDRAWAL_FAILED: {
    title: '회원 탈퇴 요청 실패',
    input: {
      code: 'ACCOUNT_WITHDRAWAL_FAILED',
      stage: 'server-withdraw',
      reason: 'failed',
      cause: SYNTHETIC_API_CAUSE,
    },
  },
  CHALLENGE_LOAD_FAILED: {
    title: '10초 챌린지 문제 조회 실패',
    input: { code: 'CHALLENGE_LOAD_FAILED', resource: 'question', cause: SYNTHETIC_API_CAUSE },
  },
  CHALLENGE_SUBMISSION_FAILED: {
    title: '10초 챌린지 답변 제출 실패',
    input: { code: 'CHALLENGE_SUBMISSION_FAILED', stage: 'submit', cause: SYNTHETIC_API_CAUSE },
  },
  SUPPORT_INQUIRY_SUBMIT_FAILED: {
    title: '문의 접수 실패',
    input: {
      code: 'SUPPORT_INQUIRY_SUBMIT_FAILED',
      category: 'GENERAL',
      cause: SYNTHETIC_API_CAUSE,
    },
  },
  MYPAGE_LOAD_FAILED: {
    title: '마이페이지 달력 조회 실패',
    input: { code: 'MYPAGE_LOAD_FAILED', resource: 'calendar', cause: SYNTHETIC_API_CAUSE },
  },
  LEARNING_LOAD_FAILED: {
    title: '학습 세트 상세 조회 실패',
    input: { code: 'LEARNING_LOAD_FAILED', resource: 'detail', cause: SYNTHETIC_API_CAUSE },
  },
  LEARNING_COMPLETION_FAILED: {
    title: '학습 문항 완료 저장 실패',
    input: { code: 'LEARNING_COMPLETION_FAILED', cause: SYNTHETIC_API_CAUSE },
  },
  PUSH_REGISTRATION_FAILED: {
    title: '푸시 기기 등록 실패',
    input: { code: 'PUSH_REGISTRATION_FAILED', operation: 'register', cause: SYNTHETIC_API_CAUSE },
  },
  APP_VERSION_CHECK_FAILED: {
    title: '앱 버전 정책 조회 실패',
    input: { code: 'APP_VERSION_CHECK_FAILED', cause: SYNTHETIC_API_CAUSE },
  },
  PASS_PURCHASE_FAILED: {
    title: '이용권 결제 실패',
    input: { code: 'PASS_PURCHASE_FAILED', stage: 'purchase-account', cause: SYNTHETIC_API_CAUSE },
  },
  AUTH_SESSION_REJECTED: {
    title: '모르는 401로 세션 삭제',
    input: { code: 'AUTH_SESSION_REJECTED', stage: 'reissue', cause: SYNTHETIC_API_CAUSE },
  },
} satisfies ValidationDefinitions;

export interface SentryValidationCatalogItem {
  title: string;
  input: OperationalErrorInput;
}

export interface SentryValidationRunResult {
  receipts: readonly OperationalReportReceipt[];
  flush: OperationalFlushResult;
}

export const SENTRY_VALIDATION_CATALOG: readonly SentryValidationCatalogItem[] =
  Object.values(DEFINITIONS);

export function previewSentryValidationItem(
  item: SentryValidationCatalogItem,
): OperationalEventPayload {
  return previewOperationalError(item.input);
}

export function captureSentryValidationItem(
  item: SentryValidationCatalogItem,
): OperationalReportReceipt {
  return reportOperationalError(item.input);
}

export async function captureSentryValidationCatalog(
  onCapture?: (receipt: OperationalReportReceipt) => void,
  shouldContinue: () => boolean = () => true,
): Promise<SentryValidationRunResult> {
  const receipts: OperationalReportReceipt[] = [];

  for (const item of SENTRY_VALIDATION_CATALOG) {
    if (!shouldContinue()) break;
    const receipt = captureSentryValidationItem(item);
    receipts.push(receipt);
    onCapture?.(receipt);
  }

  const flush = shouldContinue()
    ? await flushOperationalEvents()
    : { status: 'flush-failed' as const };
  return { receipts, flush };
}
