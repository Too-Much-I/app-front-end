# 네이밍 사전

조사 시점: 2026-08-31 (`feat/ten-second-challenge`, e80699d)
대상: `src/` 전체 — 파일 236개, 값 export 약 300개, `src/` 밖의 `App.tsx` · `index.ts` 포함

> **적용 상태 (2026-08-31)** — §4의 11건은 **모두 반영됐고**, §5의 검사가 CI에서 재발을 막는다.
> §A~§3에 "깨진다"고 적힌 항목은 **고치기 전의 상태**다. 지운 이유가 아니라 고친 이유를 남기려고
> 그대로 두었으니, 지금 코드에서 그 위반을 찾지 말 것. 현재 상태는 §4와 §5가 정본이다.
> §A의 `ExamHistoryScreen`(983줄, `components/` 아래, 라우트 미등록)은 2026-09-01에 분해했다 —
> `ExamHistoryTabView` 외 9개 파일, 최대 187줄이고 `*Screen` 접미도 뗐다.
> 아직 남아 있는 것은 §G의 `retry` 세 가지 뜻뿐이며, 이름만 바꿔서는 해결되지 않는다.

이 문서는 세 가지를 답한다.

1. 지금 쓰이고 있는 이름을 MECE하게 분류하면 몇 종류인가
2. 같은 책임에 같은 이름을 쓴다면, 이 저장소는 각 이름을 **무엇으로 정의하고 있는가**
3. 그 정의가 지켜지고 있는가 — 아니라면 유독 어디서 깨지는가

---

## 1. 분류 축

이름이 붙는 대상을 겹치지 않게 나누면 일곱 축이다. 아래 표의 "정의"는 **이 저장소가 실제로
그렇게 쓰고 있는 규칙**을 코드에서 역으로 읽어낸 것이다. 문서로 선언된 것이 아니다.

| # | 축 | 무엇에 붙는 이름인가 | 표기 |
|---|---|---|---|
| A | 위치 | 디렉터리 · 파일 | kebab-case / PascalCase |
| B | 타입 | 서버 · 도메인 · 화면 상태 · 오류 | PascalCase |
| C | 함수 | 조회 · 생성 · 변환 · 판정 · 표시 · 부수효과 | camelCase, 동사 시작 |
| D | 상수 | 설정값 · 카탈로그 · 버전 | SCREAMING_SNAKE |
| E | 컴포넌트 | 화면 · 조각 | PascalCase |
| F | 상태 리터럴 | 앱이 만든 값 · 서버가 준 값 | kebab / snake / SCREAMING |
| G | 도메인 어휘 | exam · challenge · attempt · retry … | 영어 명사 |

---

## A. 위치 — 디렉터리와 파일

| 위치 | 이 저장소에서의 정의 | 실제 예 |
|---|---|---|
| `src/screens/<도메인>/` | **라우트로 등록되는 화면**과 그 화면에서만 쓰는 것 | `mock-exam/`, `challenge/` |
| `src/screens/<도메인>/components/` | 그 화면 밖에서는 쓸 일이 없는 조각 | `ChallengeNoteCard.tsx` |
| `src/screens/<도메인>/hooks/` | 그 화면의 진행 상태를 들고 있는 훅 | `use-exam-session-controller.ts` |
| `src/features/<도메인>/` | **도메인 지식** — API 호출, 매퍼, 생명주기 훅 | `features/exam/`, `features/challenge/` |
| `src/features/<도메인>/api/` | 엔드포인트 1개 = 파일 1개 | `exam-session-create.ts` |
| `src/lib/` | 도메인을 모르는 배선 | `api/`, `sentry.ts`, `amplitude.ts` |
| `src/components/ui/` | 어느 화면에서나 쓰는 원시 UI | `Text.tsx`, `Pressable.tsx` |
| `src/types/` | 서버 계약 + 도메인 타입 | `exam.ts`, `challenge.ts`, `api.ts` |
| `src/theme/` | 디자인 토큰과 그 파생 | `tokens.js`, `rem-scale.ts` |
| `src/navigation/` | 내비게이터와 라우트 파라미터 타입 | `types.ts` |

**파일명 표기 규칙(관찰된 것)**

