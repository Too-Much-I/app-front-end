# WebView 데이터 브리지와 모의고사 이력 연결 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 피드백 웹뷰가 인증 토큰을 넘겨받지 않고도 데이터를 받게 만들고, 모의고사 기록 탭을 실제 이력 API에 연결한다.

**Architecture:** 네이티브를 인증된 전송 프록시로 둔다. 웹이 화이트리스트된 리소스 이름으로 데이터를 요청하면, 네이티브가 자신이 보유한 액세스 토큰으로 호출해 **서버 원본 `result`를 그대로** 돌려주고 웹은 기존 매퍼로 렌더 타입을 만든다. 토큰은 네이티브 경계를 넘지 않는다. 모의고사 이력은 앱이 직접 `GET /api/v1/exams/history`를 호출한다.

**Tech Stack:** Expo 57 / React Native / strict TypeScript (`app-front-end`), Next.js App Router / React Query (`web-front-end`), pnpm.

**설계 문서:** [2026-08-05-webview-data-bridge-and-exam-history-design.md](../specs/2026-08-05-webview-data-bridge-and-exam-history-design.md)

> **실행 완료 — Task 5·6의 API 형태는 아래 본문이 아니라 설계 문서를 보라.**
>
> 이 계획의 Task 5·6은 스테이징 `/v3/api-docs`(OpenAPI)를 근거로 작성했는데, 그 스펙이
> 실제 응답과 달랐다. 실행 중 사용자가 실제 payload를 확인해 주어 다음을 정정했다.
>
> - `history`: `histories` → `exams`. `totalCount`·`cycleNumber`·`summaryAvailable`은 없고,
>   `retriedQuestionCount`는 **있다**. 따라서 카드 부제의 "다시 답변 N문제"를 지우지 않고
>   그대로 쓰며, `summaryAvailable` 기반 비활성 카드는 만들지 않는다.
> - `retries`: `status`가 아니라 `score`·`completedAt`이 온다. 점수가 있으므로 "다시 답변한
>   문제" 탭도 이번에 함께 연결했고, `mock-exam-history.ts`는 삭제했다.
> - 문항 만점은 `part-meta.ts`의 `EXAM_PART_MAX_SCORE`(1~10번 3점, 11번 5점)로 둔다.
>
> Task 1~4(웹뷰 브리지)는 본문 그대로 유효하다.

## Global Constraints

- 두 저장소 모두 `pnpm`을 쓴다. npm/Yarn 락파일을 만들지 않는다.
- **두 저장소 모두 자동화된 테스트 러너가 없다.** 각 태스크의 검증은 `pnpm lint` + `pnpm exec tsc --noEmit` + 명시된 수동 확인이다. 이 작업으로 테스트 러너를 새로 도입하지 않는다(`AGENTS.md`: "Do not add dependencies unless the task genuinely requires one").
- strict TypeScript를 유지한다. `any`, 안전하지 않은 캐스트, 타입 suppression을 쓰지 않는다.
- 앱 코드는 `@/*` alias로 import한다.
- 앱 화면은 공유 `Text`, `Pressable` 컴포넌트를 쓴다(`@/components/ui/`).
- 앱 스타일은 NativeWind `className`을 쓴다.
- **액세스 토큰, 리프레시 토큰, `installationId`를 로그로 남기지 않는다.**
- 웹뷰 메시지가 계약에 맞지 않으면 조용히 무시하고 현재 화면을 유지한다. 오류 화면을 띄우지 않는다.
- 사용자에게 보이는 문구는 한국어이며, 기존 화면의 존댓말 톤("~해요")을 따른다.
- 새 의존성을 추가하지 않는다.

**저장소 경로:**
- 앱: `/Users/s0107/soma/app-front-end`
- 웹: `/Users/s0107/soma/web-front-end`

---

## File Structure

**앱 (`app-front-end`)**

| 파일 | 책임 |
|---|---|
| `src/features/exam/api/exam-grading-summary.ts` (수정) | 원본 result 반환 함수 추가 |
| `src/features/exam/api/exam-question-feedback.ts` (수정) | 원본 result 반환 함수 추가 |
| `src/features/exam/native-data-bridge.ts` (신규) | 웹뷰 데이터 요청 파싱·검증, 리소스 → API 호출, 응답 주입 코드 생성 |
| `src/screens/feedback/FeedbackScreen.tsx` (수정) | `onMessage`에서 데이터 요청을 브리지로 위임 |
| `src/types/exam.ts` (수정) | 이력 API 원본 타입 추가 |
| `src/features/exam/api/exam-history.ts` (신규) | `GET /api/v1/exams/history` 호출 |
| `src/features/exam/map-exam-history.ts` (신규) | 원본 → 화면 항목 매핑, 만점 상수, 등급 색 |
| `src/screens/feedback/components/ExamHistoryScreen.tsx` (신규, `MockExamHistoryScreen.tsx`에서 이름 변경) | 실제 이력 데이터 렌더, 로딩·오류·빈 상태 |
| `src/screens/feedback/mocks/mock-exam-history.ts` (수정) | 이력 fixture 제거, 재답변 fixture만 유지 |

**웹 (`web-front-end`)**

| 파일 | 책임 |
|---|---|
| `src/lib/native-data-bridge.ts` (신규) | `window.__nativeDataBridge` 설치, 요청 promise 관리, 타임아웃 |
| `src/features/exam/api/exam-grading-result.ts` (수정) | 브리지 경유 조회 후 기존 매퍼 적용 |
| `src/features/exam/api/exam-question-feedback.ts` (수정) | 같음 |

**의존 순서:** Task 1 → 2 (앱 브리지) → 3 → 4 (웹 브리지). Task 5 → 6 (이력)은 1~4와 독립이다.

---

## Task 1: 네이티브 데이터 브리지 모듈 (앱)

**Files:**
- Modify: `/Users/s0107/soma/app-front-end/src/features/exam/api/exam-grading-summary.ts`
- Modify: `/Users/s0107/soma/app-front-end/src/features/exam/api/exam-question-feedback.ts`
- Create: `/Users/s0107/soma/app-front-end/src/features/exam/native-data-bridge.ts`

