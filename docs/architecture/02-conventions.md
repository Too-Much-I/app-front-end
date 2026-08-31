# 컨벤션 목록과 code smell

조사 시점: 2026-08-31 (`feat/ten-second-challenge`, e80699d)

두 부분이다.

1. **지키려는 컨벤션** — 문서로 선언된 것과, 코드에서만 읽어낼 수 있는 것을 모두 기록
2. **지켜지지 않는 것** — 그리고 그게 다음 기능에서 얼마나 아플지

---

# 1부 · 컨벤션 목록

## 1.1 문서로 선언된 것 (AGENTS.md · CLAUDE.md · docs/how-we-work.md)

| # | 컨벤션 | 기계화 | 실제 준수 |
|---|---|---|---|
| 1 | `pnpm`만 쓴다 (11.23.0 고정) | packageManager 필드 | ✅ |
| 2 | strict TypeScript. `any` · 억제 주석 금지 | tsconfig + CI | ✅ **저장소 전체 0건** |
| 3 | `@/*` 별칭으로 import (tsconfig·babel 동기) | — | ✅ (`public/`만 상대 경로, 별칭 범위 밖이라 주석으로 설명) |
| 4 | 공용 `Text` · `Pressable`을 쓴다 | **oxlint `no-restricted-imports`** | ✅ |
| 5 | 디자인 토큰을 쓴다, hex를 흩뿌리지 않는다 | — | ⚠️ 대체로 지켜짐. `HomeScreen`의 반짝임 좌표는 임의값 |
| 6 | `tokens.js`는 CommonJS로 남긴다 | — | ✅ (이유가 파일 상단에 있음) |
| 7 | 합성 굵기(`font-medium`/`font-bold`) 금지 — Jua는 한 굵기 | — | ✅ |
| 8 | safe-area inset을 쓴다, 상태바 패딩 하드코딩 금지 | — | ✅ |
| 9 | 플랫폼 분기는 theme 프리미티브에 모은다 | — | ✅ (`shadows`, `Pressable`) |
| 10 | 라우트 파라미터 타입은 `navigation/types.ts`에 | — | ✅ 모든 라우트 타입 지정됨 |
| 11 | `apiFetch<T>()`를 쓴다 | — | ✅ (S3 PUT만 raw fetch — 인증 헤더가 없어야 하므로 맞다) |
| 12 | `Raw* → 매퍼 → 도메인 타입` 경계 유지 | — | ✅ 예외 없음 |
| 13 | 엔드포인트 1개 = 파일 1개 (`features/exam/api/`) | — | ✅ exam · auth. ❌ challenge 매퍼 |
| 14 | 의존성을 함부로 늘리지 않는다 | — | ✅ (다만 미사용 의존성 1개 — 3.1 참조) |
| 15 | 비밀값은 `EXPO_PUBLIC_*`만, 공개 값으로 취급 | — | ✅ Clarity project id만 하드코딩(공개 값) |
| 16 | 커밋 제목·본문은 한국어, 타입/스코프는 영어 소문자 | — | ✅ 60커밋 전부 |
| 17 | 결정 기록은 `docs/decisions/YYYY-MM-DD-주제.md`, 80줄 이하 | — | ✅ 11개 |
| 18 | 핸드오프 전 `pnpm lint` + `pnpm exec tsc --noEmit` | **CI** | ✅ |
| 19 | Frontend Fundamentals 4기준 (가독성·예측 가능성·응집도·결합도) | — | ⚠️ 예측 가능성만 국소적으로 깨짐 (네이밍 사전 §3① 참조) |
| 20 | 기준이 충돌하면 임의로 정하지 않고 사람에게 묻는다 | — | ✅ 주석에 충돌 판단 근거가 남아 있다 |

## 1.2 코드에서만 읽히는 컨벤션 (문서에 없지만 예외 없이 지켜지는 것)

### 표기와 형식

