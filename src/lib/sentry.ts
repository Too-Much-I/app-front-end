import * as Sentry from "@sentry/react-native";
import type { Breadcrumb, ErrorEvent } from "@sentry/react-native";
import type { ComponentType } from "react";

/**
 * DSN은 앱 번들에 실려 배포되는 공개 값이라 코드에 둔다.
 * 비밀은 소스맵 업로드용 SENTRY_AUTH_TOKEN 쪽이며, 빌드 타임에만 쓰인다.
 */
const SENTRY_DSN =
  "https://3d807f42b655d91761cc0d872414e7ef@o4511885627228160.ingest.us.sentry.io/4511885661569024";
const SENTRY_ENABLED = process.env.EXPO_PUBLIC_ENABLE_SENTRY === "true";
const FILTERED = "[Filtered]";
const SENSITIVE_KEY_PATTERN =
  /^(exam_?id|authorization|cookie|set-cookie|access_?token|refresh_?token|audio_?url)$/i;

function redactIdentifiers(value: string): string {
  return value
    .replace(/([?&]examId=)[^&#\s]*/gi, `$1${FILTERED}`)
    .replace(/(\/api\/v1\/exams\/)[^/?#\s]+/gi, `$1${FILTERED}`)
    .replace(/("examId"\s*:\s*")[^"]*(")/gi, `$1${FILTERED}$2`)
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
      SENSITIVE_KEY_PATTERN.test(key)
        ? FILTERED
        : scrubValue(nestedValue, seen),
    ]),
  );
}

function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return {
    ...breadcrumb,
    message:
      typeof breadcrumb.message === "string"
        ? redactIdentifiers(breadcrumb.message)
        : breadcrumb.message,
    data: breadcrumb.data
      ? (scrubValue(breadcrumb.data) as Record<string, unknown>)
      : breadcrumb.data,
  };
}

function scrubEvent(event: ErrorEvent): ErrorEvent {
  return {
    ...event,
    request: event.request
      ? {
          ...event.request,
          url:
            typeof event.request.url === "string"
              ? redactIdentifiers(event.request.url)
              : event.request.url,
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
    exception: event.exception
      ? (scrubValue(event.exception) as ErrorEvent["exception"])
      : event.exception,
  };
}

export function initializeSentry(): void {
  if (!SENTRY_ENABLED) {
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
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

/** 종합 피드백 재생성 접수 실패를 식별자·원본 응답 없이 보고한다. */
export function reportSummaryFeedbackRetryFailure(
  requestId: string,
  stage: "retry-request" | "retry-polling",
  reason: "request-failed" | "poll-failed" | "poll-timeout",
): void {
  if (!SENTRY_ENABLED) return;

  Sentry.withScope((scope) => {
    scope.setLevel("error");
    scope.setTags({
      feature: "exam-feedback",
      error_code: "SUMMARY_FEEDBACK_RETRY_REQUEST_FAILED",
      stage,
      data_source: "native-bridge",
    });
    scope.setFingerprint(["summary-feedback-retry-request-failed"]);
    scope.setContext("summary_feedback_retry", { requestId, reason });
    Sentry.captureMessage("Summary feedback retry request failed");
  });
}
