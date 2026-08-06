# WebView 데이터 브리지와 모의고사 이력 연결

**작성일**: 2026-08-05

**상태**: 사용자 승인 완료 (2026-08-05)

**관련 저장소**: `app-front-end`(Expo/React Native), `web-front-end`(Next.js)

## 배경

피드백 웹뷰(`/app-exam-screen`, `/app-question-feedback`)는 지금 브라우저 JS에서 백엔드를
직접 호출한다. 웹의 [`apiFetch`](../../../../web-front-end/src/lib/api/client.ts)는
`Authorization` 헤더를 전혀 붙이지 않으므로, 백엔드가 Bearer 인증을 요구하는 순간 이 화면들은
동작하지 못한다.

앱은 이미 [`009-guest-auth-bootstrap`](../../../specs/009-guest-auth-bootstrap/spec.md)으로
Guest 인증을 갖췄지만, 그 스펙은 "결과 WebView에 인증 정보를 전달하는 방식"을 명시적으로 범위
밖에 두었다. 이 문서가 그 남은 조각을 설계한다.

같은 화면의 기록 탭 두 개(모의고사 기록, 다시 답변한 문제)는 아직
fixture(`mock-exam-history.ts`)로 그려져 있어, 실제 API 연결도 함께 다룬다.

## 설계 원칙: 토큰을 웹으로 보내지 않는다

토큰을 웹뷰에 넘겨 웹이 직접 인증 요청을 하게 만드는 방법도 있으나, 이 설계는 채택하지 않는다.
웹 앱에 XSS가 생기면 그 세션 동안 액세스 토큰이 그대로 노출되고, 앱이 웹 배포의 보안 상태에
인증 안전성을 의존하게 된다.

대신 **네이티브를 인증된 전송 프록시로 둔다.** 웹은 "이 데이터가 필요하다"고 요청만 하고,
네이티브가 자신이 이미 보유한 토큰으로 호출해 결과를 돌려준다. 토큰은 네이티브 경계를 넘지
않는다.

이 선택이 가능한 전제는 두 페이지가 **앱 WebView 안에서만 열린다**는 것이다. 모바일 브라우저
단독 접근이나 공유 링크 사용 사례는 없다.

## 설계 1: WebView 데이터 브리지

### 매핑 소유권

네이티브는 **원본 `result` 객체를 그대로** 웹에 전달하고, 도메인 타입으로의 매핑은 웹이 계속
소유한다.

앱과 웹은 같은 엔드포인트에 대해 각자의 매퍼와 도메인 타입을 이미 따로 갖고 있다(앱:
`map-exam-grading-result.ts`, 웹: 같은 이름의 별도 파일). 네이티브가 자신의 도메인 타입으로
매핑해 보내면 그 타입이 웹 렌더 컴포넌트의 기대 타입과 영원히 동기화돼야 한다. 원본을 넘기면
웹은 지금 쓰는 매퍼를 그대로 두고, 네이티브는 인증만 책임진다.

### 단방향 주입이 아니라 요청/응답인 이유

웹뷰 로드 전에 데이터를 미리 심는 방식으로는 부족하다. 문제별 피드백 화면의 회차 선택 칩이
웹 내부에서 `retryCount`를 바꿔 재조회하기 때문에(`app-question-feedback/page.tsx`의
`selectRetry`), 데이터 요청은 화면 수명 동안 여러 번 발생한다.

### 메시지 계약

**웹 → 네이티브** (`window.ReactNativeWebView.postMessage`):

```json
{
  "type": "NATIVE_DATA_REQUEST",
  "requestId": "<웹이 생성한 고유 문자열>",
  "resource": "EXAM_SUMMARY",
  "params": { "examId": "ex_005" }
}
```

`resource`와 `params` 조합:

| resource | params | 네이티브가 호출하는 경로 |
|---|---|---|
| `EXAM_SUMMARY` | `{ examId }` | `GET /api/v1/exams/{examId}/summary` |
| `QUESTION_FEEDBACK` | `{ examId, questionNumber, retryCount }` | `GET /api/v1/exams/{examId}/questions?questionNumber=&retryCount=` |

**네이티브 → 웹** (`webViewRef.current.injectJavaScript`):

```json
{ "requestId": "...", "ok": true, "result": { } }
```