| 파일이 무엇을 내보내는가 | 표기 | 예 |
|---|---|---|
| React 컴포넌트 | `PascalCase.tsx` | `ChallengeNoteCard.tsx` |
| 훅 | `use-*.ts` | `use-challenge-result.ts` |
| 그 외 모듈 | `kebab-case.ts` | `part-meta.ts`, `challenge-error-codes.ts` |
| 매퍼 | `map-<도메인>-<리소스>.ts` | `map-exam-history.ts` |
| API | `<도메인>-<리소스>.ts` | `challenge-day-result.ts` |

### A에서 깨지는 것

| 어긋난 곳 | 규칙 | 실제 |
|---|---|---|
| `features/auth/auth-provider.tsx` | 컴포넌트 파일은 PascalCase | kebab인데 `AuthProvider` 컴포넌트를 내보낸다 |
| `features/orientation/OrientationProvider.tsx` | — | 같은 역할인데 이쪽만 PascalCase. **둘 중 하나가 틀렸다** |
| `components/ui/Skeleton.tsx` | 파일명 = export명 | export는 `SkeletonBlock` |
| `components/ui/use-skeleton-pulse.ts` | 훅 파일명 = 훅 이름 | export는 `useSkeletonPulseStyle` |
| `screens/feedback/components/ExamHistoryScreen.tsx` | `components/` = 조각 | 983줄짜리 화면이 조각 폴더에 있다 |
| `features/challenge/map-challenge-question.ts` | 매퍼 1파일 1리소스 | 안에 매퍼 6개(today · question · attempt · upload-url · answer · day-result) |
| `features/exam/recording-permission.ts` | — | 내용 없이 `features/audio/recording-permission.ts`를 재수출만 하는 5줄 |
| `screens/home/RecentFeedbackCard.tsx` | 조각은 `components/`에 | 화면과 같은 폴더에 평평하게 |
| `components/exam/Part4Table.tsx` | 전역 `components/`는 `ui/`뿐 | 도메인 폴더가 여기 하나만 있다 |

**API 파일 이름은 세 방식이 공존한다.**

| 기능 | 방식 | 예 |
|---|---|---|
| `exam` | 명사 — `exam-<리소스>.ts` | `exam-grading-status.ts` |
| `challenge` | 명사 — `challenge-<리소스>.ts` | `challenge-upload-url.ts` |
| `auth` | **동사** — `<동작>.ts` | `create-guest.ts`, `logout.ts`, `reissue-tokens.ts` |

---

## B. 타입

| 패턴 | 정의 | 예 |
|---|---|---|
| `Raw*` | **서버가 준 그대로.** nullable · snake_case · 흔들리는 어휘가 살아 있다. 화면이 직접 읽으면 안 된다 | `RawChallengeToday`, `RawExamQuestionFeedback` |
| (접두 없음) | **매퍼를 통과한 도메인 타입.** 화면이 읽어도 되는 유일한 모양 | `ChallengeToday`, `ExamQuestionFeedback` |
| `*Status` | 서버가 알려주는 **진행 단계** | `ChallengeGradingStatus`, `ExamGradingLifecycleStatus` |
| `*UiStatus` | 여러 훅의 상태를 합쳐 **화면이 그리는 한 가지 상태** | `ChallengeUiStatus`, `ReanswerUiStatus` |
| `*State` | 훅 내부의 `useState` 모양 | `ChallengeResultState`, `AuthBootstrapState` |
| `*Phase` | 시간에 따라 **자동으로 넘어가는** 단계 | `ExamSessionPhase`(17종), `RecordingPhase` |
| `*Error` | 이 도메인에서만 나는 오류 클래스 | `ApiError`, `AuthStorageError`, `RecordingFileError` |
| `*ContractError` | **서버 응답이 계약을 어겼다** — 네트워크 실패와 구분한다 | `ExamHistoryContractError`, `ExamRetriesContractError` |
| `*ParamList` | 내비게이터의 라우트 파라미터 지도 | `RootStackParamList`, `MainTabParamList` |
| `*Request` / `*Response` | 웹뷰 메시지 계약 | `NativeDataRequest`, `NativeDataResponse` |
| `*Props` | 컴포넌트 프롭 | `SparkleProps`, `TickingClockProps` |

