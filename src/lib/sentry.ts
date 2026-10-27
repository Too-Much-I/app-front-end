import * as Sentry from '@sentry/react-native';
import type {
  Breadcrumb,
  ErrorEvent,
  ReactNativeOptions,
  TransactionEvent,
} from '@sentry/react-native';
import type { ComponentType } from 'react';

import { toEndpointTemplate } from '@/lib/api/endpoint-template';
import { isOperationalErrorCode, type OperationalErrorCode } from '@/lib/operational-error-codes';
import {
  IS_SENTRY_VALIDATION_MODE,
  SENTRY_VALIDATION_ENVIRONMENT,
  SENTRY_VALIDATION_TAG_KEY,
  SENTRY_VALIDATION_TAG_VALUE,
} from '@/lib/sentry-validation-mode';

/**
 * DSN은 앱 번들에 실려 배포되는 공개 값이라 코드에 둔다.
 * 비밀은 소스맵 업로드용 SENTRY_AUTH_TOKEN 쪽이며, 빌드 타임에만 쓰인다.
 */
const SENTRY_DSN =
  'https://3d807f42b655d91761cc0d872414e7ef@o4511885627228160.ingest.us.sentry.io/4511885661569024';
const SENTRY_ENABLED = process.env.EXPO_PUBLIC_ENABLE_SENTRY === 'true';
const FILTERED = '[Filtered]';
const SENSITIVE_EXACT_KEY_PATTERN =
  /^(id|authorization|cookie|set-cookie|access_?token|refresh_?token|token|url|uri|path|body|request|response|result|message|user|username|email|phone)$/i;
const SENSITIVE_SUFFIX_KEY_PATTERN = /(?:id|ids|url|uri|path|token|tokens)$/i;
const SAFE_STACK_FILENAMES: ReadonlySet<string> = new Set([
  'index.android.bundle',
  'index.ios.bundle',
  'index.bundle',
  'main.jsbundle',
]);
const SENTRY_DEBUG_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/**
 * 국내 휴대폰 번호(010-1234-5678, 01012345678, +82 10 1234 5678)와 E.164 국제 번호.
 * 키 이름 규칙은 `phone` 키만 지우므로, 다른 키나 console 인자로 들어온 번호를 모양으로 지운다.
 * Hermes의 lookbehind 지원에 기대지 않으려고 앞 글자를 잡아 되돌려 넣는다.
 */
const PHONE_NUMBER_PATTERN =
  /(^|[^\d])(?:(?:\+82[\s.-]?|0)1[016789][\s.-]?\d{3,4}[\s.-]?\d{4}|\+\d{10,15})(?!\d)/g;
/** Sentry가 만드는 trace·span ID. 사용자 식별자가 아니고, 지우면 Sentry가 이벤트 처리 오류로 버린다. */
const TRACE_ID_PATTERN = /^[0-9a-f]{32}$/i;
const SPAN_ID_PATTERN = /^[0-9a-f]{16}$/i;
const TRACE_CONTEXT_ID_KEYS = {
  trace_id: TRACE_ID_PATTERN,
  span_id: SPAN_ID_PATTERN,
  parent_span_id: SPAN_ID_PATTERN,
} as const;

type SentryTags = NonNullable<ErrorEvent['tags']>;
type SentryTagValue = SentryTags[string];
type SentryContexts = NonNullable<ErrorEvent['contexts']>;
type SentryException = NonNullable<ErrorEvent['exception']>;
type SentryExceptionValue = NonNullable<SentryException['values']>[number];
type SentryMechanism = NonNullable<SentryExceptionValue['mechanism']>;
type SentryStacktrace = NonNullable<SentryExceptionValue['stacktrace']>;
type SentryStackFrame = NonNullable<SentryStacktrace['frames']>[number];

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_EXACT_KEY_PATTERN.test(key) || SENSITIVE_SUFFIX_KEY_PATTERN.test(key);
}