```json
{ "requestId": "...", "ok": false, "message": "채점 결과를 불러오지 못했어요." }
```

### 화이트리스트 (보안 요구사항)

네이티브는 **임의 경로 프록시를 제공하지 않는다.** 위 표의 명명된 리소스만 받고, 각 리소스의
`params`는 타입과 범위를 검증한 뒤에만 경로로 조립한다(`examId`는 비어 있지 않은 문자열,
`questionNumber`는 양의 정수, `retryCount`는 0 이상의 정수).

웹이 원하는 경로를 그대로 인증된 상태로 호출해 줄 수 있게 만들면, 토큰을 웹에 넘기지 않아
얻은 이득이 사라진다. 계약에 맞지 않는 요청은 조용히 무시한다(기존 웹뷰 메시지 처리 방식과
동일).

### 주입 문자열 이스케이프

`injectJavaScript`에 넘기는 코드는 페이로드를 **JS 문자열 리터럴로** 심고 웹에서 파싱한다.
객체 리터럴을 그대로 코드에 이어붙이면 피드백 본문에 포함된 따옴표나 개행이 주입 코드를 깨뜨릴
수 있다.

```js
window.__nativeDataBridge.deliver(<JSON.stringify(JSON.stringify(payload))>); true;
```

바깥 `JSON.stringify`가 안쪽 JSON 문자열을 안전한 JS 문자열 리터럴로 만든다. 끝의 `true;`는
iOS에서 주입 결과 평가 경고를 피하기 위한 기존 관례다.

### 브리지가 없을 때 (웹 로컬 개발)

`window.ReactNativeWebView`가 없으면 웹은 기존 `apiFetch` 직접 호출로 폴백한다. 프로덕션에서
이 페이지는 웹뷰 안에서만 열리므로 폴백 경로는 개발용이며, 인증이 필요한 스테이징에서는 서버가
정상적으로 거부한다. `?mock=1` 개발 경로는 그대로 유지한다.

### 스켈레톤과 준비 신호

`FEEDBACK_DATA_READY` 메시지와 네이티브 스켈레톤 로직은 **바꾸지 않는다.** 데이터 출처만
바뀌고 "웹이 그릴 준비가 됐다"는 신호의 의미는 그대로다.

### 구성 요소

| 위치 | 파일 | 책임 |
|---|---|---|
| 앱 | `src/features/exam/native-data-bridge.ts` (신규) | 요청 메시지 파싱·검증, 리소스별 API 호출, 응답 주입 코드 생성 |
| 앱 | `src/screens/feedback/FeedbackScreen.tsx` | `onMessage`에서 데이터 요청을 브리지로 위임 |
| 웹 | `src/lib/native-data-bridge.ts` (신규) | `window.__nativeDataBridge` 설치, `requestFromNative()` promise 관리, 타임아웃 |
| 웹 | `src/features/exam/api/exam-grading-result.ts` | 브리지 경유로 원본 result를 받고 기존 매퍼 적용 |
| 웹 | `src/features/exam/api/exam-question-feedback.ts` | 같음 |

### 오류 처리

- 네이티브 호출 실패: `ok: false`로 응답하고 웹은 기존 `ErrorFallbackScreen`을 띄운다.
  재시도 버튼은 새 `requestId`로 다시 요청한다.
- 응답이 오지 않음: 웹의 `requestFromNative()`가 타임아웃으로 거부해 pending promise가 영원히
  남지 않게 한다. 타임아웃은 두 저장소의 기존 API 클라이언트와 같은 10초를 쓰되, 네이티브 호출
  자체도 같은 시간을 쓰므로 웹 타임아웃은 그보다 넉넉한 15초로 둔다. 웹이 먼저 포기하면
  정상 응답이 버려진 뒤 도착한다.
- 계약 위반 메시지: 네이티브는 무시하고 현재 화면을 유지한다.
- 토큰 갱신과 401 재시도는 네이티브의 `apiFetchWithAuthRetry`가 이미 처리하므로 웹은 인증
  상태를 전혀 알 필요가 없다.

## 설계 2: 모의고사 이력 API 연결

### 실제 API와 기존 계약의 차이

`specs/007-reanswer-progress-banner/contracts/history-api-contract.md`는 backend 확정 전에
작성된 제안이라 실제 응답과 다르다.