**잘 지켜지는 축이다.** `Raw*` → 매퍼 → 도메인 경계는 예외 없이 지켜진다. `types/challenge.ts`는
"서버가 같은 값을 snake_case로도 주지만 선언하지 않는다 — 매퍼가 모르는 키는 버리므로" 같은
근거까지 주석에 남겨 두었다.

### B에서 흐릿한 것

- `ChallengeCorrectionItem = RawChallengeCorrectionItem`. 도메인 타입 이름이 붙어 있지만 실제로는
  Raw의 별칭이다. 주석은 "정규화할 것이 없어서"라고 설명하지만, 이름만 보면 매퍼를 통과한 값처럼
  보인다. 실제로 `severity`는 여전히 흔들리는 문자열이고 화면 직전에 `normalizeCorrectionSeverity`가
  좁힌다.
- `*Status`가 세 층위를 동시에 가리킨다: 서버 값(`ChallengeAttemptStatus`), 요청 진행
  (`ChallengeAttemptRequestStatus`), 화면(`ChallengeUiStatus`). 셋을 한 파일에서 볼 때만 구분된다.

---

## C. 함수 — 동사 사전

| 동사 | 정의 (이 저장소에서의 약속) | 예 |
|---|---|---|
| `get*` | **읽기.** 서버 조회이거나 순수한 조회 | `getChallengeToday`, `getExamPartMeta` |
| `create*` | **새로 만든다.** 서버 자원 또는 값 객체 | `createExamSession`, `createGuest`, `createChallengeAttempt` |
| `issue*` | 서버가 **발급**한다 (만료가 있는 것) | `issueChallengeUploadUrl` |
| `submit*` / `notify*` | 서버에 **결과를 알린다** | `submitChallengeAnswer`, `notifyAnswerUploadComplete` |
| `map*` | `Raw*` → 도메인 타입 | `mapExamHistory`, `mapChallengeQuestion` |
| `parse*` | 검증하며 좁힌다. **실패하면 `null` 또는 throw** | `parseNativeDataRequest`, `parseRawTokenPair` |
| `is*` / `has*` | 불리언 판정 (타입가드 포함) | `isAuthSession`, `hasUnsavedRecording` |
| `assert*` | 아니면 **던진다** | `assertQuestionAudioAvailable` |
| `resolve*` | 여러 입력에서 **하나를 골라낸다** | `resolveChallengeUiStatus`, `resolveRecordingPhase` |
| `normalize*` | 흔들리는 값을 **알려진 집합으로 떨어뜨린다** | `normalizeCorrectionSeverity`, `normalizeMeteringDb` |
| `format*` | 사람이 읽는 문자열로 | `formatDuration`, `formatRetryLabel` |
| `build*` | 문자열/스크립트를 **조립** | `buildNativeDataScript`, `buildOverviewUrl` |
| `decide*` | 분기 판정을 **값으로** 돌려준다 | `decidePartPrelude` |
| `summarize*` | 목록 → 요약 값 | `summarizeReanswerProgress` |
| `report*` / `capture*` / `track*` | 관측 도구로 **내보낸다** | `reportOperationalError`, `trackEvent` |
| `preview*` | 내보내지 않고 **내보낼 모양만** 돌려준다 (테스트/검증용) | `previewOperationalError` |
| `initialize*` | 앱 시작 시 1회 배선 | `initializeSentry`, `initializeAmplitude` |
| `persist*` / `read*` / `clear*` | 기기 저장소 입출력 | `persistConsent`, `readAuthSession` |
| `use*` | React 훅 | `useChallengeResult` |

**스토어 액션에는 별도 규칙이 있다** (`exam-session-store.ts`에 주석으로 명시됨).

| 형태 | 뜻 |
|---|---|
| `begin*` | "시작해도 되나?"를 묻는다. 단계가 안 맞으면 `false`를 돌려주고 **아무것도 바꾸지 않는다** |
| 과거형 (`recordingStarted`, `answerRegistered`) | 이미 일어난 일을 알린다. **거절하지 않는다** |
| `complete*` | 그 단계가 끝났다 |
| `tick*` / `suspend*` | 타이머가 부른다 |

이건 이 저장소에서 가장 잘 설계된 네이밍이다. `setPhase` 같은 원시 조작을 일부러 노출하지 않아
호출부가 "무엇을 대입하는지"가 아니라 "무엇이 일어났는지"로 읽힌다.

