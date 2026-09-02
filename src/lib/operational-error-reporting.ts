import {
  captureOperationalEvent,
  type OperationalCaptureResult,
  type OperationalEventPayload,
} from "@/lib/sentry";
import { ApiError } from "@/lib/api/transport";
import type { OperationalErrorCode } from "@/lib/operational-error-codes";
import type { ExamPartPreludeInvalidReason } from "@/types/exam";

export type { OperationalErrorCode } from "@/lib/operational-error-codes";

type ReportAttempt = "initial" | "retry";
type SafeCause = { cause?: unknown };
type RecordingStartOperation =
  | "playback-pause"
  | "permission-check"
  | "permission-request"
  | "audio-mode"
  | "recorder-prepare"
  | "record-start";

export type OperationalErrorInput =
  | ({
      code: "AUTH_BOOTSTRAP_FAILED";
      source: "startup" | "consent-submit";
      operation:
        | "read-local"
        | "persist-consent"
        | "persist-installation"
        | "reissue"
        | "guest"
        | "persist-session"
        | "check-consent"
        | "update-consent";
      attempt: ReportAttempt;
    } & SafeCause)
  | ({
      code: "EXAM_SESSION_CREATE_FAILED";
      stage: "session-create";
      attempt: ReportAttempt;
    } & SafeCause)
  | {
      code: "EXAM_REQUIRED_AUDIO_FAILED";
      cueKind: "sound-test" | "part-directions" | "part-intro" | "phase" | "question";
      reason: "missing" | "unsupported" | "playback" | "timeout" | "media-reset";
      partNumber?: number;
      questionNumber?: number;
      issueCount?: number;
    }
  | {
      code: "EXAM_PRELUDE_FAILED";
      partNumber: 3 | 4;
      reason: ExamPartPreludeInvalidReason | "missing-prelude";
    }
  | {
      code: "ANSWER_RECORDING_FAILED";
      surface: "microphone-test";
      stage: "prepare";
      operation: RecordingStartOperation;
      permissionGranted: boolean;
      attempt: number;
    }
  | {
      code: "ANSWER_RECORDING_FAILED";
      surface: "live" | "reanswer";
      stage: "prepare" | "stop" | "file-validation";
      operation?: Exclude<RecordingStartOperation, "playback-pause">;
      permissionGranted?: boolean;
      questionNumber: number;
      retryCount: number;
      attempt: number;
    }
  | ({
      code: "ANSWER_SUBMISSION_FAILED";
      stage: "upload" | "notify";
      reason: "request" | "server-processing";
      retryable: boolean;
      questionNumber: number;
      retryCount: number;
      attempt: number;
    } & SafeCause)
  | ({
      code: "EXAM_GRADING_FAILED";
      stage: "polling" | "retry-request";
      reason: "server-failed" | "timeout" | "request-failed";
      attempt: "retry";
    } & SafeCause)
  | {
      code: "FEEDBACK_PAGE_LOAD_FAILED";
      reason: "network" | "http" | "render";
      attempt: number;
    }
  | ({
      code: "FEEDBACK_DATA_LOAD_FAILED";
      resource: "EXAM_SUMMARY" | "QUESTION_FEEDBACK";
    } & SafeCause)
  | ({
      code: "FEEDBACK_HISTORY_LOAD_FAILED";
      surface: "home" | "exam-history" | "reanswer-history";
      attempt: number;
    } & SafeCause)
  | {
      code: "SUMMARY_FEEDBACK_RETRY_FAILED";
      stage: "retry-request" | "retry-polling";
      reason: "request-failed" | "poll-failed" | "poll-timeout";
    }
  | ({
      code: "REANSWER_QUESTION_LOAD_FAILED";
      questionNumber: number;
    } & SafeCause)
  | ({
      code: "REANSWER_SUBMISSION_FAILED";
      reason: "request-failed" | "server-processing";
      questionNumber: number;
      retryCount: number;
    } & SafeCause)
  | {
      code: "REANSWER_GRADING_FAILED";
      reason: "server-failed" | "timeout";
      questionNumber: number;
      retryCount: number;
    }
  | ({
      code: "LEARNING_RECORD_DELETE_FAILED";
      operation: "delete-learning-records";
    } & SafeCause)
  | ({
      code: "QUALITY_REVIEW_CONSENT_UPDATE_FAILED";
      operation: "set-quality-review-consent";
    } & SafeCause)
  | {
      code: "API_RESPONSE_VALIDATION_FAILED";
      resource: ApiResponseResource;
      /** 우리 스키마 기준의 필드 경로. 서버가 보낸 값은 담지 않는다. */
      issuePath: string;
      issueCode: string;
    };