> **주의:** 스테이징의 `/v3/api-docs`(OpenAPI)는 이 두 endpoint에 대해 **낡은 스키마를 서빙한다.**
> 아래는 사용자가 확인해 준 실제 응답 형태이며, 스펙 문서가 아니라 이쪽이 정답이다.
> `/v3/api-docs`는 `history`에 `totalCount`/`histories`/`cycleNumber`/`summaryAvailable`을,
> `retries`에는 `status`(점수 없음)를 적고 있으나 셋 다 실제와 다르다.

`GET /api/v1/exams/history` 실제 응답:

```json
{
  "result": {
    "exams": [
      {
        "examId": "ex_abc123",
        "title": "토선생 모의고사 1회",
        "totalScore": 150,
        "levelEstimate": "IH",
        "completedAt": "2026-08-01T12:30:00Z",
        "retriedQuestionCount": 2
      }
    ]
  }
}
```

007 계약에 있었으나 **실제로 없는 필드**: `trend`, `maxScore`, `latestCompletedExamId`,
`nextCursor`. 쿼리 파라미터(`limit`, `cursor`)도 없다.

### 화면 조정

1. **만점**: `maxScore`가 응답에 없으므로 TOEIC Speaking 총점 `200`을 앱 상수로 둔다. 이 값이
   화면 문구("/200점")와 추이 차트 척도의 단일 출처가 된다.
2. **추이 차트와 평균**: 007 계약의 5점 척도 `trend`는 실제 응답에 없다. 응답의
   `exams[].totalScore`를 그대로 써서 평균과 추이를 낸다. 서로 다른 척도를 섞지 않는다.
3. **카드 부제의 "다시 답변 N문제"**: `retriedQuestionCount`가 응답에 있으므로 그대로 쓴다.
4. **추이 차트**: 이력이 쌓이면 점과 날짜 라벨이 겹치므로 최근 5개만 그린다.
5. **빈 이력**: `exams: []`이면 추이 카드와 목록 대신 빈 상태를 보여준다.

### 재답변 탭

`GET /api/v1/exams/{examId}/retries` 실제 응답:

```json
{
  "result": {
    "examId": "ex_abc123",
    "questions": [
      {
        "partNumber": 1,
        "questionNumber": 1,
        "latestRetryCount": 2,
        "attempts": [
          { "retryCount": 0, "score": 2.1, "completedAt": "2026-08-01T12:10:00Z" },
          { "retryCount": 1, "score": 2.6, "completedAt": "2026-08-01T12:20:00Z" },
          { "retryCount": 2, "score": 2.9, "completedAt": "2026-08-01T12:30:00Z" }
        ]
      }
    ]
  }
}
```

계산에 필요하지만 응답에 없는 것이 둘 있고, 각각 이렇게 채운다.

**문항별 만점**: `part-meta.ts`의 `EXAM_PART_MAX_SCORE`를 단일 출처로 둔다. 토익 스피킹 공식
배점이며 사용자가 확인해 주었다 — Part1~4(1~10번)는 3점, Part5(11번)는 5점. 문제별 피드백
API는 `maxScore`를 직접 내려주므로 그 화면은 이 표를 쓰지 않는다. 서버가 값을 주는 곳에서는
서버 값을 쓴다.

**회차의 채점 완료 여부**: `status` 필드가 없다. 서버가 미채점 회차를 생략하든 `score`를
`null`로 주든 똑같이 걸러지도록, **`score`가 유한한 수인지**로 판단한다. 최초 회차와 재답변
회차가 모두 채점돼 있어야 비교 대상이며, 조건을 못 채운 문항은 평균의 분모에서도 빠진다.

**대상 시험 선택**: 조회가 시험 단위라 examId가 필요하다. 이력에서 `retriedQuestionCount > 0`인
가장 최근 시험을 고른다(목록은 최신순). 이 때문에 두 탭이 이력을 공유해야 하므로, 이력 조회는
`ExamHistoryScreen`이 한 번만 수행하고 두 패널에 내려준다.

계산 규칙은 007 계약의 "Client calculation contract"를 그대로 따른다 — 문항별 달성률
(`score/maxScore`) 차이를 평균해 퍼센트포인트로 내고, 100점 환산 점수는 만들지 않으며,
반올림은 표시 직전에 한 번만 한다.