### C에서 깨지는 것

| 문제 | 내용 |
|---|---|
| **같은 이름, 다른 함수 3쌍** | `isStatusOnly` · `hasUnsavedRecording` · `isSubmissionLocked`가 `screens/reanswer/reanswer-ui.ts`와 `screens/ten-second-challenge/challenge-ui.ts`에 각각 있다. 인자 타입이 달라 컴파일은 통과하지만, import 문을 보기 전에는 어느 쪽인지 모른다 |
| **같은 함수, 다른 이름** | `formatDuration`(reanswer)과 `formatCountdown`(challenge)은 구현이 **완전히 동일**하다. 주석은 "함께 바꿀 이유가 없어서 가져다 쓰지 않는다"고 근거를 남겼는데, 그건 *중복을 허용한* 이유지 *이름을 다르게 지은* 이유는 아니다 |
| **같은 동작, 다른 동사** | 업로드 완료를 서버에 알리는 같은 일을 시험은 `notifyAnswerUploadComplete`, 챌린지는 `submitChallengeAnswer`로 부른다 |
| **같은 클래스, 두 이름** | `AudioRecordingError`가 `features/exam/use-answer-recorder.ts`에서 `AnswerRecordingError`로 재수출된다 |
| **`create` vs `issue`** | 둘 다 서버가 만드는 자원인데 attempt는 `create`, upload-url은 `issue`. 구분 기준(만료 유무)이 이름에 드러나지 않는다 |

---

## D. 상수

| 패턴 | 정의 | 예 |
|---|---|---|
| `*_MS` / `*_SEC` / `*_SECONDS` | **단위를 이름에 박는다.** 잘 지켜짐 | `POLL_BUDGET_MS`, `PART4_READING_DURATION_SEC` |
| `*_VERSION` | 계약 버전 | `PRIVACY_CONSENT_VERSION`, `SUMMARY_FEEDBACK_RETRY_VERSION` |
| `*_CODE` (단수, 객체) | 서버 코드 → 앱 어휘 사전 | `CHALLENGE_ERROR_CODE` |
| `*_CODES` (복수, 배열) | 코드 목록 + 파생 타입 | `OPERATIONAL_ERROR_CODES` |
| `EXAM_PART_*` | 파트 메타 테이블 | `EXAM_PART_META`, `EXAM_PART_MAX_SCORE` |
| `*_MESSAGE` | 사용자에게 보이는 고정 문구 | `SUBMIT_FAILURE_MESSAGE`, `AUDIO_TOO_LARGE_MESSAGE` |
| `DEV_*` | 개발 빌드에서만 쓰는 값 | `DEV_MOCK_CHALLENGE_QUESTION`, `DEV_SUBMIT_DELAY_MS` |
| `IS_*` | 불리언 플래그 | `IS_SENTRY_VALIDATION_MODE` |
| 파일 내부 비공개 상수 | export 없이 파일 상단 | `FEEDBACK_READY_TIMEOUT_MS`, `PRESSED_OPACITY` |

숫자 리터럴은 `10_000`, `180_000`처럼 밑줄 구분자를 쓴다 — 예외 없이 지켜진다.

### D에서 깨지는 것

**같은 사실이 두 이름 · 두 단위로 존재한다.**

```
features/challenge/use-challenge-recorder.ts   CHALLENGE_RECORDING_DURATION_MS = 10_000
screens/ten-second-challenge/challenge-ui.ts   CHALLENGE_RECORDING_SECONDS = ↑ / 1_000
```

후자가 전자에서 파생되므로 값이 어긋날 일은 없지만, "10초"라는 하나의 사실을 부르는 이름이 둘이다.
화면 코드에서는 `CHALLENGE_RECORDING_SECONDS`만 보이므로 이게 어디서 왔는지 추적이 한 단계 늘어난다.

---

## E. 컴포넌트