**Interfaces:**
- Consumes: 기존 `apiFetchWithAuthRetry`(`@/lib/api/client`), `ApiError`(같은 모듈에서 re-export됨).
- Produces:
  - `getRawExamGradingSummary(examId: string): Promise<RawExamSummaryResult>`
  - `getRawExamQuestionFeedback(examId: string, questionNumber: number, retryCount: number): Promise<RawExamQuestionDetailResult>`
  - `type NativeDataRequest`
  - `parseNativeDataRequest(rawMessage: string, currentExamId: string): NativeDataRequest | null`
  - `resolveNativeDataRequest(request: NativeDataRequest): Promise<unknown>`
  - `buildNativeDataScript(payload: NativeDataResponse): string`
  - `type NativeDataResponse`

- [ ] **Step 1: 원본 result를 돌려주는 조회 함수 추가 (summary)**

`src/features/exam/api/exam-grading-summary.ts`의 기존 `getExamGradingResult`는 그대로 두고, 파일 끝에 추가한다:

```ts
/**
 * 웹뷰 브리지 전용 — 앱 도메인 타입으로 매핑하지 않고 서버 원본 result를 그대로 돌려준다.
 *
 * 웹은 자신의 매퍼와 렌더 타입을 따로 갖고 있다. 앱이 매핑해서 넘기면 두 도메인 타입이
 * 영원히 동기화돼야 하므로, 앱은 인증만 책임지고 매핑은 웹에 맡긴다.
 */
export async function getRawExamGradingSummary(
  examId: string,
): Promise<RawExamSummaryResult> {
  const { result } = await apiFetchWithAuthRetry<ApiEnvelope<RawExamSummaryResult>>(
    gradingSummaryPath(examId),
  );
  return result;
}
```

- [ ] **Step 2: 원본 result를 돌려주는 조회 함수 추가 (question feedback)**

`src/features/exam/api/exam-question-feedback.ts` 파일 끝에 추가한다:

```ts
/**
 * 웹뷰 브리지 전용 — 앱 도메인 타입으로 매핑하지 않고 서버 원본 result를 그대로 돌려준다.
 * 이유는 getRawExamGradingSummary 참고.
 */
export async function getRawExamQuestionFeedback(
  examId: string,
  questionNumber: number,
  retryCount: number,
): Promise<RawExamQuestionDetailResult> {
  const { result } = await apiFetchWithAuthRetry<
    ApiEnvelope<RawExamQuestionDetailResult>
  >(
    `/api/v1/exams/${examId}/questions?questionNumber=${questionNumber}&retryCount=${retryCount}`,
  );
  return result;
}
```

- [ ] **Step 3: 브리지 모듈 작성**

`src/features/exam/native-data-bridge.ts`를 새로 만든다:

```ts
import { getRawExamGradingSummary } from "@/features/exam/api/exam-grading-summary";
import { getRawExamQuestionFeedback } from "@/features/exam/api/exam-question-feedback";

/**
 * 웹 피드백 화면이 데이터를 요청할 때 쓰는 메시지.
 *
 * 웹에 액세스 토큰을 넘기지 않기 위해, 인증이 필요한 조회는 전부 네이티브가 대신한다.
 * 웹은 "무엇이 필요한지"만 말하고 경로나 헤더를 만들지 않는다.
 *
 * 계약: `window.ReactNativeWebView.postMessage(JSON.stringify({
 *   type: "NATIVE_DATA_REQUEST", requestId, resource, params }))`.
 */
const REQUEST_TYPE = "NATIVE_DATA_REQUEST";

const FALLBACK_ERROR_MESSAGE = "데이터를 불러오지 못했어요.";

export type NativeDataRequest =
  | { requestId: string; resource: "EXAM_SUMMARY"; examId: string }
  | {
      requestId: string;
      resource: "QUESTION_FEEDBACK";
      examId: string;
      questionNumber: number;
      retryCount: number;
    };

export type NativeDataResponse =
  | { requestId: string; ok: true; result: unknown }
  | { requestId: string; ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * 웹뷰 메시지를 데이터 요청으로 해석한다. 계약에 맞지 않으면 null을 돌려준다.
 *
 * 임의 경로 프록시를 제공하지 않는 것이 이 함수의 핵심이다 — 알려진 resource 이름과
 * 검증된 파라미터로만 경로를 조립한다. 웹이 원하는 주소를 인증된 상태로 부르게 해 주면
 * 토큰을 웹에 넘기지 않아 얻은 이득이 사라진다.
 *
 * `currentExamId`와 다른 시험의 요청도 거른다(parseReanswerRequest와 같은 이유).
 */
export function parseNativeDataRequest(
  rawMessage: string,
  currentExamId: string,
): NativeDataRequest | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawMessage);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  if (parsed.type !== REQUEST_TYPE) return null;

  // 좁히기는 반드시 구조 분해 뒤에 한다 — parsed.params를 먼저 좁혀도
  // 구조 분해로 만든 새 바인딩은 다시 unknown이 된다.
  const { requestId, resource, params } = parsed;

  if (!isNonEmptyString(requestId)) return null;
  if (!isRecord(params)) return null;

  const { examId } = params;
  if (!isNonEmptyString(examId)) return null;
  if (examId !== currentExamId) return null;

  if (resource === "EXAM_SUMMARY") {
    return { requestId, resource, examId };
  }

  if (resource === "QUESTION_FEEDBACK") {
    const { questionNumber, retryCount } = params;
    if (!isPositiveInteger(questionNumber)) return null;
    if (!isNonNegativeInteger(retryCount)) return null;
    return { requestId, resource, examId, questionNumber, retryCount };
  }

  return null;
}

/** 요청된 리소스를 인증된 상태로 조회해 서버 원본 result를 돌려준다. */
export function resolveNativeDataRequest(
  request: NativeDataRequest,
): Promise<unknown> {
  switch (request.resource) {
    case "EXAM_SUMMARY":
      return getRawExamGradingSummary(request.examId);
    case "QUESTION_FEEDBACK":
      return getRawExamQuestionFeedback(
        request.examId,
        request.questionNumber,
        request.retryCount,
      );
  }
}

/**
 * 응답을 웹뷰에 주입할 JS 코드로 만든다.
 *
 * 페이로드를 객체 리터럴로 이어붙이지 않고 JS 문자열 리터럴로 심은 뒤 웹에서 파싱한다 —
 * 피드백 본문에 들어 있는 따옴표나 개행이 주입 코드를 깨뜨리지 않게 하기 위해서다.
 * 바깥 JSON.stringify가 안쪽 JSON 문자열을 안전한 리터럴로 감싼다.
 *
 * 끝의 `true;`는 iOS에서 주입 결과 평가 경고를 피하기 위한 관례다.
 */
export function buildNativeDataScript(payload: NativeDataResponse): string {
  const serialized = JSON.stringify(JSON.stringify(payload));
  return `window.__nativeDataBridge && window.__nativeDataBridge.deliver(${serialized}); true;`;
}

/** 조회 실패를 사용자에게 보여줄 수 있는 문구로 바꾼다. */
export function toNativeDataErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : FALLBACK_ERROR_MESSAGE;
}
```

