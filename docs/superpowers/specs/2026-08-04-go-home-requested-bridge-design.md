# 웹뷰 GO_HOME_REQUESTED 메시지 처리 설계

## 배경

`/app-exam-screen`, `/app-question-feedback` 웹뷰에서 서버 에러 시 뜨는 "홈으로 돌아가기" 버튼이 이번 웹 배포부터 웹 내부 이동 대신 `window.ReactNativeWebView.postMessage(JSON.stringify({ type: "GO_HOME_REQUESTED" }))`을 호출하도록 바뀐다. 앱이 이 메시지를 받아 네이티브 홈 탭으로 이동시켜야 한다.

두 웹뷰 경로는 모두 `FeedbackScreen`(`src/screens/feedback/FeedbackScreen.tsx`) 하나가 렌더링하며, 이 화면은 별도로 push/모달된 화면이 아니라 하단 탭 내비게이터의 "Feedback" 탭 그 자체다. 기존에 `REANSWER_REQUESTED` 메시지를 처리 중이며, `src/features/exam/reanswer-message.ts`가 원문 문자열을 `JSON.parse`해 계약을 검증하는 패턴을 이미 갖고 있다.

## 범위

### 포함

1. **새 파서 모듈 `src/features/exam/go-home-message.ts`**: `reanswer-message.ts`와 동일한 패턴으로 `isGoHomeRequestedMessage(rawMessage: string): boolean`을 추가. `JSON.parse` 실패, 객체가 아님, `type !== "GO_HOME_REQUESTED"`인 경우 모두 `false`를 반환한다. `examId` 등 추가 필드는 없으므로 검증하지 않는다.
2. **`FeedbackScreen.handleWebViewMessage` 분기 추가**: 기존 `if (!examId) return;` 가드보다 **먼저** `isGoHomeRequestedMessage` 검사를 수행한다. 에러 폴백 화면은 `examId` 로딩이 실패한 상태에서도 뜰 수 있으므로, `examId` 유무와 무관하게 동작해야 한다. 매칭되면 `navigation.navigate("MainTabs", { screen: "Home" })`을 호출하고 즉시 `return`한다 — `REANSWER_REQUESTED` 로직에는 도달하지 않는다.
3. **"닫기"는 별도 처리 없음**: `FeedbackScreen`이 탭 화면 자체이므로 `MainTabs → Home`으로 탭을 전환하는 것 자체가 웹뷰 화면을 닫는 행위와 동일하다. 별도의 `goBack()`이나 스택 pop은 필요 없다.
4. **응답 없음**: 웹으로 회신 메시지를 보내지 않는다(스펙대로 fire-and-forget).

### 범위 밖

- 구버전 앱 대응(웹은 fire-and-forget이라 폴백이 없고, 이 메시지를 처리하지 않는 구버전에서는 버튼이 아무 반응도 하지 않는 것이 기존 동작보다는 낫다는 전제를 그대로 받아들인다).
- `Feedback` 탭이 background에 마운트된 상태로 남는 것에 대한 상태 초기화(React Navigation 탭의 기본 동작을 그대로 따름 — 이번 스펙에 명시된 요구사항이 아님).
- `FEEDBACK_GO_BACK`, `FEEDBACK_NAVIGATION_STATE` 등 `specs/007-reanswer-progress-banner/`에 계획된 다른 메시지 계약(native→web 방향, 별도 작업).

## 검증

- 이 저장소에는 자동화된 테스트 러너가 구성되어 있지 않다(`AGENTS.md`). `pnpm lint`, `pnpm exec tsc --noEmit` 통과로 정적 검증을 대신한다.
- Expo Go 또는 시뮬레이터에서 `webViewRef.current?.injectJavaScript(...)`로 실제 웹 없이도 메시지를 주입해 홈 탭 이동을 육안 확인(또는 실제 웹 배포 스테이징 URL 연결 시 버튼 탭으로 확인).