| 접미 | 정의 | 예 |
|---|---|---|
| `*Screen` | **라우트로 등록되는 화면** | `HomeScreen`, `ChallengeResultScreen` |
| `*Navigator` | 내비게이터 | `RootNavigator`, `MainTabNavigator` |
| `*Provider` | Context 공급자 | `AuthProvider`, `OrientationProvider` |
| `*Card` | 테두리·그림자가 있는 독립 블록 | `ChallengeNoteCard`, `RecentFeedbackCard` |
| `*Panel` | 화면 한 영역을 통째로 채우는 상태 표시 | `ChallengeStatusPanel`, `ReanswerRecordPanel` |
| `*Sheet` | 아래에서 올라오는 것 | `ChallengeCorrectionSheet`, `GradingSheet` |
| `*Modal` | 화면을 덮는 것 | `ConfirmModal`, `MascotModal` |
| `*Notice` | 안내·경고 한 장 | `GradingFailedNotice`, `PortraitOnlyNotice` |
| `*Header` / `*Bar` | 화면 상·하단 고정 영역 | `ChallengeHeader`, `ChallengeActionBar` |
| `*Content` | 부모가 배치를 정하고 내용만 채우는 조각 | `ExamPartIntroContent`, `ExamQuestionContent` |
| `*Cue` | 안내 음성을 재생하는 단계 화면 | `ExamPhaseCue`, `ExamQuestionCue` |
| `*Skeleton` | 로딩 자리 지킴 | `ChallengeNoteSkeleton`, `FeedbackWebViewSkeleton` |
| `*Layout` | 여러 화면이 공유하는 껍데기 | `DeviceTestLayout` |
| `*TabView` | 다른 화면 안에서 탭으로 갈리는 뷰(라우트 아님) | `ExamHistoryTabView` |

### 파일 이름에는 catch-all 접미를 쓰지 않는다

컴포넌트가 아닌 모듈의 파일명은 **무엇이 들었는지**를 말한다. `-ui` · `-utils` ·
`-helpers` · `-misc`처럼 아무거나 담을 수 있는 이름은 쓰지 않는다.

2026-09-01까지 `challenge-ui.ts` · `reanswer-ui.ts` · `exam-history-ui.ts` 세 개가
그 접미를 썼고, 249줄짜리 `challenge-ui.ts` 안에는 상태 판정 · 타이머 표기 · 첨삭
밑줄 구간 계산이 함께 들어 있었다. `findCorrectionSpans`(문자열 매칭)가 "ui"에
있는 것이 이 접미의 성격을 그대로 보여준다. 내용대로 갈랐다.

| 이전 | 이후 |
|---|---|
| `screens/challenge/challenge-ui.ts` (249) | `challenge-status.ts` (156) · `challenge-corrections.ts` (105) |
| `screens/reanswer/reanswer-ui.ts` (56) | `reanswer-status.ts` (56) |
| `screens/feedback/exam-history-ui.ts` (140) | `exam-history-state.ts` (84) · `exam-history-tabs.ts` (20) · `exam-history-format.ts` (37) |

`-status` · `-state`는 **화면이 그리는 상태 union과 그 판정**을 담는다. 그 외에는
담긴 것을 그대로 부른다(`-corrections` · `-tabs` · `-format`). 새 이름이 필요하면
새 접미를 만들지 말고 파일을 하나 더 만든다.

`ui`라는 단어를 쓰지 않는 이유가 하나 더 있다 — Feature-Sliced Design에서 `ui`는
컴포넌트를 뜻해서 정확히 반대로 읽힌다. 이 저장소에서 컴포넌트는 `components/` 폴더가 맡는다.

`*Screen`의 정의(= 라우트로 등록된다)를 깨는 것은 이제 없다. 하나 있던 `ExamHistoryScreen`은
2026-09-01에 `ExamHistoryTabView`로 개명하며 정리했다 — 라우트가 아니라 `FeedbackScreen`이
파라미터 없이 렌더하는 자식이므로, 라우트로 올리는 대신 접미를 바꿔 사실과 이름을 맞췄다.
(`*TabView` = 다른 화면 안에서 탭으로 갈리는 뷰.)

---

## F. 상태 리터럴 — 출처가 표기에 드러난다

| 표기 | 출처 | 예 |
|---|---|---|
| `kebab-case` | **앱이 만든 값** | `record-failed`, `part4-reading`, `submission-barrier` |
| `snake_case` | **서버가 준 값** | `not_started`, `submitted`, `not_requested` |
| `SCREAMING_SNAKE` | **서버 오류 코드** 또는 앱의 운영 오류 코드 | `CHALLENGE_DATE_CHANGED`, `ANSWER_RECORDING_FAILED` |
| `UPPER` (상태 머신) | 인증 부트스트랩 상태 | `CONSENT_REQUIRED`, `AUTHENTICATED` |