- [ ] **Step 4: 린트와 타입 검사**

```bash
cd /Users/s0107/soma/app-front-end && pnpm lint && pnpm exec tsc --noEmit
```

Expected: 두 명령 모두 오류 없이 종료(exit code 0).

- [ ] **Step 5: 파싱 계약을 수동으로 확인**

`parseNativeDataRequest`는 순수 함수이므로 Node로 직접 확인한다. 저장소에 테스트 러너가 없으므로 이 확인은 일회성이며 커밋하지 않는다.

```bash
cd /Users/s0107/soma/app-front-end && pnpm exec tsx --eval '
import { parseNativeDataRequest, buildNativeDataScript } from "./src/features/exam/native-data-bridge";
const ok = JSON.stringify({ type: "NATIVE_DATA_REQUEST", requestId: "r1", resource: "EXAM_SUMMARY", params: { examId: "ex_005" } });
console.log("valid summary:", parseNativeDataRequest(ok, "ex_005"));
console.log("wrong exam:", parseNativeDataRequest(ok, "ex_001"));
console.log("garbage:", parseNativeDataRequest("not json", "ex_005"));
console.log("unknown resource:", parseNativeDataRequest(JSON.stringify({ type: "NATIVE_DATA_REQUEST", requestId: "r2", resource: "ANYTHING", params: { examId: "ex_005" } }), "ex_005"));
console.log("escaping:", buildNativeDataScript({ requestId: "r1", ok: true, result: { text: "따옴표 \" 와 줄바꿈 \n 포함" } }));
'
```

Expected:
- `valid summary:` 객체가 출력된다
- `wrong exam:`, `garbage:`, `unknown resource:` 는 모두 `null`
- `escaping:` 출력의 따옴표와 개행이 이스케이프된 상태로 한 줄에 들어 있다

`tsx`가 없으면 이 단계는 건너뛰고 Task 2의 실기기 확인으로 대체한다. 이를 위해 새 의존성을 설치하지 않는다.

- [ ] **Step 6: 커밋**

```bash
cd /Users/s0107/soma/app-front-end && git add src/features/exam/native-data-bridge.ts src/features/exam/api/exam-grading-summary.ts src/features/exam/api/exam-question-feedback.ts && git commit -m "feat(feedback): 웹뷰 데이터 요청을 인증된 네이티브 조회로 중계하는 브리지 추가"
```

---

## Task 2: FeedbackScreen에 브리지 연결 (앱)

**Files:**
- Modify: `/Users/s0107/soma/app-front-end/src/screens/feedback/FeedbackScreen.tsx`

**Interfaces:**
- Consumes: Task 1의 `parseNativeDataRequest`, `resolveNativeDataRequest`, `buildNativeDataScript`, `toNativeDataErrorMessage`, `type NativeDataRequest`.
- Produces: 없음(화면 내부 동작).

- [ ] **Step 1: import 추가**

`FeedbackScreen.tsx`의 기존 import 블록에서 `@/features/exam/go-home-message` 아래에 추가한다:

```ts
import {
  buildNativeDataScript,
  parseNativeDataRequest,
  resolveNativeDataRequest,
  toNativeDataErrorMessage,
  type NativeDataRequest,
} from "@/features/exam/native-data-bridge";
```

- [ ] **Step 2: 데이터 요청 처리 함수 추가**

`handleWebViewMessage` 정의 **바로 위**에 추가한다:

```ts
  /**
   * 웹이 요청한 데이터를 네이티브가 인증된 상태로 조회해 돌려준다.
   *
   * 실패도 반드시 응답한다 — 응답하지 않으면 웹의 대기 promise가 타임아웃까지 남고
   * 사용자는 그 시간 동안 로딩만 보게 된다.
   */
  const deliverNativeData = useCallback(async (request: NativeDataRequest) => {
    try {
      const result = await resolveNativeDataRequest(request);
      webViewRef.current?.injectJavaScript(
        buildNativeDataScript({ requestId: request.requestId, ok: true, result }),
      );
    } catch (error) {
      webViewRef.current?.injectJavaScript(
        buildNativeDataScript({
          requestId: request.requestId,
          ok: false,
          message: toNativeDataErrorMessage(error),
        }),
      );
    }
  }, []);
```

- [ ] **Step 3: 메시지 핸들러에 분기 추가**

`handleWebViewMessage` 안에서 `if (!examId) return;` **바로 다음 줄**에 추가한다(재답변 파싱보다 앞):

```ts
      const dataRequest = parseNativeDataRequest(event.nativeEvent.data, examId);
      if (dataRequest) {
        void deliverNativeData(dataRequest);
        return;
      }
```

그리고 `handleWebViewMessage`의 `useCallback` 의존성 배열을 `[examId, navigation]`에서 다음으로 바꾼다:

```ts
    [deliverNativeData, examId, navigation],
```

- [ ] **Step 4: 린트와 타입 검사**

```bash
cd /Users/s0107/soma/app-front-end && pnpm lint && pnpm exec tsc --noEmit
```

Expected: 두 명령 모두 오류 없이 종료.

- [ ] **Step 5: 커밋**

```bash
cd /Users/s0107/soma/app-front-end && git add src/screens/feedback/FeedbackScreen.tsx && git commit -m "feat(feedback): 피드백 웹뷰의 데이터 요청을 네이티브 조회로 응답"
```

이 시점에서는 웹이 아직 요청을 보내지 않으므로 화면 동작은 그대로다. Task 4까지 끝나야 실제로 연결된다.

---

## Task 3: 웹 데이터 브리지 모듈

**Files:**
- Create: `/Users/s0107/soma/web-front-end/src/lib/native-data-bridge.ts`

**Interfaces:**
- Consumes: `window.ReactNativeWebView`(기존 `src/lib/native-bridge.ts`가 `declare global`로 선언).
- Produces:
  - `isNativeBridgeAvailable(): boolean`
  - `requestFromNative<T>(resource: NativeDataResource, params: Record<string, string | number>): Promise<T>`
  - `type NativeDataResource = "EXAM_SUMMARY" | "QUESTION_FEEDBACK"`

- [ ] **Step 1: 브리지 모듈 작성**

`src/lib/native-data-bridge.ts`를 새로 만든다:

```ts
/**
 * 앱 웹뷰에서 인증이 필요한 데이터를 네이티브를 통해 받아오는 통로.
 *
 * 이 페이지들은 앱 WebView 안에서만 열리고, 앱은 액세스 토큰을 웹으로 넘기지 않는다.
 * 대신 네이티브가 자신의 토큰으로 API를 호출해 서버 원본 result를 돌려준다.
 * 매핑은 웹이 계속 소유하므로 여기서는 원본을 그대로 반환한다.
 *
 * 계약은 app-front-end의 `src/features/exam/native-data-bridge.ts`가 함께 정의한다.
 */
const REQUEST_TYPE = "NATIVE_DATA_REQUEST";

/**
 * 네이티브의 API 타임아웃(10초)보다 넉넉하게 잡는다.
 * 웹이 먼저 포기하면 정상 응답이 버려진 뒤에 도착한다.
 */
const RESPONSE_TIMEOUT_MS = 15_000;

export type NativeDataResource = "EXAM_SUMMARY" | "QUESTION_FEEDBACK";

type PendingRequest = {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

declare global {
  interface Window {
    __nativeDataBridge?: {
      deliver(rawPayload: string): void;
    };
  }
}

const pendingRequests = new Map<string, PendingRequest>();
let requestSequence = 0;

function settle(requestId: string): PendingRequest | undefined {
  const pending = pendingRequests.get(requestId);
  if (!pending) return undefined;
  clearTimeout(pending.timeoutId);
  pendingRequests.delete(requestId);
  return pending;
}

/**
 * 네이티브가 injectJavaScript로 호출하는 진입점.
 *
 * 페이로드는 객체가 아니라 JSON 문자열로 온다 — 주입 코드가 깨지지 않도록
 * 네이티브가 문자열 리터럴로 감싸서 보내기 때문이다.
 */
function installBridge(): void {
  if (typeof window === "undefined") return;
  if (window.__nativeDataBridge) return;

  window.__nativeDataBridge = {
    deliver(rawPayload: string) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawPayload);
      } catch {
        return;
      }
      if (typeof parsed !== "object" || parsed === null) return;

      const payload = parsed as Record<string, unknown>;
      const requestId = payload.requestId;
      if (typeof requestId !== "string") return;

      const pending = settle(requestId);
      if (!pending) return;

      if (payload.ok === true) {
        pending.resolve(payload.result);
        return;
      }

      const message =
        typeof payload.message === "string" && payload.message.length > 0
          ? payload.message
          : "데이터를 불러오지 못했어요.";
      pending.reject(new Error(message));
    },
  };
}

/** 앱 웹뷰 안에서 열렸는지 판별한다. 브라우저 단독 접근이면 false다. */
export function isNativeBridgeAvailable(): boolean {
  return typeof window !== "undefined" && Boolean(window.ReactNativeWebView);
}

/** 네이티브에 데이터를 요청하고 서버 원본 result를 받는다. */
export function requestFromNative<T>(
  resource: NativeDataResource,
  params: Record<string, string | number>,
): Promise<T> {
  installBridge();

  if (!isNativeBridgeAvailable()) {
    return Promise.reject(new Error("앱 웹뷰 안에서만 데이터를 받을 수 있어요."));
  }

  requestSequence += 1;
  const requestId = `${Date.now()}-${requestSequence}`;

  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error("데이터를 받는 데 너무 오래 걸렸어요."));
    }, RESPONSE_TIMEOUT_MS);

    pendingRequests.set(requestId, {
      resolve: resolve as (result: unknown) => void,
      reject,
      timeoutId,
    });

    window.ReactNativeWebView?.postMessage(
      JSON.stringify({ type: REQUEST_TYPE, requestId, resource, params }),
    );
  });
}
```

- [ ] **Step 2: 린트와 타입 검사**

```bash
cd /Users/s0107/soma/web-front-end && pnpm lint && pnpm exec tsc --noEmit
```

Expected: 두 명령 모두 오류 없이 종료.

- [ ] **Step 3: 커밋**

```bash
cd /Users/s0107/soma/web-front-end && git add src/lib/native-data-bridge.ts && git commit -m "feat(app-webview): 인증 데이터를 네이티브에서 받아오는 브리지 추가"
```

---

## Task 4: 웹 피드백 조회를 브리지 경유로 전환

**Files:**
- Modify: `/Users/s0107/soma/web-front-end/src/features/exam/api/exam-grading-result.ts`
- Modify: `/Users/s0107/soma/web-front-end/src/features/exam/api/exam-question-feedback.ts`

