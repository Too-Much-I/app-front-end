import { ApiError } from "@/lib/api/transport";
import {
  previewOperationalError,
  reportOperationalError,
  type OperationalErrorCode,
  type OperationalErrorInput,
  type OperationalReportReceipt,
} from "@/lib/operational-error-reporting";
import {
  flushOperationalEvents,
  type OperationalEventPayload,
  type OperationalFlushResult,
} from "@/lib/sentry";

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
  "Synthetic validation cause must not be transmitted",
  "SYNTHETIC_VALIDATION",
);

const DEFINITIONS = {
  AUTH_BOOTSTRAP_FAILED: {
    title: "인증 초기화 실패",
    input: {
      code: "AUTH_BOOTSTRAP_FAILED",
      source: "startup",
      operation: "read-local",
      attempt: "initial",
      cause: SYNTHETIC_API_CAUSE,
    },
  },
  EXAM_SESSION_CREATE_FAILED: {
    title: "시험 세션 생성 실패",
    input: {
      code: "EXAM_SESSION_CREATE_FAILED",
      stage: "session-create",
      attempt: "initial",
      cause: SYNTHETIC_API_CAUSE,
    },
  },
  EXAM_REQUIRED_AUDIO_FAILED: {
    title: "필수 음성 실패",
    input: {
      code: "EXAM_REQUIRED_AUDIO_FAILED",
      cueKind: "question",
      reason: "missing",
      partNumber: 2,
      questionNumber: 3,
      issueCount: 1,
    },
  },
  EXAM_PRELUDE_FAILED: {
    title: "파트 사전 자료 실패",
    input: {
      code: "EXAM_PRELUDE_FAILED",
      partNumber: 4,
      reason: "missing-part4-table",
    },
  },
  ANSWER_RECORDING_FAILED: {
    title: "답변 녹음 실패",
    input: {
      code: "ANSWER_RECORDING_FAILED",
      surface: "live",
      stage: "prepare",
      questionNumber: 1,
      retryCount: 0,
      attempt: 1,
    },
  },
  ANSWER_SUBMISSION_FAILED: {
    title: "답변 제출 실패",
    input: {
      code: "ANSWER_SUBMISSION_FAILED",
      stage: "upload",
      reason: "request",
      retryable: true,
      questionNumber: 1,
      retryCount: 0,
      attempt: 1,
      cause: SYNTHETIC_API_CAUSE,
    },
  },
  EXAM_GRADING_FAILED: {
    title: "시험 채점 실패",
    input: {
      code: "EXAM_GRADING_FAILED",
      stage: "polling",
      reason: "timeout",
      attempt: "retry",
    },
  },
  FEEDBACK_PAGE_LOAD_FAILED: {
    title: "피드백 페이지 로드 실패",
    input: {
      code: "FEEDBACK_PAGE_LOAD_FAILED",
      reason: "http",
      attempt: 1,
    },
  },
  FEEDBACK_DATA_LOAD_FAILED: {
    title: "피드백 데이터 로드 실패",
    input: {
      code: "FEEDBACK_DATA_LOAD_FAILED",
      resource: "QUESTION_FEEDBACK",
      cause: SYNTHETIC_API_CAUSE,
    },
  },
  FEEDBACK_HISTORY_LOAD_FAILED: {
    title: "피드백 이력 로드 실패",
    input: {
      code: "FEEDBACK_HISTORY_LOAD_FAILED",
      surface: "exam-history",
      attempt: 1,
      cause: SYNTHETIC_API_CAUSE,
    },
  },
  SUMMARY_FEEDBACK_RETRY_FAILED: {
    title: "종합 피드백 재생성 실패",
    input: {
      code: "SUMMARY_FEEDBACK_RETRY_FAILED",
      stage: "retry-polling",
      reason: "poll-timeout",
    },
  },
  REANSWER_QUESTION_LOAD_FAILED: {
    title: "재답변 문제 로드 실패",
    input: {
      code: "REANSWER_QUESTION_LOAD_FAILED",
      questionNumber: 1,
      cause: SYNTHETIC_API_CAUSE,
    },
  },
  REANSWER_SUBMISSION_FAILED: {
    title: "재답변 제출 실패",
    input: {
      code: "REANSWER_SUBMISSION_FAILED",
      reason: "request-failed",
      questionNumber: 1,
      retryCount: 1,
      cause: SYNTHETIC_API_CAUSE,
    },
  },
  REANSWER_GRADING_FAILED: {
    title: "재답변 채점 실패",
    input: {
      code: "REANSWER_GRADING_FAILED",
      reason: "timeout",
      questionNumber: 1,
      retryCount: 1,
    },
  },
  LEARNING_RECORD_DELETE_FAILED: {
    title: "학습 기록 삭제 실패",
    input: {
      code: "LEARNING_RECORD_DELETE_FAILED",
      operation: "delete-learning-records",
      cause: SYNTHETIC_API_CAUSE,
    },
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
    : { status: "flush-failed" as const };
  return { receipts, flush };
}