향후 사용자 전체 스냅샷 endpoint가 생기면 위의 "대상 시험 선택"은 없어진다.

### 구성 요소

| 파일 | 책임 |
|---|---|
| `src/types/exam.ts` | 이력·재답변 원본 타입 추가 |
| `src/features/exam/part-meta.ts` | `EXAM_PART_MAX_SCORE`, `getExamQuestionMaxScore` 추가 |
| `src/features/exam/api/exam-history.ts` (신규) | `GET /api/v1/exams/history` 호출 |
| `src/features/exam/map-exam-history.ts` (신규) | 원본 → 화면 항목 매핑, 등급 색 결정 |
| `src/features/exam/api/exam-retries.ts` (신규) | `GET /api/v1/exams/{examId}/retries` 호출 |
| `src/features/exam/map-exam-retries.ts` (신규) | 비교 가능한 회차 선별, 달성률 변화 계산 |
| `src/screens/feedback/components/ExamHistoryScreen.tsx` | `MockExamHistoryScreen.tsx`에서 이름을 바꾸고, 이력을 한 번 받아 두 탭에 나눠 준다 |
| `src/screens/feedback/mocks/mock-exam-history.ts` | 삭제 — 두 탭 모두 실제 데이터를 쓴다 |

화면 파일과 컴포넌트 이름의 `Mock` 접두사는 fixture로 그린다는 뜻이었으므로, 실제 데이터를
쓰기 시작하면 오해를 부른다. 이 작업에서 함께 바꾼다.

앱에는 `QueryClientProvider`가 설치돼 있지 않고 `useQuery` 사용처도 없으므로, 기존 화면들과
같은 `useState`/`useEffect` 패턴으로 조회한다. 새 상태 관리 의존성을 도입하지 않는다.

### 오류 처리

- 조회 실패: 탭 안에 오류와 재시도를 표시한다. 빈 상태로 바꾸지 않는다(정상적으로 기록이 없는
  경우와 구분해야 한다).
- 필수 필드가 빠진 성공 응답: 매퍼가 계약 오류로 처리하고 빈 목록으로 변환하지 않는다.
- 알 수 없는 `levelEstimate`: 원문을 그대로 표시하고 기본 색을 쓴다.

## 범위 밖

- 설정 화면 웹뷰(`/app-settings/*`)의 인증. 공개 문서 페이지라 토큰이 필요 없다.
- 여러 시험에 걸친 재답변 성과 합산. 조회가 시험 단위라 가장 최근 재답변 시험 하나만 다룬다.
- 재답변 기록이 없을 때 파트별 피드백(`state=3`)으로 보내는 CTA. 007 스펙에 있으나 지금
  화면에 구현돼 있지 않고, 내비게이션 배선이 따로 필요하다.
- 웹 페이지의 브라우저 단독 접근 지원.
- 이력 목록의 페이지네이션. 현재 API에 커서가 없다.
- 앱으로의 react-query 도입.

## 검증

`AGENTS.md`에 따라 두 저장소 모두에서 `pnpm lint`와 `pnpm exec tsc --noEmit`를 통과해야 한다.
자동화된 테스트 러너는 아직 구성돼 있지 않다.

수동 확인:

1. 인증된 앱에서 피드백 탭을 열어 종합 피드백이 뜨고, 웹 개발자 도구/네트워크 로그에 토큰이
   웹으로 전달되지 않았음을 확인한다.
2. 문제별 피드백에서 회차 칩을 바꿔 재조회가 브리지를 통해 이뤄지는지 확인한다.
3. 네트워크를 끊고 오류 폴백과 재시도가 동작하는지 확인한다.
4. 모의고사 기록 탭에서 실제 이력이 최신순으로 뜨고, 재답변한 시험의 부제에
   "다시 답변 N문제"가 붙는지 확인한다.
5. 다시 답변한 문제 탭에서 평균 달성률 변화와 문제별 게이지가 실제 점수로 그려지는지
   확인한다. 만점 표기가 1~10번은 3점, 11번은 5점인지 함께 본다.
6. 이력이 없는 신규 계정, 그리고 이력은 있으나 재답변이 없는 계정에서 각각 빈 상태가 뜨는지
   확인한다.