**이 축은 예외 없이 지켜진다.** 값 하나만 봐도 그것이 앱의 판단인지 서버의 사실인지 알 수 있다.
저장소 전체에서 가장 값진 규칙이고, 문서에 적혀 있지 않은데도 흔들리지 않았다.

(작은 어긋남: 인증 상태는 `AUTHENTICATED`처럼 SCREAMING인데 다른 앱 내부 상태는 kebab이다.
인증만 서버 코드와 같은 모양을 쓴다.)

---

## G. 도메인 어휘 — 같은 것을 부르는 여러 이름

### 시험 도메인

| 어휘 | 정의 | 주의 |
|---|---|---|
| `exam` | 시험이라는 제품 | |
| `session` | 한 번의 응시. `examId`로 식별 | |
| `part` | 1~5. 각기 다른 서두·시간 규칙 | |
| `prelude` | 파트 **본문 전에 나오는 것** (Part 3 소개 음성, Part 4 표 읽기) | `directions`와 다르다 |
| `directions` | 파트 시작 안내 음성 | |
| `cue` | 음성을 틀고 끝나면 다음으로 넘기는 단계 | |
| `question` | 문항. `questionNumber`(1-base) | |
| `answer` | 한 문항에 대한 녹음 1건 | |
| `retryCount` | **재답변 회차 (0-base).** 앱이 계산하지 않는다 | |
| `reanswer` | 재답변이라는 행위·화면 | |
| `retry` | 재시도(요청 다시 보내기) | ← **`retryCount`와 다른 뜻** |
| `resetForRetry` | 다시 **녹음**하기 | ← 또 다른 뜻 |
| `grading` | 채점 | |
| `feedback` | 채점 결과를 사람에게 보여주는 것 | |
| `correction` | 첨삭 항목 하나 | |

**`retry`가 세 가지를 가리킨다** — 회차(`retryCount`), 요청 재시도(`retryExamGrading`, `useReanswerQuestion`의
`retry`), 재녹음(`resetForRetry`). 파일 하나 안에서는 안 겹치지만, `ReanswerScreen`에서는 셋이 다 등장한다.

### 챌린지 도메인

| 어휘 | 정의 |
|---|---|
| `challenge` | 10초 챌린지 |
| `challengeDate` | **서버 기준 KST 날짜.** 앱이 절대 계산하지 않는다 |
| `attempt` | 한 문장에 대한 응시 1건. 생성 시점이 날짜를 1시간 고정한다 |
| `promptKo` | 영어로 바꿔 말할 한국어 문장 |
| `referenceAnswer` | 참고 답안. 접수 즉시 내려온다 |
| `transcript` | STT가 옮긴 내 발화 |
| `correctedAnswer` | 내 문장을 고친 결과 |
| `feedbackSummary` | 화면의 "토선생의 한마디" |
| `severity` | 첨삭 심각도. **서버 어휘가 흔들려서 화면 직전에 정규화한다** |

### 한 도메인, 세 이름

10초 챌린지를 부르는 이름이 위치마다 다르다.

| 위치 | 이름 |
|---|---|
| `src/features/challenge/` | challenge |
| `src/types/challenge.ts` | challenge |
| ~~`src/screens/ten-second-challenge/`~~ → `src/screens/challenge/` | challenge (2026-08-31 통일) |
| 라우트 `TenSecondChallenge` | ten-second-challenge |
| 라우트 `ChallengeResult` | challenge |
| 컴포넌트 `Challenge*` 13개 | challenge |

같은 스택 안의 두 라우트가 서로 다른 접두를 쓴다(`TenSecondChallenge` / `ChallengeResult`).

---

## 3. 컨벤션은 지켜지고 있는가

**대체로 매우 잘 지켜진다.** 다음 축은 예외를 찾지 못했다.

- 표기법(큰따옴표 887/887, 세미콜론, 2-space) — `src/` 안에서 100%
- `Raw*` → 매퍼 → 도메인 경계
- 상태 리터럴의 출처 표기(kebab / snake / SCREAMING)
- 단위 접미(`*Ms`, `*Sec`)
- 주석 언어(한국어)와 성격("왜"만 쓴다)
- `any` · `@ts-ignore` · `eslint-disable` — **저장소 전체에 0건**