| # | 규칙 | 근거 |
|---|---|---|
| 21 | `src/` 안은 큰따옴표 | `from "` 887건 / `from '` 0건 |
| 22 | 세미콜론 있음, 2-space, 탭 없음 | 전수 |
| 23 | import 그룹: 외부 → 빈 줄 → `@/` | 전 파일 |
| 24 | 타입 전용 import는 `import type` | 전 파일 |
| 25 | 숫자 리터럴 천 단위는 밑줄 (`10_000`, `180_000`) | 전수 |
| 26 | default export 없음 (`App.tsx` 하나만 예외 — Expo 진입점) | 1건 |

### 타입 설계

| # | 규칙 | 예 |
|---|---|---|
| 27 | 상태는 **판별 유니온**. 불리언 조합으로 상태를 만들지 않는다 | `AuthBootstrapState`, `ChallengeUiStatus` |
| 28 | 상태마다 **그 상태에서만 유효한 데이터**를 같이 묶는다 | `{ status: "RETRYABLE_ERROR"; source; retry; message }` |
| 29 | 서버 응답은 `unknown`으로 받고 런타임 타입가드로 좁힌다 | `parseRawTokenPair`, `parseNativeDataRequest` |
| 30 | 명세가 동결되지 않은 필드는 `unknown` + 매퍼가 좁힌다 | `RawChallengeQuestionResult.aiResult` |
| 31 | `switch`에 `never` exhaustiveness 체크를 붙인다 | `exam-session-store.ts:169` |
| 32 | 오류는 도메인별 커스텀 클래스 + `this.name` 대입 (14개) | `ApiError`, `RecordingFileError`, `ExamHistoryContractError` |
| 33 | "계약 위반"과 "요청 실패"를 다른 오류 타입으로 나눈다 | `*ContractError` vs `ApiError` |

### 비동기와 생명주기

| # | 규칙 | 근거 |
|---|---|---|
| 34 | 모든 조회에 `AbortController`. cleanup에서 abort | 14개 파일 |
| 35 | `.then()` 안에서 항상 `if (signal.aborted) return` 먼저 | 전수 |
| 36 | 언마운트 후 setState 방지용 `mountedRef` | `use-challenge-submission` 등 |
| 37 | 재조회는 `reloadCount`/`attempt` 카운터를 effect 의존성에 넣는 방식 | `use-challenge-question`, `use-challenge-result` |
| 38 | 비동기 훅의 반환 모양은 `{ status, <데이터>, retry }`로 통일 | `useChallengeQuestion`, `useChallengeResult`, `useRecentFeedback` |
| 39 | 폴링은 `setInterval`이 아니라 **재귀 `setTimeout`** (응답 지연이 겹치지 않게) | 3곳 전부 |
| 40 | 콜백은 `inputRef`에 담아 effect 의존성에서 뺀다 (stale closure 회피 + 불필요한 재실행 방지) | `use-challenge-submission` |
| 41 | 액션 객체는 `useMemo`로 참조를 고정한다. 상태가 흔들려도 명령은 안 흔들린다 | `use-challenge-recorder`, `auth-provider` |

### 관측

| # | 규칙 |
|---|---|
| 42 | **사용자 흐름을 실제로 막은 handled failure만** Sentry로 보낸다 |
| 43 | 안정된 `code` + **허용 목록** metadata만. raw Error의 message·stack·URL·응답은 버린다 |
| 44 | 분석 이벤트 이름·속성은 **union 하나**로 컴파일 타임 강제 (`analytics-events.ts`) |
| 45 | 식별자(`examId`)·답안·점수는 어느 도구에도 보내지 않는다. Sentry와 Amplitude가 **같은 기준** |
| 46 | 화면 조회는 `App.tsx`가 라우트 이름만 자동 전송 |
| 47 | 관측 도구 초기화 실패는 절대 사용자 흐름을 막지 않는다 (promise가 reject하지 않는다) |

### 주석

