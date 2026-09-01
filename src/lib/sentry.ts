import * as Sentry from "@sentry/react-native";
import type { Breadcrumb, ErrorEvent } from "@sentry/react-native";
import type { ComponentType } from "react";

import {
  isOperationalErrorCode,
  type OperationalErrorCode,
} from "@/lib/operational-error-codes";
import {
  IS_SENTRY_VALIDATION_MODE,
  SENTRY_VALIDATION_ENVIRONMENT,
  SENTRY_VALIDATION_TAG_KEY,
  SENTRY_VALIDATION_TAG_VALUE,
} from "@/lib/sentry-validation-mode";

/**
 * DSN은 앱 번들에 실려 배포되는 공개 값이라 코드에 둔다.
 * 비밀은 소스맵 업로드용 SENTRY_AUTH_TOKEN 쪽이며, 빌드 타임에만 쓰인다.
 */
const SENTRY_DSN =
  "https://3d807f42b655d91761cc0d872414e7ef@o4511885627228160.ingest.us.sentry.io/4511885661569024";
const SENTRY_ENABLED = process.env.EXPO_PUBLIC_ENABLE_SENTRY === "true";
const FILTERED = "[Filtered]";
const SENSITIVE_EXACT_KEY_PATTERN =
  /^(id|authorization|cookie|set-cookie|access_?token|refresh_?token|token|url|uri|path|body|request|response|result|message|user|username|email|phone)$/i;
const SENSITIVE_SUFFIX_KEY_PATTERN =
  /(?:id|ids|url|uri|path|token|tokens)$/i;
const SAFE_STACK_FILENAMES: ReadonlySet<string> = new Set([
  "index.android.bundle",
  "index.ios.bundle",
  "index.bundle",
  "main.jsbundle",
]);
const SENTRY_DEBUG_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SentryTags = NonNullable<ErrorEvent["tags"]>;
type SentryTagValue = SentryTags[string];
type SentryContexts = NonNullable<ErrorEvent["contexts"]>;
type SentryException = NonNullable<ErrorEvent["exception"]>;
type SentryExceptionValue = NonNullable<SentryException["values"]>[number];
type SentryMechanism = NonNullable<SentryExceptionValue["mechanism"]>;
type SentryStacktrace = NonNullable<SentryExceptionValue["stacktrace"]>;
type SentryStackFrame = NonNullable<SentryStacktrace["frames"]>[number];

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_EXACT_KEY_PATTERN.test(key) || SENSITIVE_SUFFIX_KEY_PATTERN.test(key);
}

