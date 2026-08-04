# GO_HOME_REQUESTED 웹뷰 브릿지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/app-exam-screen`, `/app-question-feedback` 웹뷰가 에러 폴백에서 보내는 `GO_HOME_REQUESTED` 메시지를 앱이 받아 네이티브 홈 탭으로 이동시킨다.

**Architecture:** `src/features/exam/reanswer-message.ts`와 동일한 패턴으로 새 파서 모듈 `src/features/exam/go-home-message.ts`를 만들어 `JSON.parse` + `type` 필드 검증을 캡슐화한다. `FeedbackScreen.handleWebViewMessage`(`src/screens/feedback/FeedbackScreen.tsx`)에서 기존 `REANSWER_REQUESTED` 처리보다 먼저 이 검사를 수행하고, 매칭되면 `navigation.navigate("MainTabs", { screen: "Home" })`로 홈 탭으로 전환한다. `FeedbackScreen`은 별도 push/모달이 아니라 "Feedback" 탭 화면 자체이므로 이 한 번의 탭 전환이 "웹뷰 닫기 + 홈 이동"을 동시에 만족한다.

**Tech Stack:** Expo/React Native, TypeScript(strict), React Navigation(bottom-tabs + native-stack), `react-native-webview`.

## Global Constraints

- `pnpm`을 사용한다.
- 이 저장소에는 **자동화된 테스트 러너가 아직 없다**(`AGENTS.md:24`). 각 태스크의 검증은 `pnpm exec tsc --noEmit` / `pnpm lint`와 수동 확인으로 대체하고, "Write the failing test" 스텝은 생략한다.
- 웹으로 응답 메시지를 보내지 않는다(fire-and-forget 계약).
- 커밋 메시지는 한국어로, Conventional Commit 타입+스코프를 소문자 영어로 쓴다(예: `feat(feedback): ...`).
- 설계 문서: `docs/superpowers/specs/2026-08-04-go-home-requested-bridge-design.md`.

---

### Task 1: `GO_HOME_REQUESTED` 파서 모듈 추가

**Files:**
- Create: `src/features/exam/go-home-message.ts`

**Interfaces:**
- Consumes: 없음(순수 함수, 외부 의존성 없음).
- Produces: `isGoHomeRequestedMessage(rawMessage: string): boolean` — Task 2가 `WebViewMessageEvent.nativeEvent.data`를 그대로 이 함수에 넘겨 호출한다.

- [ ] **Step 1: 파서 모듈 작성**

`src/features/exam/go-home-message.ts`:

```ts
/**
 * 웹 에러 폴백 화면의 "홈으로 돌아가기" 버튼이 보내는 메시지.
 *
 * 계약: `window.ReactNativeWebView.postMessage(JSON.stringify({ type: "GO_HOME_REQUESTED" }))`.
 * 추가 필드는 없다. `/app-exam-screen`, `/app-question-feedback` 두 웹뷰 화면에서 공통으로 온다.
 */
const MESSAGE_TYPE = "GO_HOME_REQUESTED";

/**
 * 웹뷰 메시지가 홈 이동 요청인지 판별한다. 계약에 맞지 않으면 false를 돌려주고,
 * 호출부는 화면을 그대로 둔다 — 지원하지 않는 메시지에 오류 화면을 띄우지 않는다.
 */
export function isGoHomeRequestedMessage(rawMessage: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawMessage);
  } catch {
    return false;
  }

  if (typeof parsed !== "object" || parsed === null) return false;

  const { type } = parsed as Record<string, unknown>;

  return type === MESSAGE_TYPE;
}
```

- [ ] **Step 2: 정적 검증**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 없음(새 파일이 strict 모드를 통과).

Run: `pnpm lint`
Expected: `src/features/exam/go-home-message.ts`에 대한 경고/에러 없음.

- [ ] **Step 3: 수동 로직 확인**

아래 표의 입력을 머릿속으로(또는 임시로 파일 맨 아래 `console.log(isGoHomeRequestedMessage(...))`를 붙였다 지워보며) 검증해 함수가 명세대로 동작하는지 확인한다. 확인 후 임시 코드는 남기지 않는다.

| 입력 | 기대 결과 |
| --- | --- |
| `'{"type":"GO_HOME_REQUESTED"}'` | `true` |
| `'{"type":"REANSWER_REQUESTED","examId":"x"}'` | `false` |
| `'not json'` | `false` |
| `'null'` | `false` |
| `'"GO_HOME_REQUESTED"'` (문자열 자체, 객체 아님) | `false` |
| `'[1,2,3]'` (배열, `type` 필드 없음) | `false` |

- [ ] **Step 4: 커밋**

```bash
git add src/features/exam/go-home-message.ts
git commit -m "feat(feedback): GO_HOME_REQUESTED 웹뷰 메시지 파서 추가"
```