**Interfaces:**
- Consumes: Task 3의 `isNativeBridgeAvailable`, `requestFromNative`.
- Produces: 기존 `getExamGradingResult`, `getExamQuestionFeedback`의 **시그니처와 반환 타입은 그대로**다. 호출하는 페이지 컴포넌트는 수정하지 않는다.

- [ ] **Step 1: 종합 피드백 조회 전환**

`src/features/exam/api/exam-grading-result.ts` 전체를 다음으로 바꾼다:

```ts
import { mapExamGradingResult } from "@/features/exam/map-exam-grading-result";
import { apiFetch } from "@/lib/api/client";
import {
  isNativeBridgeAvailable,
  requestFromNative,
} from "@/lib/native-data-bridge";
import type { ApiEnvelope } from "@/types/api";
import type { ExamGradingResult, RawExamSummaryResult } from "@/types/exam";

/**
 * AI 채점 결과 및 피드백을 조회한다.
 *
 * 앱 웹뷰 안에서는 네이티브가 인증된 상태로 대신 호출한다 — 이 페이지에는 토큰이 없다.
 * 직접 호출 경로는 브라우저 로컬 개발용이며, 인증이 필요한 서버는 이를 거부한다.
 */
export async function getExamGradingResult(
  examId: string,
): Promise<ExamGradingResult> {
  if (isNativeBridgeAvailable()) {
    const result = await requestFromNative<RawExamSummaryResult>("EXAM_SUMMARY", {
      examId,
    });
    return mapExamGradingResult(result);
  }

  const { result } = await apiFetch<ApiEnvelope<RawExamSummaryResult>>(
    `/api/v1/exams/${examId}/summary`,
  );
  return mapExamGradingResult(result);
}
```

- [ ] **Step 2: 문제별 피드백 조회 전환**

`src/features/exam/api/exam-question-feedback.ts` 전체를 다음으로 바꾼다:

```ts
import { mapExamQuestionDetail } from "@/features/exam/map-exam-question-feedback";
import { apiFetch } from "@/lib/api/client";
import {
  isNativeBridgeAvailable,
  requestFromNative,
} from "@/lib/native-data-bridge";
import type { ApiEnvelope } from "@/types/api";
import type { ExamQuestionDetail, RawExamQuestionDetailResult } from "@/types/exam";

/**
 * 특정 문제의 특정 회차 채점 결과 및 상세 피드백을 조회한다.
 * 최초 응시는 retryCount=0.
 *
 * 앱 웹뷰 안에서는 네이티브가 인증된 상태로 대신 호출한다 — 이 페이지에는 토큰이 없다.
 * 직접 호출 경로는 브라우저 로컬 개발용이며, 인증이 필요한 서버는 이를 거부한다.
 */
export async function getExamQuestionFeedback(
  examId: string,
  questionNumber: number,
  retryCount: number,
): Promise<ExamQuestionDetail> {
  if (isNativeBridgeAvailable()) {
    const result = await requestFromNative<RawExamQuestionDetailResult>(
      "QUESTION_FEEDBACK",
      { examId, questionNumber, retryCount },
    );
    return mapExamQuestionDetail(result);
  }

  const { result } = await apiFetch<ApiEnvelope<RawExamQuestionDetailResult>>(
    `/api/v1/exams/${examId}/questions?questionNumber=${questionNumber}&retryCount=${retryCount}`,
  );
  return mapExamQuestionDetail(result);
}
```

- [ ] **Step 3: 린트와 타입 검사**

```bash
cd /Users/s0107/soma/web-front-end && pnpm lint && pnpm exec tsc --noEmit
```

Expected: 두 명령 모두 오류 없이 종료.

- [ ] **Step 4: 웹을 빌드해 회귀 확인**

```bash
cd /Users/s0107/soma/web-front-end && pnpm build
```

Expected: 빌드 성공. `/app-exam-screen`, `/app-question-feedback` 라우트가 결과에 포함된다.

- [ ] **Step 5: 커밋**

```bash
cd /Users/s0107/soma/web-front-end && git add src/features/exam/api/exam-grading-result.ts src/features/exam/api/exam-question-feedback.ts && git commit -m "feat(app-webview): 피드백 조회를 네이티브 브리지 경유로 전환"
```

- [ ] **Step 6: 두 저장소를 함께 실기기에서 확인**

웹을 앱이 가리키는 `EXPO_PUBLIC_WEB_BASE_URL`에 배포한 뒤(또는 로컬 웹 dev 서버를 그 값으로 지정한 뒤) 앱을 실행한다.

```bash
cd /Users/s0107/soma/app-front-end && pnpm ios
```

확인 항목:
1. 피드백 탭에서 완료된 시험을 열면 종합 피드백이 정상 렌더된다.
2. 문제별 피드백에서 회차 칩을 바꾸면 해당 회차 데이터로 갱신된다.
3. 기기를 비행기 모드로 두고 열면 웹의 오류 폴백이 뜨고, 재시도 버튼이 동작한다.
4. **웹 콘솔에 액세스 토큰이 전혀 나타나지 않는다** — Safari 웹 인스펙터로 웹뷰에 붙어 `window.localStorage`, `window.sessionStorage`, `document.cookie`가 토큰을 담고 있지 않은지 확인한다.

---

## Task 5: 모의고사 이력 타입·조회·매퍼 (앱)

**Files:**
- Modify: `/Users/s0107/soma/app-front-end/src/types/exam.ts`
- Create: `/Users/s0107/soma/app-front-end/src/features/exam/api/exam-history.ts`
- Create: `/Users/s0107/soma/app-front-end/src/features/exam/map-exam-history.ts`

**Interfaces:**
- Consumes: `apiFetchWithAuthRetry`(`@/lib/api/client`), `ApiEnvelope`(`@/types/api`).
- Produces:
  - `interface RawExamHistoryItem`, `interface RawExamHistoryResult` (`@/types/exam`)
  - `getExamHistory(signal?: AbortSignal): Promise<ExamHistoryItem[]>`
  - `type ExamHistoryItem`, `type ExamHistoryTone`
  - `EXAM_TOTAL_MAX_SCORE: 200`
  - `mapExamHistory(raw: RawExamHistoryResult): ExamHistoryItem[]`
  - `averageTotalScore(items: readonly ExamHistoryItem[]): number`