function redactIdentifiers(value: string): string {
  return value
    .replace(/https?:\/\/[^\s"']+/gi, FILTERED)
    .replace(/(?:file:\/\/\/|content:\/\/|\/)[^\s"']+\.(?:aac|caf|m4a|mp3|wav)/gi, FILTERED)
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, FILTERED)
    .replace(/([?&]examId=)[^&#\s]*/gi, `$1${FILTERED}`)
    .replace(/(\/api\/v1\/exams\/)[^/?#\s]+/gi, `$1${FILTERED}`)
    .replace(/("[A-Za-z0-9_]*(?:Id|_id)"\s*:\s*")[^"]*(")/g, `$1${FILTERED}$2`)
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, `$1${FILTERED}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scrubValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return redactIdentifiers(value);
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return FILTERED;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, seen));
  }

  if (!isRecord(value)) return FILTERED;
  return scrubRecordEntries(value, seen);
}

function scrubRecordEntries(
  value: Record<string, unknown>,
  seen: WeakSet<object>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      isSensitiveKey(key)
        ? FILTERED
        : scrubValue(nestedValue, seen),
    ]),
  );
}

function scrubRecord(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  const scrubbed = scrubValue(value);
  return isRecord(scrubbed) ? scrubbed : undefined;
}

function isSentryTagValue(value: unknown): value is SentryTagValue {
  return (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint" ||
    typeof value === "symbol"
  );
}

function scrubTags(value: unknown): SentryTags | undefined {
  if (!isRecord(value)) return undefined;
  const tags: SentryTags = {};

  for (const [key, tagValue] of Object.entries(value)) {
    if (isSensitiveKey(key)) {
      tags[key] = FILTERED;
    } else if (typeof tagValue === "string") {
      tags[key] = redactIdentifiers(tagValue);
    } else if (isSentryTagValue(tagValue)) {
      tags[key] = tagValue;
    }
  }

  return tags;
}

function scrubContexts(value: unknown): SentryContexts | undefined {
  const scrubbed = scrubRecord(value);
  if (!scrubbed) return undefined;
  const contexts: SentryContexts = {};

  for (const [key, context] of Object.entries(scrubbed)) {
    if (context === undefined || isRecord(context)) {
      contexts[key] = context;
    }
  }

  return contexts;
}

function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return {
    ...breadcrumb,
    message: undefined,
    data: scrubRecord(breadcrumb.data),
  };
}

function getStableOperationalMessage(event: ErrorEvent): string | undefined {
  const errorCode = event.tags?.error_code;
  return isOperationalErrorCode(errorCode) && event.message === errorCode
    ? errorCode
    : undefined;
}

function scrubOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? redactIdentifiers(value) : undefined;
}

function scrubOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function scrubOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function scrubStackFilename(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const filename = value.replaceAll("\\", "/").split("/").at(-1);
  return filename && SAFE_STACK_FILENAMES.has(filename) ? filename : FILTERED;
}

function scrubSentryDebugId(value: unknown): string | undefined {
  return typeof value === "string" && SENTRY_DEBUG_ID_PATTERN.test(value)
    ? value
    : undefined;
}

function scrubStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((item): item is string => typeof item === "string")
    .map(redactIdentifiers);
}

function scrubMechanism(value: unknown): SentryMechanism | undefined {
  if (!isRecord(value) || typeof value.type !== "string") return undefined;
  const data: NonNullable<SentryMechanism["data"]> = {};

  if (isRecord(value.data)) {
    for (const [key, dataValue] of Object.entries(value.data)) {
      if (isSensitiveKey(key)) {
        data[key] = FILTERED;
      } else if (typeof dataValue === "string") {
        data[key] = redactIdentifiers(dataValue);
      } else if (typeof dataValue === "boolean") {
        data[key] = dataValue;
      }
    }
  }

  return {
    type: redactIdentifiers(value.type),
    handled: scrubOptionalBoolean(value.handled),
    data: Object.keys(data).length > 0 ? data : undefined,
    synthetic: scrubOptionalBoolean(value.synthetic),
    source: scrubOptionalString(value.source),
    is_exception_group: scrubOptionalBoolean(value.is_exception_group),
  };
}

function scrubStackFrame(value: unknown): SentryStackFrame | undefined {
  if (!isRecord(value)) return undefined;

  return {
    filename: scrubStackFilename(value.filename),
    function: scrubOptionalString(value.function),
    module: scrubOptionalString(value.module),
    platform: scrubOptionalString(value.platform),
    lineno: scrubOptionalNumber(value.lineno),
    colno: scrubOptionalNumber(value.colno),
    abs_path: undefined,
    context_line: scrubOptionalString(value.context_line),
    pre_context: scrubStringArray(value.pre_context),
    post_context: scrubStringArray(value.post_context),
    in_app: scrubOptionalBoolean(value.in_app),
    instruction_addr: scrubOptionalString(value.instruction_addr),
    addr_mode: scrubOptionalString(value.addr_mode),
    vars: scrubRecord(value.vars),
    // Debug ID는 source map artifact 식별자이며 사용자 식별자가 아니다.
    debug_id: scrubSentryDebugId(value.debug_id),
    module_metadata: scrubValue(value.module_metadata),
  };
}

function scrubFramesOmitted(value: unknown): [number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const [start, end] = value;
  return typeof start === "number" && typeof end === "number"
    ? [start, end]
    : undefined;
}

function scrubStacktrace(value: unknown): SentryStacktrace | undefined {
  if (!isRecord(value)) return undefined;
  const frames = Array.isArray(value.frames)
    ? value.frames
        .map(scrubStackFrame)
        .filter((frame): frame is SentryStackFrame => frame !== undefined)
    : undefined;

  return {
    frames,
    frames_omitted: scrubFramesOmitted(value.frames_omitted),
  };
}

function scrubExceptionValue(
  value: unknown,
  stableOperationalMessage?: string,
): SentryExceptionValue | undefined {
  if (!isRecord(value)) return undefined;

  return {
    type: scrubOptionalString(value.type),
    value:
      typeof value.value === "string" && value.value === stableOperationalMessage
        ? stableOperationalMessage
        : value.value === undefined
          ? undefined
          : FILTERED,
    mechanism: scrubMechanism(value.mechanism),
    module: scrubOptionalString(value.module),
    thread_id: undefined,
    stacktrace: scrubStacktrace(value.stacktrace),
  };
}

function scrubException(
  value: unknown,
  stableOperationalMessage?: string,
): SentryException | undefined {
  if (!isRecord(value)) return undefined;
  const values = Array.isArray(value.values)
    ? value.values
        .map((exceptionValue) =>
          scrubExceptionValue(exceptionValue, stableOperationalMessage),
        )
        .filter(
          (exceptionValue): exceptionValue is SentryExceptionValue =>
            exceptionValue !== undefined,
        )
    : undefined;

  return { values };
}

function scrubEvent(event: ErrorEvent): ErrorEvent {
  const stableOperationalMessage = getStableOperationalMessage(event);

  return {
    ...event,
    message: stableOperationalMessage,
    transaction:
      typeof event.transaction === "string"
        ? redactIdentifiers(event.transaction)
        : event.transaction,
    fingerprint: event.fingerprint?.map(redactIdentifiers),
    tags: scrubTags(event.tags),
    request: event.request
      ? {
          ...event.request,
          url: undefined,
          query_string: undefined,
          headers: undefined,
          cookies: undefined,
          data: undefined,
        }
      : undefined,
    user: undefined,
    breadcrumbs: event.breadcrumbs?.map(scrubBreadcrumb),
    contexts: scrubContexts(event.contexts),
    extra: scrubRecord(event.extra),
    exception: scrubException(event.exception, stableOperationalMessage),
  };
}

export function initializeSentry(): void {
  if (!SENTRY_ENABLED) {
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: IS_SENTRY_VALIDATION_MODE
      ? SENTRY_VALIDATION_ENVIRONMENT
      : undefined,
    // 학습자 답안과 계정 정보가 오가는 앱이므로 자동 PII 수집을 켜지 않는다.
    sendDefaultPii: false,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
    // 성능 트레이스는 이벤트 쿼터를 빠르게 소모한다. 우선 크래시 수집만 운영한다.
    tracesSampleRate: 0,
  });
}

/**
 * 루트 컴포넌트를 감싸 터치 브레드크럼과 앱 시작 성능 계측을 붙인다.
 * 수집이 꺼져 있으면 원본 컴포넌트를 그대로 돌려준다.
 */
export function withSentry<P extends Record<string, unknown>>(
  RootComponent: ComponentType<P>,
): ComponentType<P> {
  return SENTRY_ENABLED ? Sentry.wrap(RootComponent) : RootComponent;
}

export type OperationalContextValue = string | number | boolean;

export type BreadcrumbLevel = "info" | "warning";

/**
 * `beforeBreadcrumb`(위 scrubBreadcrumb)이 message를 항상 지우므로, 실제로 Sentry에
 * 남는 값은 category와 이 data뿐이다. data에는 enum·숫자처럼 닫힌 집합의 값만
 * 넘긴다 — 자유 텍스트를 조합해서 넘기면 scrubBreadcrumb의 message 전체 삭제 정책을
 * 우회하는 셈이 된다. `category`는 기능마다 자기 타입으로 좁혀 호출한다(예:
 * `ExamBreadcrumbCategory`) — 이 함수는 SDK 호출만 감쌀 뿐 특정 기능을 모른다.
 */
export function emitBreadcrumb(
  category: string,
  data: Record<string, OperationalContextValue>,
  level: BreadcrumbLevel = "info",
): void {
  if (!SENTRY_ENABLED) return;

  try {
    Sentry.addBreadcrumb({ category, level, data });
  } catch {
    // 관측 도구 실패가 원래 사용자 흐름을 가로막으면 안 된다.
  }
}

export interface OperationalEventPayload {
  code: OperationalErrorCode;
  feature: string;
  tags: Record<string, string>;
  context: Record<string, OperationalContextValue>;
}

export interface OperationalCaptureResult {
  eventId: string | null;
  status: "captured" | "capture-failed" | "disabled";
}

export interface OperationalFlushResult {
  status: "flushed" | "flush-failed" | "disabled";
}

export interface SentryRuntimeState {
  enabled: boolean;
  environment: string | null;
  validationMode: boolean;
}

export function getSentryRuntimeState(): SentryRuntimeState {
  return {
    enabled: SENTRY_ENABLED,
    environment: IS_SENTRY_VALIDATION_MODE
      ? SENTRY_VALIDATION_ENVIRONMENT
      : null,
    validationMode: IS_SENTRY_VALIDATION_MODE,
  };
}

/** SDK 세부사항을 product error catalog 밖으로 숨기고 어떤 경우에도 caller로 throw하지 않는다. */
export function captureOperationalEvent(
  payload: OperationalEventPayload,
): OperationalCaptureResult {
  if (!SENTRY_ENABLED) return { eventId: null, status: "disabled" };

  try {
    const eventId = Sentry.withScope((scope) => {
      scope.setLevel("error");
      scope.setTags({
        feature: payload.feature,
        error_code: payload.code,
        ...payload.tags,
        ...(IS_SENTRY_VALIDATION_MODE
          ? { [SENTRY_VALIDATION_TAG_KEY]: SENTRY_VALIDATION_TAG_VALUE }
          : {}),
      });
      scope.setFingerprint(["operational-error", payload.code]);
      scope.setContext("operational_error", payload.context);
      return Sentry.captureMessage(payload.code);
    });
    return eventId
      ? { eventId, status: "captured" }
      : { eventId: null, status: "capture-failed" };
  } catch {
    // 관측 도구 실패가 원래 사용자 오류 처리나 복구 행동을 가로막으면 안 된다.
    return { eventId: null, status: "capture-failed" };
  }
}

/** 진단 화면이 pending event 처리 여부를 확인하되 SDK 오류를 사용자 흐름으로 전파하지 않는다. */
export async function flushOperationalEvents(): Promise<OperationalFlushResult> {
  if (!SENTRY_ENABLED) return { status: "disabled" };

  try {
    return (await Sentry.flush())
      ? { status: "flushed" }
      : { status: "flush-failed" };
  } catch {
    return { status: "flush-failed" };
  }
}