| # | 규칙 |
|---|---|
| 48 | 한국어로 쓴다 |
| 49 | **"무엇"이 아니라 "왜"만** 쓴다. 코드를 다시 말하지 않는다 |
| 50 | 반례를 남긴다 — "이렇게 하면 이런 일이 생긴다" |
| 51 | 측정치를 남긴다 (대비비 3.01:1, iPad 834pt, Jua ascent 800 …) |
| 52 | 하지 **않은** 선택과 그 이유를 남긴다 (`TabBarButton`, `Pressable`, `formatCountdown`) |
| 53 | 임시 코드에는 **지울 조건**을 함께 쓴다 ("서버가 준비되면 이 분기와 dev-mock을 함께 지운다") |

이 주석 문화가 이 저장소의 가장 큰 자산이다. 24,000줄 규모에서 새 참여자가 "왜 이렇게 돼 있지"를
코드 밖에서 물어볼 일이 거의 없다.

### 도메인 규칙 (제품에서 온 것)

| # | 규칙 |
|---|---|
| 54 | 시간·날짜의 **정본은 항상 서버**. 앱은 자정 경계를 계산하지 않는다 |
| 55 | 사용자 분기는 서버 `message` 문자열이 아니라 `code`로 한다 |
| 56 | 웹뷰에 액세스 토큰을 넘기지 않는다. 임의 경로 프록시도 열지 않는다 |
| 57 | 재시도가 응시 횟수를 소비하지 않게 한다 (멱등 키 + attempt 고정 S3 key) |
| 58 | 상태 합성은 화면 밖 **순수 함수**로 (`resolve*UiStatus`) |
| 59 | 스토어는 원시 setter를 노출하지 않고 도메인 사건만 노출한다 |
| 60 | 되돌아가면 안 되는 화면은 `gestureEnabled: false` + 이유를 주석에 |

---

# 2부 · 지켜지지 않는 것 (code smell)

심각도는 **"다음 기능을 만들 때 얼마나 걸리적거리는가"** 기준이다.

## 🔴 높음

### 3.1 서버 상태 계층이 통째로 비어 있다

`@tanstack/react-query`가 `package.json`에 있지만 **사용처가 0**이다. `QueryClientProvider`도 없다.
결과적으로 조회·폴링·취소·재시도·백오프·캐시가 훅마다 손으로 구현돼 있다.

폴링만 세 벌이다.

| 파일 | 주기 | 예산 | "한 번은 성공했는가" 판정 |
|---|---|---|---|
| `use-grading-status.ts` (344줄) | 자체 | 자체 | 자체 |
| `use-challenge-result.ts` (181줄) | `[2, 2.5, …, 5]초` 배열 | 180초 | `hasLoadedOnce` |
| `summary-feedback-retry-polling.ts` | 자체 | 자체 | 자체 |

**비용**: 챌린지 스테이지 화면을 만들면 네 번째 폴링이 생긴다. 캐시가 없어서 홈 → 챌린지 →
결과 → 홈을 오갈 때마다 같은 조회가 다시 나간다(`docs/decisions/2026-08-25-챌린지-진행내역-캐시-만료.md`가
이 문제를 이미 다루고 있다). 화면 간 데이터 무효화도 손으로 해야 한다.

**판단이 필요한 것**: 의존성을 지울 것인가, 쓸 것인가. 지금은 "쓰기로 하고 안 쓰는" 상태라
읽는 사람이 잘못된 기대를 한다.

### 3.2 `__DEV__` 목 분기가 프로덕션 코드 경로 안에 있다

```
features/challenge/use-challenge-question.ts:34    if (__DEV__) { 서버를 아예 부르지 않는다 }
features/challenge/use-challenge-attempt.ts:45     if (__DEV__) { 목 attempt }
features/challenge/use-challenge-submission.ts:119 if (__DEV__) { 업로드하지 않고 접수된 척 }
features/challenge/use-challenge-result.ts:176     if (!__DEV__) return load();  // 실패하면 목으로
```

`useChallengeQuestion`은 개발 빌드에서 **실제 API를 한 번도 호출하지 않는다.** 즉 개발 중에는
챌린지 통합이 검증되지 않는다. 주석이 "서버가 준비되면 함께 지운다"고 조건을 명시한 건 좋지만,
그때까지 개발 빌드와 운영 빌드의 코드 경로가 다르다.

**비용**: 백엔드가 붙는 날, 처음으로 실제 경로를 타는 코드가 4곳이다.