/**
 * 스키마 검증을 붙인 엔드포인트. 옮겨올 때마다 여기에 하나씩 추가한다.
 *
 * feature 태그는 code 단위로만 붙어서(`FEATURE_BY_CODE`) 어느 응답이 어긋났는지는
 * 이 값으로 구분한다. `FEEDBACK_DATA_LOAD_FAILED`의 `resource`와 같은 방식이다.
 */
export type ApiResponseResource =
  | "CHALLENGE_TODAY"
  | "CHALLENGE_QUESTION"
  | "CHALLENGE_ATTEMPT"
  | "CHALLENGE_UPLOAD_URL"
  | "CHALLENGE_ANSWER";

type SafeValue = string | number | boolean;

const FEATURE_BY_CODE: Record<OperationalErrorCode, string> = {
  AUTH_BOOTSTRAP_FAILED: "auth",
  EXAM_SESSION_CREATE_FAILED: "mock-exam",
  EXAM_REQUIRED_AUDIO_FAILED: "mock-exam",
  EXAM_PRELUDE_FAILED: "mock-exam",
  ANSWER_RECORDING_FAILED: "exam-answer",
  ANSWER_SUBMISSION_FAILED: "exam-answer",
  EXAM_GRADING_FAILED: "grading",
  FEEDBACK_PAGE_LOAD_FAILED: "feedback",
  FEEDBACK_DATA_LOAD_FAILED: "feedback",
  FEEDBACK_HISTORY_LOAD_FAILED: "feedback",
  SUMMARY_FEEDBACK_RETRY_FAILED: "feedback",
  REANSWER_QUESTION_LOAD_FAILED: "reanswer",
  REANSWER_SUBMISSION_FAILED: "reanswer",
  REANSWER_GRADING_FAILED: "reanswer",
  LEARNING_RECORD_DELETE_FAILED: "settings",
  QUALITY_REVIEW_CONSENT_UPDATE_FAILED: "settings",
  API_RESPONSE_VALIDATION_FAILED: "api",
};

const SAFE_SERVER_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;

function classifyCause(cause: unknown): Record<string, SafeValue> {
  if (!(cause instanceof ApiError)) return {};

  return {
    ...(Number.isInteger(cause.status) && cause.status >= 100 && cause.status <= 599
      ? { httpStatus: cause.status }
      : {}),
    ...(cause.code && SAFE_SERVER_CODE_PATTERN.test(cause.code)
      ? { serverCode: cause.code }
      : {}),
  };
}

function toSafeContext(input: OperationalErrorInput): Record<string, SafeValue> {
  const { code: _code, cause, ...context } = input as OperationalErrorInput & SafeCause;
  const safeContext: Record<string, SafeValue> = {};

  for (const [key, value] of Object.entries(context)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      safeContext[key] = value;
    }
  }

  return { ...safeContext, ...classifyCause(cause) };
}

/**
 * 사용자 흐름을 실제로 막은 handled failure만 안정된 code와 허용 목록 metadata로 보고한다.
 * raw Error는 API status/code 분류 뒤 버리며 message, stack, URL과 response는 보내지 않는다.
 */
export function previewOperationalError(
  input: OperationalErrorInput,
): OperationalEventPayload {
  const context = toSafeContext(input);
  const tags = Object.fromEntries(
    Object.entries(context)
      .filter(([, value]) => typeof value === "string" || typeof value === "boolean")
      .map(([key, value]) => [key, String(value)]),
  );

  return {
    code: input.code,
    feature: FEATURE_BY_CODE[input.code],
    tags,
    context,
  };
}

export interface OperationalReportReceipt extends OperationalCaptureResult {
  preview: OperationalEventPayload;
}

export function reportOperationalError(
  input: OperationalErrorInput,
): OperationalReportReceipt {
  const preview = previewOperationalError(input);
  return { preview, ...captureOperationalEvent(preview) };
}