---

### Task 2: `FeedbackScreen`에서 홈 이동 처리 연결

**Files:**
- Modify: `src/screens/feedback/FeedbackScreen.tsx:16` (import 추가)
- Modify: `src/screens/feedback/FeedbackScreen.tsx:144-161` (`handleWebViewMessage`)

**Interfaces:**
- Consumes: Task 1의 `isGoHomeRequestedMessage(rawMessage: string): boolean` (from `@/features/exam/go-home-message`).
- Produces: 없음(최종 사용자 동작 변경 — 이 화면을 소비하는 다른 코드는 없다).

- [ ] **Step 1: import 추가**

`src/screens/feedback/FeedbackScreen.tsx:16` 바로 아래 줄에 추가:

```ts
import { isGoHomeRequestedMessage } from "@/features/exam/go-home-message";
```

- [ ] **Step 2: `handleWebViewMessage`에 홈 이동 분기 추가**

`src/screens/feedback/FeedbackScreen.tsx:144-161`의 기존 코드:

```tsx
  const handleWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      if (!examId) return;

      const request = parseReanswerRequest(event.nativeEvent.data, examId);
      // 계약에 맞지 않는 메시지는 조용히 무시하고 지금 화면을 그대로 둔다.
      if (!request) return;
      if (hasOpenedReanswerRef.current) return;

      hasOpenedReanswerRef.current = true;
      navigation.navigate("Reanswer", {
        examId: request.examId,
        questionNumber: request.questionNumber,
        nextRetryCount: request.nextRetryCount,
      });
    },
    [examId, navigation],
  );
```

다음으로 교체한다:

```tsx
  const handleWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      // examId 로딩 실패로 에러 폴백이 뜬 경우에도 동작해야 하므로 examId 가드보다 먼저 검사한다.
      if (isGoHomeRequestedMessage(event.nativeEvent.data)) {
        navigation.navigate("MainTabs", { screen: "Home" });
        return;
      }

      if (!examId) return;

      const request = parseReanswerRequest(event.nativeEvent.data, examId);
      // 계약에 맞지 않는 메시지는 조용히 무시하고 지금 화면을 그대로 둔다.
      if (!request) return;
      if (hasOpenedReanswerRef.current) return;

      hasOpenedReanswerRef.current = true;
      navigation.navigate("Reanswer", {
        examId: request.examId,
        questionNumber: request.questionNumber,
        nextRetryCount: request.nextRetryCount,
      });
    },
    [examId, navigation],
  );
```

- [ ] **Step 3: 정적 검증**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 없음. (`navigation.navigate("MainTabs", { screen: "Home" })`가 `RootStackParamList.MainTabs: NavigatorScreenParams<MainTabParamList>`, `MainTabParamList.Home: undefined`와 타입이 맞는지 여기서 확정된다.)

Run: `pnpm lint`
Expected: 에러 없음.

- [ ] **Step 4: 수동 런타임 확인 (Expo)**

자동 테스트 러너가 없으므로 실제로 앱을 띄워 확인한다.

1. `pnpm start`로 Expo 개발 서버를 띄우고 시뮬레이터/기기에서 앱을 연다.
2. 모의고사를 완료해 종합 피드백(`/app-exam-screen`) 또는 문제별 피드백(`/app-question-feedback`) 웹뷰 화면으로 진입한다(`Feedback` 탭).
3. 개발자 메뉴 등으로 웹뷰가 뜬 상태에서, 아래 방법 중 하나로 메시지를 주입한다:
   - 웹 스테이징 배포에 실제 에러 폴백 + "홈으로 돌아가기" 버튼이 있다면 그 버튼을 탭한다.
   - 없다면 `FeedbackScreen.tsx`의 `webViewRef.current?.injectJavaScript(...)`를 임시로 호출하는 디버그 코드를 붙여 `window.ReactNativeWebView.postMessage(JSON.stringify({ type: "GO_HOME_REQUESTED" }))`를 웹뷰 안에서 실행시킨 뒤, 확인 후 디버그 코드를 제거한다.
4. 탭이 "Home"으로 전환되는지 육안 확인한다.
5. 회귀 확인: 같은 화면에서 재답변 흐름(문제별 피드백 → 재답변 요청)이 여전히 정상 동작하는지 한 번 더 확인한다(이번 변경이 `REANSWER_REQUESTED` 분기 앞에 조건을 하나 추가한 것이므로, `examId`가 있는 정상 케이스에서 `isGoHomeRequestedMessage`가 항상 `false`를 돌려주고 기존 로직으로 흘러가는지가 핵심이다).

- [ ] **Step 5: 커밋**

```bash
git add src/screens/feedback/FeedbackScreen.tsx
git commit -m "feat(feedback): GO_HOME_REQUESTED 수신 시 홈 탭으로 이동"
```