function redactIdentifiers(value: string): string {
  return value
    .replace(/https?:\/\/[^\s"']+/gi, FILTERED)
    .replace(/(?:file:\/\/\/|content:\/\/|\/)[^\s"']+\.(?:aac|caf|m4a|mp3|wav)/gi, FILTERED)
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      FILTERED,
    )
    .replace(/([?&]examId=)[^&#\s]*/gi, `$1${FILTERED}`)
    .replace(/(\/api\/v1\/exams\/)[^/?#\s]+/gi, `$1${FILTERED}`)
    .replace(/("[A-Za-z0-9_]*(?:Id|_id)"\s*:\s*")[^"]*(")/g, `$1${FILTERED}$2`)
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, `$1${FILTERED}`)
    .replace(EMAIL_PATTERN, FILTERED)
    .replace(PHONE_NUMBER_PATTERN, `$1${FILTERED}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function scrubValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return redactIdentifiers(value);
  if (!value || typeof value !== 'object') return value;
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
      isSensitiveKey(key) ? FILTERED : scrubValue(nestedValue, seen),
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
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint' ||
    typeof value === 'symbol'
  );
}

function scrubTags(value: unknown): SentryTags | undefined {
  if (!isRecord(value)) return undefined;
  const tags: SentryTags = {};

  for (const [key, tagValue] of Object.entries(value)) {
    if (isSensitiveKey(key)) {
      tags[key] = FILTERED;
    } else if (typeof tagValue === 'string') {
      tags[key] = redactIdentifiers(tagValue);
    } else if (isSentryTagValue(tagValue)) {
      tags[key] = tagValue;
    }
  }

  return tags;
}

/**
 * `contexts.trace`의 ID는 키 이름이 `_id`로 끝나 일반 규칙에 지워진다(TOSUNSAENG-APP-8의
 * "Discarded invalid value"). 모양이 맞을 때만 원래 값을 되살린다.
 */
function restoreTraceContextIds(
  original: unknown,
  scrubbed: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!isRecord(original) || !scrubbed) return scrubbed;
  const restored = { ...scrubbed };

  for (const [key, pattern] of Object.entries(TRACE_CONTEXT_ID_KEYS)) {
    const id = original[key];
    if (typeof id === 'string' && pattern.test(id)) restored[key] = id;
  }

  return restored;
}

function scrubContexts(value: unknown): SentryContexts | undefined {
  const scrubbed = scrubRecord(value);
  if (!scrubbed) return undefined;
  const contexts: SentryContexts = {};

  for (const [key, context] of Object.entries(scrubbed)) {
    if (context === undefined || isRecord(context)) {
      contexts[key] =
        key === 'trace' && isRecord(value) && isRecord(context)
          ? restoreTraceContextIds(value.trace, context)
          : context;
    }
  }

  return contexts;
}

/**
 * SDK가 터치 breadcrumb에 쓰는 category. 이 값일 때만 아래 `path` 예외가 적용된다.
 * (@sentry/react-native의 TouchEventBoundary 기본값)
 */
const TOUCH_BREADCRUMB_CATEGORY = 'touch';

/**
 * 터치 breadcrumb의 `data.path` 항목에서 살려두는 필드.
 *
 * SDK가 넣는 항목은 `{ name, element, file, label }`인데, 앞의 셋은
 * `@sentry/babel-plugin-component-annotate`가 빌드 타임에 박아준 소스 식별자
 * (컴포넌트 이름·엘리먼트 이름·소스 파일명)라 사용자 데이터가 될 수 없다.
 * `label`만 `sentry-label` prop에서 오는 런타임 값이라 화면에 보이는 텍스트
 * — 사용자 이름 같은 것 — 이 들어올 수 있어 통째로 버린다.
 */
const TOUCH_PATH_SAFE_KEYS = ['name', 'element', 'file'] as const;

type TouchPathEntry = Partial<Record<(typeof TOUCH_PATH_SAFE_KEYS)[number], string>>;

function scrubTouchPathEntry(value: unknown): TouchPathEntry | undefined {
  if (!isRecord(value)) return undefined;

  const entry: TouchPathEntry = {};
  for (const key of TOUCH_PATH_SAFE_KEYS) {
    const nested = value[key];
    // 소스 식별자라도 redactIdentifiers는 그대로 통과시킨다 — 방어선을 우회하지 않기 위해.
    if (typeof nested === 'string' && nested.length > 0) {
      entry[key] = redactIdentifiers(nested);
    }
  }

  return Object.keys(entry).length > 0 ? entry : undefined;
}

function scrubTouchPath(value: unknown): TouchPathEntry[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const path = value
    .map(scrubTouchPathEntry)
    .filter((entry): entry is TouchPathEntry => entry !== undefined);

  return path.length > 0 ? path : undefined;
}

/**
 * `message`는 항상 지운다 — 터치 breadcrumb의 message는 `label`을 그대로 끼워 넣는다.
 *
 * 대신 터치 breadcrumb에 한해 `data.path`를 되살린다. 기본 스크러버는 `path`를 민감 키로
 * 보는데(URL 경로를 막기 위한 규칙), 터치 경로는 이름만 같을 뿐 성격이 다르다. 이게 없으면
 * 재현 불가 제보에서 "어느 화면의 무엇을 눌렀는가"를 특정할 방법이 사라진다.
 */
function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  const data = scrubRecord(breadcrumb.data);
  const touchPath =
    breadcrumb.category === TOUCH_BREADCRUMB_CATEGORY && isRecord(breadcrumb.data)
      ? scrubTouchPath(breadcrumb.data.path)
      : undefined;

  return {
    ...breadcrumb,
    message: undefined,
    data: touchPath ? { ...data, path: touchPath } : data,
  };
}

function getStableOperationalMessage(event: ErrorEvent): string | undefined {
  const errorCode = event.tags?.error_code;
  return isOperationalErrorCode(errorCode) && event.message === errorCode ? errorCode : undefined;
}

function scrubOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? redactIdentifiers(value) : undefined;
}

function scrubOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function scrubOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function scrubStackFilename(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const filename = value.replaceAll('\\', '/').split('/').at(-1);
  return filename && SAFE_STACK_FILENAMES.has(filename) ? filename : FILTERED;
}

function scrubSentryDebugId(value: unknown): string | undefined {
  return typeof value === 'string' && SENTRY_DEBUG_ID_PATTERN.test(value) ? value : undefined;
}

function scrubStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string').map(redactIdentifiers);
}

function scrubMechanism(value: unknown): SentryMechanism | undefined {
  if (!isRecord(value) || typeof value.type !== 'string') return undefined;
  const data: NonNullable<SentryMechanism['data']> = {};

  if (isRecord(value.data)) {
    for (const [key, dataValue] of Object.entries(value.data)) {
      if (isSensitiveKey(key)) {
        data[key] = FILTERED;
      } else if (typeof dataValue === 'string') {
        data[key] = redactIdentifiers(dataValue);
      } else if (typeof dataValue === 'boolean') {
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
  return typeof start === 'number' && typeof end === 'number' ? [start, end] : undefined;
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
      typeof value.value === 'string' && value.value === stableOperationalMessage
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
        .map((exceptionValue) => scrubExceptionValue(exceptionValue, stableOperationalMessage))
        .filter(
          (exceptionValue): exceptionValue is SentryExceptionValue => exceptionValue !== undefined,
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
      typeof event.transaction === 'string'
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

type SentrySpanJSON = Parameters<NonNullable<ReactNativeOptions['beforeSendSpan']>>[0];

/**
 * 성능 추적 표본 비율(2026-10-11 결정으로 켬). 무료 요금제 span 쿼터(월 500만)는 오류 쿼터와 따로
 * 센다. 처음 켜는 값이라 낮게 두고 Stats에서 사용량을 보며 올린다.
 */
const TRACES_SAMPLE_RATE = 0.2;
const URL_IN_TEXT_PATTERN = /https?:\/\/[^\s"']+/gi;

/**
 * HTTP span 이름은 `GET https://host/api/v1/exams/123/...`처럼 실제 URL을 담는다. URL을 지우면
 * 어느 요청이 느렸는지 알 수 없으므로 식별자를 비운 경로 틀로 바꾼 뒤 나머지를 거른다.
 */
function scrubSpanDescription(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return redactIdentifiers(value.replace(URL_IN_TEXT_PATTERN, (url) => toEndpointTemplate(url)));
}

function scrubSpan(span: SentrySpanJSON): SentrySpanJSON {
  return {
    ...span,
    description: scrubSpanDescription(span.description),
    data: (scrubRecord(span.data) ?? {}) as SentrySpanJSON['data'],
  };
}

/** 오류 이벤트와 같은 기준으로 거른다. 자식 span은 `beforeSendSpan`(scrubSpan)이 따로 거른다. */
function scrubTransaction(event: TransactionEvent): TransactionEvent {
  return {
    ...event,
    transaction: scrubSpanDescription(event.transaction),
    tags: scrubTags(event.tags),
    request: undefined,
    user: undefined,
    breadcrumbs: event.breadcrumbs?.map(scrubBreadcrumb),
    contexts: scrubContexts(event.contexts),
    extra: scrubRecord(event.extra),
  };
}

/**
 * 화면 이동을 navigation span과 breadcrumb으로 남긴다. `App`의 NavigationContainer가
 * onReady에서 등록한다. route params는 SDK가 싣지 않는다.
 */
const navigationIntegration = Sentry.reactNavigationIntegration();

export function registerNavigationContainer(navigationContainerRef: unknown): void {
  if (!SENTRY_ENABLED) return;

  try {
    navigationIntegration.registerNavigationContainer(navigationContainerRef);
  } catch {
    // 관측 도구 실패가 원래 사용자 흐름을 가로막으면 안 된다.
  }
}

export function initializeSentry(): void {
  if (!SENTRY_ENABLED) {
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: IS_SENTRY_VALIDATION_MODE ? SENTRY_VALIDATION_ENVIRONMENT : undefined,
    // 학습자 답안과 계정 정보가 오가는 앱이므로 자동 PII 수집을 켜지 않는다.
    sendDefaultPii: false,
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubTransaction,
    beforeSendSpan: scrubSpan,
    beforeBreadcrumb: scrubBreadcrumb,
    integrations: [navigationIntegration],
    tracesSampleRate: TRACES_SAMPLE_RATE,
    // 우리 서버와 S3로 가는 요청에 sentry-trace·baggage 헤더를 붙이지 않는다. 서버에 Sentry가 없어
    // 쓸모가 없고, 서명된 업로드 URL 요청에 헤더가 늘어나는 일도 피한다.
    tracePropagationTargets: [],
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

export type BreadcrumbLevel = 'info' | 'warning';

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
  level: BreadcrumbLevel = 'info',
): void {
  if (!SENTRY_ENABLED) return;

  try {
    Sentry.addBreadcrumb({ category, level, data });
  } catch {
    // 관측 도구 실패가 원래 사용자 흐름을 가로막으면 안 된다.
  }
}

/**
 * 모든 이벤트에 붙는 계정 상태. 식별자가 아니라 닫힌 분류값이다(사용자 식별자는 처리방침의
 * Sentry 이전 항목에 없어 싣지 않는다, 2026-10-11 결정).
 */
export type AccountStateTag = 'member' | 'guest' | 'none';

const NO_ROUTE_SCREEN_TAG = 'no-route';

export function setAccountStateTag(state: AccountStateTag): void {
  if (!SENTRY_ENABLED) return;

  try {
    Sentry.setTag('account_state', state);
  } catch {
    // 관측 도구 실패가 원래 사용자 흐름을 가로막으면 안 된다.
  }
}

/**
 * 화면이 바뀔 때마다 부른다. 이후 이벤트에 `screen` 태그가 붙어 "어느 화면에서 몰리나"를 집계할
 * 수 있다. 이동 기록(breadcrumb)은 내비게이션 연동이 남긴다. 라우트 이름은 코드에 적힌 식별자다.
 */
export function setScreenTag(routeName: string | undefined): void {
  if (!SENTRY_ENABLED) return;

  try {
    // route가 없으면 RootNavigator가 navigator 없이 그린 화면(로그인 진행·계정 안내)이다.
    // 어느 상태였는지는 `account_state` 태그와 breadcrumb으로 본다.
    Sentry.setTag('screen', routeName ?? NO_ROUTE_SCREEN_TAG);
  } catch {
    // 관측 도구 실패가 원래 사용자 흐름을 가로막으면 안 된다.
  }
}

/**
 * 렌더 크래시를 잡아 componentStack과 함께 보고하는 경계. SDK 세부를 이 파일 밖으로 내지 않으려고
 * 다시 내보낸다. 수집이 꺼져 있어도 경계 역할(대체 화면)은 그대로 한다.
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;

export interface OperationalEventPayload {
  code: OperationalErrorCode;
  feature: string;
  /** 흐름을 막은 실패는 `error`, 흐름은 계속되는 서버 계약 위반은 `warning`이다. */
  level: 'error' | 'warning';
  /** 이슈 묶음 기준. 오류 이름이 앞에 오고, 원인이 섞이는 코드만 원인 축이 뒤에 붙는다. */
  fingerprint: readonly string[];
  tags: Record<string, string>;
  context: Record<string, OperationalContextValue>;
}

export interface OperationalCaptureResult {
  eventId: string | null;
  status: 'captured' | 'capture-failed' | 'disabled';
}

export interface OperationalFlushResult {
  status: 'flushed' | 'flush-failed' | 'disabled';
}

export interface SentryRuntimeState {
  enabled: boolean;
  environment: string | null;
  validationMode: boolean;
}

export function getSentryRuntimeState(): SentryRuntimeState {
  return {
    enabled: SENTRY_ENABLED,
    environment: IS_SENTRY_VALIDATION_MODE ? SENTRY_VALIDATION_ENVIRONMENT : null,
    validationMode: IS_SENTRY_VALIDATION_MODE,
  };
}

/** SDK 세부사항을 product error catalog 밖으로 숨기고 어떤 경우에도 caller로 throw하지 않는다. */
export function captureOperationalEvent(
  payload: OperationalEventPayload,
): OperationalCaptureResult {
  if (!SENTRY_ENABLED) return { eventId: null, status: 'disabled' };

  try {
    const eventId = Sentry.withScope((scope) => {
      scope.setLevel(payload.level);
      scope.setTags({
        feature: payload.feature,
        error_code: payload.code,
        ...payload.tags,
        ...(IS_SENTRY_VALIDATION_MODE
          ? { [SENTRY_VALIDATION_TAG_KEY]: SENTRY_VALIDATION_TAG_VALUE }
          : {}),
      });
      scope.setFingerprint([...payload.fingerprint]);
      scope.setContext('operational_error', payload.context);
      return Sentry.captureMessage(payload.code);
    });
    return eventId ? { eventId, status: 'captured' } : { eventId: null, status: 'capture-failed' };
  } catch {
    // 관측 도구 실패가 원래 사용자 오류 처리나 복구 행동을 가로막으면 안 된다.
    return { eventId: null, status: 'capture-failed' };
  }
}

/** 진단 화면이 pending event 처리 여부를 확인하되 SDK 오류를 사용자 흐름으로 전파하지 않는다. */
export async function flushOperationalEvents(): Promise<OperationalFlushResult> {
  if (!SENTRY_ENABLED) return { status: 'disabled' };

  try {
    return (await Sentry.flush()) ? { status: 'flushed' } : { status: 'flush-failed' };
  } catch {
    return { status: 'flush-failed' };
  }
}