- [ ] **Step 1: 원본 타입 추가**

`src/types/exam.ts`의 `RawExamSummaryResult` 정의 **바로 앞**에 추가한다:

```ts
/**
 * GET /api/v1/exams/history 의 result.histories 항목.
 *
 * 서버는 시험 총점의 만점(maxScore)을 내려주지 않는다 — 화면은 map-exam-history.ts의
 * EXAM_TOTAL_MAX_SCORE를 단일 출처로 쓴다.
 * `summaryAvailable=false`는 완료됐지만 종합 결과가 없는 시험이다.
 */
export interface RawExamHistoryItem {
  examId: string;
  title: string;
  cycleNumber: number;
  completedAt: string;
  totalScore: number;
  levelEstimate: string;
  summaryAvailable: boolean;
}

/** GET /api/v1/exams/history 의 result */
export interface RawExamHistoryResult {
  totalCount: number;
  histories: RawExamHistoryItem[];
}
```

- [ ] **Step 2: 매퍼 작성**

`src/features/exam/map-exam-history.ts`를 새로 만든다:

```ts
import type { RawExamHistoryResult } from "@/types/exam";

/**
 * 시험 총점의 만점.
 *
 * 이력 API는 만점을 내려주지 않으므로 TOEIC Speaking 총점을 앱이 상수로 갖는다.
 * 화면 문구("/200점")와 추이 차트 척도가 모두 이 값을 쓴다.
 */
export const EXAM_TOTAL_MAX_SCORE = 200;

export type ExamHistoryTone = "green" | "blue" | "purple" | "orange";

export type ExamHistoryItem = {
  examId: string;
  title: string;
  completedAt: string;
  chartDateLabel: string;
  level: string;
  totalScore: number;
  maxTotalScore: number;
  /** false면 종합 피드백이 없어 카드를 열 수 없다. */
  summaryAvailable: boolean;
  tone: ExamHistoryTone;
};

/** 응답 형식이 계약과 다를 때 던진다. 빈 목록으로 바꾸지 않는다. */
export class ExamHistoryContractError extends Error {
  constructor() {
    super("시험 이력 응답 형식이 올바르지 않습니다.");
    this.name = "ExamHistoryContractError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function chartDateLabel(completedAt: string): string {
  const date = new Date(completedAt);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 등급 배지 색.
 *
 * 색만으로 등급을 전달하지 않는다 — 배지에는 항상 등급 문자를 함께 표시한다.
 * 알 수 없는 등급은 원문을 보존하고 기본 색을 쓴다.
 */
function toneForLevel(level: string): ExamHistoryTone {
  const normalizedLevel = level.trim().toUpperCase();
  if (["AH", "AM", "AL"].includes(normalizedLevel)) return "purple";
  if (normalizedLevel === "IH") return "blue";
  if (["IM3", "IM2", "IM1"].includes(normalizedLevel)) return "green";
  return "orange";
}

/**
 * 검증과 매핑을 한 함수에서 한다.
 *
 * 검증만 하고 캐스트로 타입을 붙이면 검증하지 않은 필드가 조용히 통과한다.
 * 검증된 지역 변수로 결과를 직접 조립해 캐스트를 쓰지 않는다.
 */
function mapItem(value: unknown): ExamHistoryItem {
  if (!isRecord(value)) {
    throw new ExamHistoryContractError();
  }

  const { examId, title, completedAt, totalScore, levelEstimate, summaryAvailable } =
    value;

  if (
    !isNonEmptyString(examId) ||
    typeof title !== "string" ||
    !isNonEmptyString(completedAt) ||
    !isFiniteNumber(totalScore) ||
    typeof levelEstimate !== "string" ||
    typeof summaryAvailable !== "boolean"
  ) {
    throw new ExamHistoryContractError();
  }

  return {
    examId,
    title,
    completedAt,
    chartDateLabel: chartDateLabel(completedAt),
    level: levelEstimate,
    totalScore,
    maxTotalScore: EXAM_TOTAL_MAX_SCORE,
    summaryAvailable,
    tone: toneForLevel(levelEstimate),
  };
}

/** 최신순으로 정렬된 이력 항목을 만든다. 서버 정렬을 신뢰하지 않고 다시 정렬한다. */
export function mapExamHistory(raw: RawExamHistoryResult): ExamHistoryItem[] {
  if (!isRecord(raw) || !Array.isArray(raw.histories)) {
    throw new ExamHistoryContractError();
  }

  return raw.histories
    .map((item) => mapItem(item))
    .sort(
      (left, right) =>
        new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime(),
    );
}

/** 총점 평균. 항목이 없으면 0이다. */
export function averageTotalScore(items: readonly ExamHistoryItem[]): number {
  if (items.length === 0) return 0;
  return items.reduce((sum, item) => sum + item.totalScore, 0) / items.length;
}
```

- [ ] **Step 3: 조회 함수 작성**

`src/features/exam/api/exam-history.ts`를 새로 만든다:

```ts
import {
  mapExamHistory,
  type ExamHistoryItem,
} from "@/features/exam/map-exam-history";
import { apiFetchWithAuthRetry } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type { RawExamHistoryResult } from "@/types/exam";

/**
 * 현재 사용자의 완료 모의고사 이력을 조회한다.
 *
 * 서버는 completedAt이 기록된 완료 시험만 내려주며, 종합 결과가 없는 시험
 * (summaryAvailable=false)도 포함한다. 페이지네이션은 아직 제공되지 않는다.
 */
export async function getExamHistory(
  signal?: AbortSignal,
): Promise<ExamHistoryItem[]> {
  const { result } = await apiFetchWithAuthRetry<ApiEnvelope<RawExamHistoryResult>>(
    "/api/v1/exams/history",
    { signal },
  );
  return mapExamHistory(result);
}
```