### 3.3 도메인 로직이 `screens/` 아래에 있다

| 파일 | 줄 | 들어 있는 것 |
|---|---|---|
| `screens/mock-exam/hooks/exam-session-store.ts` | 296 | 시험 진행 상태 기계 전체 (phase 17종) |
| `screens/challenge/challenge-ui.ts` | 249 | 첨삭 정규화 · 라벨 사전 · 밑줄 구간 계산 |
| `screens/reanswer/reanswer-ui.ts` | 61 | 상태 합성 · 회차 표기 |

AGENTS.md는 "재사용 가능한 동작은 feature/theme/ui 계층에" 두라고 한다.
**비용**: 챌린지 스테이지 화면이 생기면 `challenge-ui.ts`를 두 화면이 공유한다 —
그 순간 `screens/challenge/`에서 import하는 다른 화면이 생긴다.

### 3.4 테스트가 하나도 없다

CI는 lint와 typecheck만 돈다. 그런데 이 저장소에는 **입력 → 출력만 있는 순수 함수가 40개 이상**이다.

```
매퍼 7 · findCorrectionSpans · resolveChallengeUiStatus · resolveRecordingPhase
scaleForWidth · scaleForLandscapeTable · decidePartPrelude · normalizeExamPartPreludes
summarizeReanswerProgress · normalizeCorrectionSeverity · averageTotalScore
parseNativeDataRequest · parseReanswerRequest · isRawExamSummaryComplete
getEqualJitterDelayMs · previewOperationalError · areExamTableContextsEqual
```

`previewOperationalError`는 **테스트를 위해 만든 함수인데 테스트가 없다** — Sentry로 보낼 payload를
보내지 않고 미리 보여주려고 존재한다. `features/diagnostics/`도 같은 성격이다. 검증 장치를 만들어
두고 자동화만 안 한 상태다.

**비용**: 리팩터링의 안전망이 없다. 위 3.1~3.3을 정리하려 할 때 가장 먼저 부딪힌다.

## 🟡 중간

### 3.5 파일 크기

| 파일 | 줄 |
|---|---|
| `screens/feedback/components/ExamHistoryScreen.tsx` | **983** |
| `features/auth/auth-controller.ts` | **821** |
| `screens/mock-exam/hooks/use-microphone-test.ts` | 632 |
| `screens/feedback/FeedbackScreen.tsx` | 623 |
| `features/audio/use-timed-audio-recorder.ts` | 566 |
| `types/exam.ts` | 556 |
| `features/exam/use-answer-submissions.ts` | 518 |

`auth-controller.ts`는 부트스트랩 상태 기계 + 토큰 재발급 직렬화 + 동의 흐름 + 계정 삭제를 한 파일에
담는다. 주석 밀도가 높아 읽히기는 하지만 한 파일의 책임이 넷이다.

### 3.6 `console.*`와 관측 경로가 규칙 없이 병존한다

51곳에서 `console.error`/`warn`을 부른다. `reportOperationalError`로 Sentry에 가는 것과, 콘솔에만
남는 것을 가르는 기준이 코드에 없다. 예: `use-challenge-question`의 조회 실패는 콘솔에만 남고,
같은 성격인 `REANSWER_QUESTION_LOAD_FAILED`는 Sentry로 간다.

**챌린지 기능 전체가 운영 오류 코드 표(`OPERATIONAL_ERROR_CODES`)에 없다.** 16개 코드 중
challenge 관련은 0개다. 출시 후 챌린지가 깨지면 알 방법이 없다.

### 3.7 기능 간 결합 — 남아 있음

`use-challenge-submission.ts`가 `features/exam/upload-answer-audio`에서 네 개를 가져온다.

```ts
import { ANSWER_AUDIO_CONTENT_TYPE, AnswerAudioUploadError,
         getValidAnswerAudioFile, uploadAnswerAudio } from "@/features/exam/upload-answer-audio";
```