**깨지는 곳은 세 군데에 몰려 있다.**

### ① 두 번째 사례가 생긴 순간

재답변과 10초 챌린지는 "문제 → 녹음 → 검토 → 제출"이라는 같은 모양이다. 두 번째(챌린지)를 만들 때
첫 번째(재답변)의 구조를 그대로 따라갔는데, **이름은 맞추지 않았다.**

| 재답변 | 챌린지 | 관계 |
|---|---|---|
| `isStatusOnly` | `isStatusOnly` | 같은 이름, 다른 함수 |
| `hasUnsavedRecording` | `hasUnsavedRecording` | 같은 이름, 다른 판정 |
| `isSubmissionLocked` | `isSubmissionLocked` | 같은 이름, 다른 판정 |
| `formatDuration` | `formatCountdown` | 다른 이름, 같은 구현 |
| `ReanswerUiStatus` | `ChallengeUiStatus` | 대응됨 (좋음) |
| `ReanswerRecordStatus` | `ChallengeNoteStatus` | 대응되는 개념, 다른 어휘 |

AGENTS.md의 예측 가능성 기준("이름 겹치지 않게 관리")과 정면으로 부딪히는 지점이다. 중복 자체는
결합도 기준에 따라 **의도적으로 허용**했고 주석에 근거도 남겼다 — 문제는 중복이 아니라 **이름을
겹치게 둔 것**이다. 이 둘은 다른 결정인데 한 번에 결정된 것처럼 보인다.

### ② features와 screens의 경계

도메인 로직이 `screens/` 아래에 있다.

| 파일 | 줄 | 무엇이 들었나 |
|---|---|---|
| `screens/mock-exam/hooks/exam-session-store.ts` | 296 | 시험 진행 상태 기계 전체 |
| `screens/challenge/challenge-corrections.ts` | 105 | 첨삭 심각도 정규화, 라벨 사전, 밑줄 구간 계산 |
| `screens/challenge/challenge-status.ts` | 156 | 상태 합성 + 타이머 표기 |
| `screens/reanswer/reanswer-status.ts` | 56 | 상태 합성 + 회차 표기 |
| `screens/feedback/exam-history-state.ts` | 84 | 패널 상태 판정 |

이름 규칙(`screens/` = 화면)과 내용(도메인 지식)이 어긋난다. 챌린지 스테이지 화면이 생기면
`challenge-corrections.ts`를 두 화면이 공유하게 되고, 그때 이 어긋남이 실제 비용이 된다.
(2026-09-01의 파일 분해는 이름만 정확히 했을 뿐, 이 어긋남 자체는 그대로다.)

### ③ 가장 최근에 만든 기능

10초 챌린지가 규칙을 가장 많이 벗어난다 — 한 도메인 세 이름, 매퍼 6개 한 파일, 상수 두 이름,
동명 함수 3쌍, `__DEV__` 목 분기. 나쁜 코드라서가 아니라 **가장 빨리 만들었고 아직 두 번째 독자를
만나지 않았기 때문**이다. 시험 도메인은 같은 자리를 여러 번 고치면서 이름이 정리됐다.

---

## 4. 이름만 바꾼 것 (동작 변화 없음) — 2026-08-31 적용 완료

