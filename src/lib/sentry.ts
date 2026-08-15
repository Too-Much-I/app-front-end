import * as Sentry from "@sentry/react-native";
import type { Breadcrumb, ErrorEvent } from "@sentry/react-native";
import type { ComponentType } from "react";

import type { OperationalErrorCode } from "@/lib/operational-error-reporting";
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
const STABLE_OPERATIONAL_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;

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

function scrubValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return redactIdentifiers(value);
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return FILTERED;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, seen));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      isSensitiveKey(key)
        ? FILTERED
        : scrubValue(nestedValue, seen),
    ]),
  );
}

function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return {
    ...breadcrumb,
    message: undefined,
    data: breadcrumb.data
      ? (scrubValue(breadcrumb.data) as Record<string, unknown>)
      : breadcrumb.data,
  };
}

function getStableOperationalMessage(event: ErrorEvent): string | undefined {
  const errorCode = event.tags?.error_code;
  return typeof event.message === "string" &&
    typeof errorCode === "string" &&
    event.message === errorCode &&
    STABLE_OPERATIONAL_CODE_PATTERN.test(errorCode)
    ? event.message
    : undefined;
}

function scrubException(
  exception: NonNullable<ErrorEvent["exception"]>,
): NonNullable<ErrorEvent["exception"]> {
  const scrubbed = scrubValue(
    exception,
  ) as NonNullable<ErrorEvent["exception"]>;
  return {
    ...scrubbed,
    values: scrubbed.values?.map((value) => ({
      ...value,
      value: value.value === undefined ? undefined : FILTERED,
    })),
  };
}

function scrubEvent(event: ErrorEvent): ErrorEvent {
  return {
    ...event,
    message: getStableOperationalMessage(event),
    transaction:
      typeof event.transaction === "string"
        ? redactIdentifiers(event.transaction)
        : event.transaction,
    fingerprint: event.fingerprint?.map(redactIdentifiers),
    tags: event.tags
      ? (scrubValue(event.tags) as Record<string, string>)
      : event.tags,
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
    contexts: event.contexts
      ? (scrubValue(event.contexts) as ErrorEvent["contexts"])
      : event.contexts,
    extra: event.extra
      ? (scrubValue(event.extra) as Record<string, unknown>)
      : event.extra,
    exception: event.exception ? scrubException(event.exception) : event.exception,
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

type OperationalContextValue = string | number | boolean;

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