이름이 "시험 답변(answer)"인데 챌린지가 쓴다. 업로드 자체는 도메인 중립이므로 `features/audio/`나
`lib/upload/`가 제자리다. **이건 파일을 옮기는 일이라 이름 정리(2026-08-31)에서 손대지 않았다.**

### 3.8 껍데기 재수출 — 2026-08-31 해소

세 건이 있었고 모두 지웠다.

- `features/exam/recording-permission.ts` — `features/audio/`를 그대로 재수출하던 5줄
- `features/exam/answer-audio.ts` — `features/audio/audio-session`을 재수출하며 한 이름을 개명
- `features/exam/use-answer-recorder.ts`의 `AnswerRecordingError` 별칭과 미사용 타입 별칭 2개

소비처를 원본 모듈로 돌렸고, `pnpm check:naming`의 `aliased-re-export` 규칙이 재발을 막는다.

## 🟢 낮음 (알고만 있으면 되는 것)

| # | 내용 |
|---|---|
| 3.9 | lint 규칙이 3개뿐(oxlint). import 순서 · 파일 길이 · 미사용 export가 기계화되지 않아 사람 리뷰에 의존한다 |
| 3.10 | `import` 그룹 내부가 알파벳 순이 아니다 (`FeedbackScreen.tsx`에서 `ExamHistoryScreen`이 `FeedbackWebViewSkeleton` 뒤) |
| 3.11 | 루트 `index.ts` · `app.config.ts`만 홑따옴표 (`src/`는 100% 큰따옴표) |
| 3.12 | `NotificationsScreen`이 목 데이터만 그린다. 사용자에게 노출되는 화면인데 서버 연동이 없다 |
| 3.13 | `specs/` 14개 폴더가 죽은 워크플로 산출물로 남아 있고 AGENTS.md가 "따르지 말라"고 방어 중이다. `docs/superpowers/`도 같은 성격. 문서가 코드보다 많고 새 참여자에게 가장 큰 노이즈다 |
| 3.14 | `ExamSessionPhase`가 유니온 17종. 진행 단계 · 복구 단계 · 오류 단계가 한 축에 눌려 있다 |
| 3.15 | 백오프 계산이 두 곳(`getEqualJitterDelayMs` in exam, `POLL_INTERVALS_MS` 배열 in challenge)에 다른 방식으로 존재 |

---

# 3부 · 손대는 순서 제안

같은 시간을 쓴다면 이 순서가 신규 기능 속도를 가장 많이 올린다.

| 순서 | 무엇 | 이유 | 크기 |
|---|---|---|---|
| ~~0~~ | ~~이름만 바꾸는 11건 + `pnpm check:naming`~~ | **2026-08-31 완료.** 네이밍 사전 §4·§5 | — |
| 1 | **순수 함수 테스트 도입** (Jest + 매퍼·resolve\* 40개) | 아래 전부의 안전망. 지금은 리팩터링이 무섭다 | 반나절 배선 + 점진 |
| 2 | **챌린지를 운영 오류 코드 표에 넣기** | 출시하면 안 보이는 구간이 생긴다 | 1시간 |
| 3 | **react-query 결정** (쓰거나 지우거나) | 다음 화면마다 폴링이 하나씩 는다 | 결정 자체는 회의 하나 |
| 4 | `screens/*/`의 도메인 로직을 `features/`로 | 스테이지 화면 만들기 직전에 | 반나절 |
| 5 | 업로드 모듈을 `features/exam` 밖으로 (3.7) | 세 번째 녹음 도메인이 생길 때 | 1~2시간 |
| 6 | `__DEV__` 목 제거 | 백엔드 붙는 날 | 백엔드 일정에 종속 |
| 7 | `ExamHistoryScreen` 분해 · 라우트 등록 여부 결정 | 983줄. 아프지만 급하지 않다 | 하루 |

이름 정리를 0번으로 먼저 한 이유: 리스크가 0(전부 삭제·개명이고 typecheck가 잡는다)이고,
검사 스크립트를 지금 붙여야 아래 1~7을 하면서 새 위반이 안 쌓인다. 테스트보다 앞선 것은
우선순위 판단이 아니라 **의존 관계가 없어서**다.