| # | 이전 | 이후 | 근거 |
|---|---|---|---|
| 1 | `challenge-ui.ts` / `reanswer-ui.ts`의 동명 함수 3쌍 | `isChallengeStatusOnly` / `isReanswerStatusOnly` 등 도메인 접두 | 예측 가능성 |
| 2 | `formatCountdown` ≡ `formatDuration` | **그대로 둠** — 아래 참조 | — |
| 3 | `screens/ten-second-challenge/` | `screens/challenge/` | 한 도메인 한 이름 |
| 4 | `Skeleton.tsx` → `SkeletonBlock` | `SkeletonBlock.tsx` | 파일명 = export명 |
| 5 | `use-skeleton-pulse.ts` → `useSkeletonPulseStyle` | `use-skeleton-pulse-style.ts` | 같음 |
| 6 | `features/auth/auth-provider.tsx` | `AuthProvider.tsx` | 컴포넌트 파일 표기 |
| 7 | `features/exam/recording-permission.ts` | 삭제, import를 `features/audio/`로 | 껍데기 재수출 |
| 8 | `AnswerRecordingError` 별칭 (+ 미사용 타입 별칭 2개) | 삭제, `AudioRecordingError` 직접 사용 | 한 클래스 한 이름 |
| 9 | `map-challenge-question.ts` 안의 매퍼 6개 | 리소스별 6파일 + `epoch-ms.ts` | exam과 같은 규칙 |
| 10 | `CHALLENGE_RECORDING_SECONDS` | `CHALLENGE_RECORDING_DURATION_SEC`, MS 상수 옆으로 이동 | 한 사실 한 이름 |
| 11 | `features/exam/answer-audio.ts` | 삭제, import를 `features/audio/audio-session`으로 | 7과 같은 유형 (규칙 적용 중 발견) |

**2번을 그대로 둔 이유** — 구현은 같지만 중복 자체가 의도적이고(분 단위까지 가는 재답변 녹음과
10초로 끝나는 챌린지는 표기를 함께 바꿀 이유가 없다) 그 근거가 이미 `challenge-status.ts` 주석에 있다.
이름이 겹치지도 않아 규칙 위반이 아니다. 통일하려면 두 화면의 표기를 함께 바꾸겠다는 결정이
먼저 있어야 한다.

**11번** — 규칙(§5 `export { X as Y }` 금지)을 실제로 적용하니 §4 목록에 없던 같은 유형이 하나 더
나왔다. `features/exam/answer-audio.ts`는 `features/audio/audio-session`을 재수출하며
`VOICE_RECORDING_OPTIONS`를 `ANSWER_RECORDING_OPTIONS`로 개명하고 있었다. 소비처 9곳을
원본 모듈로 돌렸다.

**9번의 유보 조건** — 이 문서는 원래 "`challenge`가 아직 유동적이라 백엔드 연동이 끝난 뒤가 낫다"고
적었다. 분리를 먼저 하기로 결정했으므로, 백엔드 연동에서 응답 형태가 바뀌면 파일이 6개로 나뉘어
있다는 점을 감안해야 한다.

---

## 5. 규칙 검사 — `pnpm check:naming`

위 규칙 중 기계적으로 검사 가능한 다섯 개를 `scripts/check-naming.mjs`가 확인하고 CI가 돌린다.

| 규칙 | 무엇을 막나 |
|---|---|
| `duplicate-export` | 서로 다른 파일이 같은 이름을 내보낸다 (§3① 재발 방지) |
| `component-file-name` | `.tsx`의 컴포넌트 이름 ≠ 파일명, 또는 파일명이 PascalCase가 아님 |
| `hook-file-name` | `use-*.ts`가 파일명과 같은 이름의 훅을 안 내보냄 |
| `aliased-re-export` | `export { X as Y }` — 한 대상에 두 이름 |
| `mapper-per-file` | `map-*.ts` 하나에 매퍼가 둘 이상 |

**oxlint 규칙이 아니라 별도 스크립트인 이유**

1. 가장 중요한 `duplicate-export`는 프로젝트 전체 인덱스가 필요하다. 린터 규칙은 파일 단위로
   돌기 때문에 표현할 수 없다.
2. oxlint의 JS 플러그인(`jsPlugins`)은 스키마에 `"in alpha and not subject to semver"`로 명시돼
   있다. CI 게이트를 거기 걸면 oxlint를 올릴 때마다 깨질 수 있다.
3. 예외를 소스의 억제 주석이 아니라 스크립트의 `ALLOWLIST`에 이유와 함께 적는다. 이 저장소는
   `oxlint-disable`이 0건이고, 오탐 규칙이 그 성질을 깨는 첫 계기가 되지 않게 한다.

현재 `ALLOWLIST`는 비어 있다. 항목이 늘어나면 규칙 쪽을 의심한다.

**기계가 못 잡는 것** — `formatCountdown` ≡ `formatDuration` 같은 "같은 구현 다른 이름"과
`retry`의 세 가지 뜻(§G)은 의미의 문제라 검사에 걸리지 않는다. 이 축은 여전히 리뷰의 몫이다.