- [ ] **Step 4: 린트와 타입 검사**

```bash
cd /Users/s0107/soma/app-front-end && pnpm lint && pnpm exec tsc --noEmit
```

Expected: 두 명령 모두 오류 없이 종료.

- [ ] **Step 5: 커밋**

```bash
cd /Users/s0107/soma/app-front-end && git add src/types/exam.ts src/features/exam/map-exam-history.ts src/features/exam/api/exam-history.ts && git commit -m "feat(feedback): 모의고사 이력 조회 API와 매퍼 추가"
```

---

## Task 6: 모의고사 기록 탭을 실제 데이터로 전환 (앱)

**Files:**
- Create: `/Users/s0107/soma/app-front-end/src/screens/feedback/components/ExamHistoryScreen.tsx` (기존 `MockExamHistoryScreen.tsx`를 `git mv`로 이름 변경 후 수정)
- Delete: `/Users/s0107/soma/app-front-end/src/screens/feedback/components/MockExamHistoryScreen.tsx`
- Modify: `/Users/s0107/soma/app-front-end/src/screens/feedback/mocks/mock-exam-history.ts`
- Modify: `/Users/s0107/soma/app-front-end/src/screens/feedback/FeedbackScreen.tsx`

**Interfaces:**
- Consumes: Task 5의 `getExamHistory`, `averageTotalScore`, `EXAM_TOTAL_MAX_SCORE`, `type ExamHistoryItem`, `type ExamHistoryTone`.
- Produces: `ExamHistoryScreen` 컴포넌트. props는 기존과 같은 `{ onOpenExam: (examId: string) => void }`.

- [ ] **Step 1: 파일 이름 변경**

```bash
cd /Users/s0107/soma/app-front-end && git mv src/screens/feedback/components/MockExamHistoryScreen.tsx src/screens/feedback/components/ExamHistoryScreen.tsx
```

`Mock` 접두사는 fixture로 그린다는 뜻이었다. 실제 데이터를 쓰기 시작하면 오해를 부르므로 함께 바꾼다.

- [ ] **Step 2: 이력 fixture 제거**

`src/screens/feedback/mocks/mock-exam-history.ts`에서 다음을 **삭제**한다. 재답변 탭은 계속 fixture를 쓰므로 나머지는 그대로 둔다.

- `MockExamHistoryTone` 타입
- `MockExamHistoryResponse` 타입
- `MOCK_EXAM_HISTORY_RESPONSE` 상수
- `MockExamHistoryItem` 타입
- `chartDateLabel` 함수
- `toneForLevel` 함수
- `MOCK_EXAM_HISTORY` 상수
- `MOCK_EXAM_AVERAGE_TOTAL_SCORE` 상수
- `MOCK_EXAM_MAX_TOTAL_SCORE` 상수

파일 맨 위에 남는 fixture의 범위를 밝히는 주석을 둔다:

```ts
/**
 * 재답변 성과 탭 fixture.
 *
 * 모의고사 이력은 실제 API(GET /api/v1/exams/history)로 옮겼다. 재답변은 서버의
 * GET /api/v1/exams/{examId}/retries 가 회차별 점수를 내려주지 않아 아직 계산할 수
 * 없으므로 fixture를 유지한다. 필요한 필드는 설계 문서
 * docs/superpowers/specs/2026-08-05-webview-data-bridge-and-exam-history-design.md 참고.
 */
```

- [ ] **Step 3: 화면의 import와 타입 참조 교체**

`ExamHistoryScreen.tsx`의 mock import 블록을 다음으로 바꾼다:

```ts
import { getExamHistory } from "@/features/exam/api/exam-history";
import {
  EXAM_TOTAL_MAX_SCORE,
  averageTotalScore,
  type ExamHistoryItem,
  type ExamHistoryTone,
} from "@/features/exam/map-exam-history";
import {
  MOCK_REANSWER_PROGRESS,
  MOCK_REANSWER_QUESTIONS,
  type MockReanswerQuestionItem,
} from "@/screens/feedback/mocks/mock-exam-history";
```

그리고 파일 안의 이름을 모두 바꾼다. 뒤 단계의 코드가 새 이름을 쓰므로 여기서 함께 끝낸다.

- `MockExamHistoryTone` → `ExamHistoryTone` (`badgeColors`의 `Record` 키)
- `MockExamHistoryItem` → `ExamHistoryItem` (`ScoreTrendChart`, `ExamHistoryCard`의 props)
- `MockExamHistoryScreenProps` → `ExamHistoryScreenProps`
- `export function MockExamHistoryScreen` → `export function ExamHistoryScreen`

- [ ] **Step 4: 카드 부제에서 재답변 문항 수 제거**

`ExamHistoryCard` 안의 `subtitle` 계산을 다음으로 바꾼다. 이력 API에 `retriedQuestionCount`가 없고, 시험마다 `/retries`를 부르면 N+1 요청이 된다.

```ts
  const badgeColor = badgeColors[item.tone];
  const subtitle = formatCompletedDate(item.completedAt);
```

- [ ] **Step 5: 종합 결과가 없는 시험은 열 수 없게 한다**

`ExamHistoryCard`의 `Pressable`을 다음으로 바꾼다. `summaryAvailable=false`인 카드를 누르면 피드백 웹뷰가 빈 데이터로 실패한다.

```ts
  return (
    <Pressable
      accessibilityLabel={`${item.title}, ${item.level}, 총점 ${item.maxTotalScore}점 만점에 ${item.totalScore}점, ${subtitle}`}
      accessibilityHint={
        item.summaryAvailable
          ? "이 모의고사의 피드백을 엽니다"
          : "채점 결과가 아직 없어 열 수 없어요"
      }
      accessibilityState={{ disabled: !item.summaryAvailable }}
      disabled={!item.summaryAvailable}
      className={`flex-row items-center rounded-3xl border border-line bg-surface p-4 ${
        item.summaryAvailable ? "" : "opacity-50"
      }`}
      style={shadows.card}
      onPress={onPress}
    >
```

- [ ] **Step 6: 이력 조회 상태를 화면에 연결**

`ExamHistoryPanel`을 다음으로 바꾼다. 앱에는 `QueryClientProvider`가 없고 `useQuery` 사용처도 없으므로 기존 화면들과 같은 `useState`/`useEffect` 패턴을 쓴다.

```tsx
type ExamHistoryState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: readonly ExamHistoryItem[] };

function ExamHistoryPanel({ onOpenExam }: ExamHistoryScreenProps) {
  const [state, setState] = useState<ExamHistoryState>({ status: "loading" });
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });

    getExamHistory(controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return;
        setState({ status: "ready", items });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setState({ status: "error" });
      });

    return () => controller.abort();
  }, [reloadNonce]);

  if (state.status === "loading") {
    return (
      <View className="mt-16 items-center">
        <ActivityIndicator color={colors.brand.DEFAULT} size="large" />
      </View>
    );
  }

  // 조회 실패를 빈 상태로 바꾸지 않는다 — 기록이 정말 없는 경우와 구분해야 한다.
  if (state.status === "error") {
    return (
      <View className="mt-16 items-center px-6">
        <Text className="text-center text-lg">기록을 불러오지 못했어요</Text>
        <Text className="mt-2 text-center text-sm leading-6 text-ink-muted">
          잠시 후 다시 시도해 주세요.
        </Text>
        <Pressable
          accessibilityLabel="다시 시도"
          className="mt-5 rounded-full border border-brand px-6 py-3"
          onPress={() => setReloadNonce((nonce) => nonce + 1)}
        >
          <Text className="text-base text-brand-text">다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  if (state.items.length === 0) {
    return (
      <View className="mt-16 items-center px-6">
        <Text className="text-center text-lg">아직 모의고사 기록이 없어요</Text>
        <Text className="mt-2 text-center text-sm leading-6 text-ink-muted">
          첫 모의고사를 완료하면 점수 추이가 여기에 쌓여요.
        </Text>
      </View>
    );
  }

  return (
    <>
      <View
        className="mt-5 rounded-3xl border border-line bg-surface p-5"
        style={shadows.card}
      >
        <Text className="text-lg">전체 평균 총점</Text>
        <View className="mt-1 flex-row items-end">
          <Text className="text-3xl text-brand-text">
            {averageTotalScore(state.items).toFixed(1)}
          </Text>
          <Text className="mb-1 ml-1 text-lg text-brand-text">
            /{EXAM_TOTAL_MAX_SCORE}
          </Text>
        </View>
        <ScoreTrendChart items={state.items} />
      </View>

      <View className="mt-4 gap-3">
        {state.items.map((item) => (
          <ExamHistoryCard
            key={item.examId}
            item={item}
            onPress={() => onOpenExam(item.examId)}
          />
        ))}
      </View>
    </>
  );
}
```

`ActivityIndicator`를 `react-native` import에 추가한다.

- [ ] **Step 7: 추이 차트를 최근 5개로 제한**

`ScoreTrendChart` 안의 `chronologicalItems` 계산을 바꾼다. 이력이 쌓이면 점이 겹쳐 읽을 수 없다.

```ts
  // 목록은 최신순이다. 최근 5개만 골라 시간순으로 뒤집는다.
  const chronologicalItems = [...items].slice(0, 5).reverse();
```

- [ ] **Step 8: FeedbackScreen의 import와 사용처 갱신**

`src/screens/feedback/FeedbackScreen.tsx`에서:

```ts
import { ExamHistoryScreen } from "@/screens/feedback/components/ExamHistoryScreen";
```

그리고 렌더 부분을 바꾼다:

```tsx
  if (!examId) {
    return (
      <ExamHistoryScreen
        onOpenExam={(nextExamId) => navigation.setParams({ examId: nextExamId })}
      />
    );
  }
```

- [ ] **Step 9: 린트와 타입 검사**

```bash
cd /Users/s0107/soma/app-front-end && pnpm lint && pnpm exec tsc --noEmit
```

Expected: 두 명령 모두 오류 없이 종료. mock 상수를 지운 뒤 남은 참조가 있으면 여기서 잡힌다.

- [ ] **Step 10: 실기기 확인**

```bash
cd /Users/s0107/soma/app-front-end && pnpm ios
```

확인 항목:
1. 피드백 탭을 examId 없이 열면 모의고사 기록 탭에 실제 이력이 최신순으로 뜬다.
2. 평균 총점과 추이 차트가 실제 점수를 쓰고, 만점 표기가 `/200`이다.
3. 카드를 누르면 해당 시험의 종합 피드백 웹뷰가 열린다.
4. `summaryAvailable=false`인 항목이 있다면 흐리게 표시되고 눌리지 않는다.
5. 기기를 비행기 모드로 두고 탭을 열면 오류와 재시도 버튼이 뜨고, 복구 후 재시도가 동작한다.
6. 이력이 없는 신규 계정에서 빈 상태 문구가 뜬다.
7. "다시 답변한 문제" 탭은 기존 fixture 화면 그대로 동작한다.

- [ ] **Step 11: 커밋**

```bash
cd /Users/s0107/soma/app-front-end && git add -A src/screens/feedback && git commit -m "feat(feedback): 모의고사 기록 탭을 실제 이력 API에 연결"
```

---

## 후속 작업 (이 계획 범위 밖)

백엔드에 다음을 요청해야 "다시 답변한 문제" 탭을 실제 데이터로 옮길 수 있다. 현재
`GET /api/v1/exams/{examId}/retries`의 `RetryAttemptItem`에는 `retryCount`와 `status`만 있다.

- `RetryAttemptItem`에 `score`, `maxScore`, `completedAt` 추가
- 시험 단위가 아닌 사용자 전체 스냅샷 엔드포인트

계산 규칙은 `specs/007-reanswer-progress-banner/contracts/history-api-contract.md`의
"Client calculation contract"가 이미 정의하고 있다.
