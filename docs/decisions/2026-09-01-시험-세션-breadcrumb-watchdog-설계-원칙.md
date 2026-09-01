# 시험 세션 breadcrumb·watchdog 설계 원칙

## 문제

`ExamSessionScreen` 작업을 4갈래(C1 typed breadcrumb + phase + app lifecycle, C2 오디오
세부 단계 + 파트 안내 timeout, C3 녹음·registry·업로드·채점 단계, C4 빈 문항·Part4 표
준비 실패 등의 watchdog·복구 UI)로 나눠 진행하기 전에, 설계 방향부터 정해야 했다.

지금 상태: phase 전이는 `exam-session-store.ts`의 액션 15곳에 흩어져 있고 기록되지
않는다. 예측 가능한 실패(녹음 시작/종료 실패, prelude 판정 실패 등)는 이미
`reportOperationalError`를 그 자리에서 호출해 처리한다
([use-exam-session-controller.ts:133-146](../../src/screens/mock-exam/hooks/use-exam-session-controller.ts#L133-L146),
[exam-session-store.ts:143-150](../../src/screens/mock-exam/hooks/exam-session-store.ts#L143-L150)).
반면 콜백 자체가 오지 않는 경우(Part4 표 `onTableReady`가 안 오는 등)는 아무 신호도
없어 잡히지 않는다. `use-grading-status.ts`의 `ATTEMPT_TIMEOUT_MS` 패턴이 유일한 기존
watchdog 선례다.

## 선택지

| 안 | 내용 | 트레이드오프 |
|---|---|---|
| A | watchdog을 breadcrumb 로그의 1차 판단 근거로 삼는다 (store가 typed 전이 로그를 들고, watchdog이 그걸 읽음) | 진단·복구 로직이 한 소스를 공유하지만 새 공유 인프라(ring buffer, 리셋 시점)가 필요 |
| B | 예측 가능한 에러는 발생 지점에서 즉시 `reportOperationalError`로 로깅하고, watchdog은 그 어떤 신호도 오지 않는 지점에만 최후 수단으로 붙인다 | 지금 코드 스타일과 그대로 맞물리고 watchdog 범위가 최소화되지만, "신호가 있는가 없는가"를 지점마다 먼저 분류해야 함 |
| C | breadcrumb·watchdog을 아예 분리해 각자 지점마다 독립 타이머만 둔다 | 새 추상화 없음. "typed breadcrumb"라는 개념 자체가 옅어짐 |

## 결정

B. 예측 가능한/주요하다고 보는 에러는 최대한 콜백·catch 지점에서 직접 로깅하고,
watchdog은 그 경로로도 못 잡는 "완전한 침묵" 지점에만 최후의 보루로 건다. 이미 이
저장소의 실패 처리 방식과 일치하고, watchdog 대상을 실제로 신호가 없는 지점으로
좁혀준다.

파생 효과:
- breadcrumb는 watchdog의 판단 근거로 쓸 필요가 없어졌으므로, store에 무거운 공유
  전이 로그를 두기보다 가벼운 진단용 트레일로 남을 가능성이 커졌다.
- **breadcrumb 형태: Sentry 전용(`Sentry.addBreadcrumb`)으로 확정.** store 안에 별도
  전이 로그(안 C)를 두는 방안도 검토했으나, `captureOperationalEvent`가 이미
  `Sentry.captureMessage`를 거치므로([sentry.ts:394-412](../../src/lib/sentry.ts#L394-L412))
  phase 전이마다 `addBreadcrumb`만 심어두면 기존 15종 실패 코드 리포트에 트레일이
  자동으로 붙는다 — 스크러빙([sentry.ts:142-146](../../src/lib/sentry.ts#L142-L146))도
  이미 적용됨. 별도 로그는 watchdog이 읽어야 할 때만 정당화되는데 그 필요가
  없어졌으므로, "A + 앱 상태 사본"이 되는 별도 로그를 둘 이유가 없다. 앱 안에서
  직접 전이 내역을 보여줘야 하는 소비처(디버그 화면 등)가 생기면 재검토한다.
- watchdog은 지점별 로컬 타이머(`use-grading-status.ts`의 `ATTEMPT_TIMEOUT_MS` 패턴)로
  간다 — 공용 watchdog 훅은 만들지 않는다.
- Part4 표 준비(`Part4Table.tsx`, 네이티브 컴포넌트, 웹뷰 아님)는 watchdog 대상이 맞다
  — 근거는 아래 "watchdog 대상 분류 (남은 결정 1)" 참고.
- (참고, 이 화면 범위 밖) 피드백 웹뷰(`FeedbackScreen.tsx`)의 서버 데이터 조회 실패는
  네이티브가 fetch를 대신하므로 이미 `FEEDBACK_DATA_LOAD_FAILED`로 상세 리포트되고
  있다. 웹 렌더링 단계에서만 나는 런타임 에러는 브릿지에 보고 통로가 없고, 발생
  확률이 낮다고 보고 지금은 새 메시지 타입을 추가하지 않는 쪽으로 기울었으나
  최종 확정은 아니다.

### app lifecycle 배치 (결정 2)

**결정**: app lifecycle(`isFocused && isAppActive`)은 `ExamSessionState`에 편입하지
않고 지금처럼 화면/훅 레벨의 ref·지역 상태로 분리 유지한다. breadcrumb emit도 상태
소유권을 따라 지점이 갈라진다 — phase breadcrumb는 `exam-session-store.ts`의 액션
호출부에서, lifecycle breadcrumb는 [ExamSessionScreen.tsx:86](../../src/screens/mock-exam/ExamSessionScreen.tsx#L86)
근처(AppState 리스너)에서 각자 emit한다. 다만 두 지점 모두 하나의 공유 헬퍼
(`emitExamBreadcrumb(category, data)` 형태, `Sentry.addBreadcrumb`를 감쌈)를
통해 emit하고, `category`만 `"exam.phase"` / `"exam.lifecycle"`로 구분한다 — 지점은
갈라지되 스키마는 하나로 유지해 Sentry 타임라인에서 시간순으로 같이 읽히게 한다.

**구현 중 정정**: 애초에 `emitExamBreadcrumb(category, message, data)`로 자유 텍스트
`message` 인자를 받는 안을 검토했으나, [sentry.ts](../../src/lib/sentry.ts)의
`beforeBreadcrumb`(`scrubBreadcrumb`)가 breadcrumb의 `message`를 조건 없이 항상
지운다는 걸 구현 중 확인해 뺐다. 다른 문자열 필드(tags, extra 등)는 알려진 패턴만
골라 지우는 `redactIdentifiers`를 거치는 반면 breadcrumb `message`만 통째로 지우는
비대칭이 있는데, 이는 호출부가 즉흥적으로 조합하는 자유 텍스트를 패턴 매칭만으로는
못 믿겠다는 의도로 읽었다 — `data`는 호출부가 키-값으로 통제하는 구조화된 값이라
스크러빙만 거치고 산다. 따라서 `data`에도 자유 텍스트 대신 `ExamSessionPhase` 값처럼
닫힌 집합(enum)·숫자만 담는다. 이 정책엔 이미 예외 선례가 있다 —
[sentry.ts:150-155](../../src/lib/sentry.ts#L150-L155) `getStableOperationalMessage`는
이벤트 `message`가 유한 집합인 `OperationalErrorCode`와 정확히 일치할 때만 살려준다.
같은 방식을 `scrubBreadcrumb`에도 넣으면 phase 이름을 다시 `message`로 살릴 수 있지만,
`scrubBreadcrumb`은 앱 전체 breadcrumb(Sentry 자동 breadcrumb 포함)에 걸리는 공유
인프라라 이번 범위에서는 건드리지 않기로 했다.

**감수하기로 한 비용**: `message`가 없으므로 Sentry 브레드크럼 타임라인의 요약 줄은
`exam.phase`로 찍힌 항목 전부 동일하게 보인다. 실제 phase 값은 각 항목을 펼쳐
`data.phase`를 봐야 한다. 디버깅 중 클릭 한 번의 마찰로 보고, 지금은 받아들인다 —
번거로움이 실사용에서 드러나면 위 `getStableOperationalMessage` 패턴을
`scrubBreadcrumb`에 추가하는 걸 별도 결정으로 재검토한다.

**근거로 확인한 레퍼런스**:

- **이 저장소 관행** — `use-grading-status.ts`([:117](../../src/features/exam/use-grading-status.ts#L117))와
  `use-answer-submissions.ts`([:101](../../src/features/exam/use-answer-submissions.ts#L101))
  둘 다 자기만의 typed state(`GradingProgressState`, `SubmissionRegistry`)를 갖고
  있으면서 `AppState`는 항상 그 밖의 평범한 `let`/`useRef`로만 다룬다 — 타이머를
  멈추고 재개하는 게이트로만 쓰고 typed state 안에 넣은 적이 없다.
  `exam-session-store.ts:42-46`의 "밖으로 노출하는 것은 도메인 사건뿐이다" 주석과도
  같은 결.
- **`docs/architecture/03-convergent-evolution.md`** — §7(클라이언트 상태)을 확인했으나
  "환경 신호 vs 도메인 상태" 분리를 직접 다루는 항목은 없어, 이 저장소 문서 밖의
  일반 업계 관행으로 별도 판단.
- **업계 수렴 지점 (저장소 밖)**:
  - statechart/XState의 **orthogonal region(직교 영역)** — 독립적으로 변하는 두 축을
    하나의 flat enum으로 곱하지 않고 별도 영역으로 분리하는 정석 해법.
  - Redux 관행 — "app-level" 관심사(네트워크, AppState 등)는 보통 별도 slice로 두고
    feature slice에 안 섞는다.
  - React Native 생태계 관용구 — 공식 문서의 `AppState` 예제부터 독립된
    훅/`useState`이지 도메인 reducer에 넣는 예제가 없다.
  - 컨테이너(완전 분리 vs 별도 slice vs orthogonal region)는 셋이 다르지만
    "의도한 상태와 환경이 부과한 사실을 같은 타입에 섞지 않는다"는 원칙은 동일하게
    수렴한다.

### watchdog 대상 분류 (남은 결정 1)

C2(오디오 세부 단계·파트 안내)·C3(녹음·registry·업로드·채점)·C4(빈 문항·Part4 표)
전체를 "예측 가능해서 이미 콜백/타임아웃으로 잡히는 지점" vs "구조적으로 침묵만
있는 지점"으로 분류했다. 착수 전 추정("파트 안내 timeout이 전무하다")은 부정확했음이
드러나 정정한다.

**이미 신호 있음 — watchdog 불필요**:
- [ExamQuestionCue.tsx:36](../../src/screens/mock-exam/components/ExamQuestionCue.tsx#L36),
  [ExamPhaseCue.tsx:36](../../src/screens/mock-exam/components/ExamPhaseCue.tsx#L36) —
  `CUE_STALL_TIMEOUT_MS`(10s)로 재생 정지를 감지, `playbackStatus.error`/
  `mediaServicesDidReset`도 감지. `EXAM_REQUIRED_AUDIO_FAILED`(`reason: "timeout"` 포함,
  이미 타입에 있음)로 리포트.
- [ExamPartIntroContent.tsx:14](../../src/screens/mock-exam/components/ExamPartIntroContent.tsx#L14) —
  `REMOTE_AUDIO_LOAD_TIMEOUT_MS`(10s)로 로드 지연 감지. 동일하게 리포트.
- C3 전체 — 녹음/registry는 try/catch([use-exam-session-controller.ts:119-171](../../src/screens/mock-exam/hooks/use-exam-session-controller.ts#L119-L171)),
  업로드·채점을 포함한 **모든 API 호출**은 `apiFetch` 자체에 `AbortController` +
  `DEFAULT_TIMEOUT_MS`가 내장([transport.ts:70-90](../../src/lib/api/transport.ts#L70-L90)),
  채점은 `use-grading-status.ts`가 자체 `ATTEMPT_TIMEOUT_MS` watchdog을 이미 보유.
  **C3에는 추가 watchdog 대상이 없다.**

**침묵 지점 — watchdog 필요**:
- [ExamPartDirectionsContent.tsx](../../src/screens/mock-exam/components/ExamPartDirectionsContent.tsx) —
  형제 3개와 달리 stall/load 타임아웃이 없다. `player.play()` 이후 네트워크가 조용히
  멈추면 `playing`도 `error`도 안 온다.
- `Part4Table.tsx`의 `onReady`([:66-70](../../src/components/exam/Part4Table.tsx#L66-L70),
  `<View onLayout>`) — RN의 `onLayout`에는 애초에 에러 채널이 없다(레이아웃 계산은
  "실패"라는 개념 자체가 없음). 안 오는 유일한 현실적 원인은 JS-네이티브 브릿지
  무응답(백그라운드 전환 등)이고, 무응답은 정의상 시간을 재는 것 말고는 관측할 수
  없다 — **타이머가 유일한 방법이지 여러 선택지 중 하나가 아니다.** 렌더 중 JS
  예외 같은 다른 실패 형태는 이미 [sentry.ts:356](../../src/lib/sentry.ts#L356)
  `Sentry.wrap(RootComponent)`의 전역 크래시 캡처로 커버되므로 별도 watchdog 불필요.

**즉시 판별 가능 — watchdog 아님**:
- [ExamSessionScreen.tsx:212](../../src/screens/mock-exam/ExamSessionScreen.tsx#L212)
  `!question` — 시간 경과가 필요한 침묵이 아니라 즉시 판별되는 상태. watchdog보다
  방어적 조기 처리(리포트 + 복구 UI) 대상.

**watchdog 대상 아님 (결정 완료)**: `ExamPartGuideScreen.tsx`(시험 시작 전 온보딩
카드) — 순수 네이티브 화면이고 웹뷰가 아니다(`WebView` import 없음, 전부
`onPress` → `setActiveIndex` 동기 코드). 탭 핸들러와 상태 갱신이 같은 JS 스레드에서
동기 실행되므로 "탭은 됐는데 신호를 못 받는" 웹뷰식 구간 자체가 없다. 이 화면에서
나올 수 있는 실패는 ① 핸들러 실행 중 JS 예외 — 이미 `Sentry.wrap(RootComponent)`
전역 캡처로 커버됨, ② 제스처 자체가 인식되지 않음 — 실행된 코드가 없어 어떤
프레임워크에서도 원천적으로 로깅 불가능. 즉 이 화면엔 Part4Table류의 "비동기 작업은
진행 중인데 신호가 안 오는" 제3의 침묵 구간이 없다.

자동 진행 타이머도 별도로 검토했으나 **채택하지 않는다** — 사용자가 안 넘기는 것과
못 넘기는 것을 구분할 신호가 없고(장시간 방치는 사용자 의도로 본다), 타이머를 달면
app lifecycle(포그라운드/백그라운드) 문제까지 다시 얽힌다. 온보딩 카드는 사용자
페이스대로 유지한다.

**공용화 방침**: 오디오 3개(+Directions로 4개)의 `markPlaybackFailure → reportOperationalError`
wiring과 stall 타이머 effect는 형태가 사실상 동일해 공용 훅으로 추출한다 —
`03-convergent-evolution.md` §3의 "완전히 같은 구현만 공유" 기준에 부합. Part4 표는
신호 종류가 달라(오디오 status vs 레이아웃 이벤트) 이 훅을 재사용하지 않고, 같은
아이디어(마운트 후 데드라인 타이머)를 별도로 작게 단다.

### phase union 통합 여부 (남은 결정 마지막)

**결정**: 통합하지 않는다(A). `ExamSessionPhase` · `AnswerSubmissionStage`
([types/exam.ts:192-200](../../src/types/exam.ts#L192-L200)) · `GradingWaitPhase`
(`use-grading-status.ts`) 세 union과 오디오 컴포넌트 로컬 state를 지금처럼 분리
유지한다.

**근거**:
- 오디오 세부 상태(버퍼링/재생/멈춤/에러)를 컴포넌트 로컬에 두고 `onComplete`
  하나로만 바깥에 알리는 패턴은 이미 3개(+Directions로 4개) 컴포넌트에서 검증됨.
- **`GradingWaitPhase`는 애초에 `ExamSessionPhase`와 동시에 존재한 적이 없다** —
  [ExamSessionScreen.tsx:186-187](../../src/screens/mock-exam/ExamSessionScreen.tsx#L186-L187)에서
  시험 화면이 완전히 unmount된 뒤에야 `GradingWaitScreen`이 mount된다("채점
  대기 중엔 오디오를 쓸 일이 없다" — 두 phase가 겹치는 순간 자체가 없으므로 통합이
  구조적으로 성립하지 않음).
- `AnswerSubmissionStage`는 `ExamSessionPhase`와 같은 화면에서 공존하긴 하지만,
  통합하면 `docs/architecture/README.md` 항목 ②가 이미 "다음 기능에서 아플 지점"으로
  지적한 결합(challenge → `upload-answer-audio` 직접 참조)과 같은 방향으로 결합도를
  더 높이는 셈이라 지금 단계에서 정당화되지 않는다.

## 코드 흐름 변화

- [sentry.ts](../../src/lib/sentry.ts) — `emitExamBreadcrumb(category, data)`와
  `ExamBreadcrumbCategory`(`"exam.phase" | "exam.lifecycle"`) 추가. `SENTRY_ENABLED`가
  꺼져 있으면 즉시 반환하고, `Sentry.addBreadcrumb` 호출은 다른 캡처 함수들과 같은
  이유로 try/catch로 감싸 관측 도구 실패가 사용자 흐름을 막지 않게 한다.
- [exam-session-store.ts](../../src/screens/mock-exam/hooks/exam-session-store.ts) —
  `phase`를 바꾸는 모든 `set()` 호출(약 18곳: `enterPreparationCue`,
  `enterQuestionStart`, `completeDirections`의 4개 분기, `completePreparationCue`,
  `beginResponse`, `beginRecordingAttempt`, `recordingStarted`/`recordingInterrupted`/
  `recordingFailed`, `beginFinalizing`, `answerRegistrationFailed`,
  `answerFileInvalid`, `examCompleted`, `advanceAfterRegistration`의 2개 분기) 직후에
  클로저 헬퍼 `emitPhaseBreadcrumb()`를 호출한다. 이 헬퍼는 `get()`으로 갓 바뀐
  `phase`·`currentIndex`와 `currentQuestion()?.partNumber`를 읽어
  `emitExamBreadcrumb("exam.phase", {...})`로 넘긴다. `retryRecording`처럼 다른
  액션에 위임만 하는 함수, 그리고 phase를 바꾸지 않는 `set()`(`markPart4TableReady`,
  `tickPreparation`/`tickReading`의 진행 중 갱신, `suspendPreparation`/
  `suspendReading`, `answerRegistered`의 정리용 `set`)에는 추가하지 않았다 — 위임
  대상이나 다음 액션이 이미 emit한다.
- [ExamSessionScreen.tsx](../../src/screens/mock-exam/ExamSessionScreen.tsx) —
  기존 `AppState` 리스너 `useEffect` 바로 다음에 `[isFocused, isAppActive]`를
  의존성으로 갖는 새 `useEffect`를 추가해 `emitExamBreadcrumb("exam.lifecycle", {
  isFocused, isAppActive })`를 호출한다. 결정 2가 지목한 "line 86 근처"가 아니라
  기존 lifecycle effect 옆에 둔 것은, `isFocused`도 함께 지켜보려면 `isExamActive`
  계산부(순수 `const`)가 아니라 effect가 필요했기 때문이다 — 마운트 시 1회 포함해
  두 신호 중 하나라도 바뀔 때마다 찍힌다.

## 뼈대 → 구현에서 달라진 것

3단계(사람이 뼈대 코드 작성)를 건너뛰고 사용자가 4단계 구현을 바로 요청해 뼈대 없이
진행했다. 그 과정에서 설계 결정 자체가 하나 바뀌었다 — 위 "구현 중 정정" 참고
(`emitExamBreadcrumb`가 `message` 인자를 받지 않도록 시그니처 변경). 그 밖의 실제
호출 지점(약 18곳)은 사전에 사람이 검토한 뼈대가 없었으므로 구현 시점에 스토어
코드를 다시 읽으며 처음 확정했다.

구현 직후 자체 리뷰에서 세 가지를 추가로 정정했다.

- **초기 phase 누락**: `createExamSessionStore`의 초기 상태는 zustand creator가
  객체 리터럴로 반환하는 값이라, `get()`에 의존하는 `emitPhaseBreadcrumb()`을 그
  안에서 부를 수 없었다 — 트레일이 항상 두 번째 전이부터 시작했다. `createStore`
  호출을 변수로 받아 반환 직전에 초기값으로 한 번 더 emit하도록 고쳤다.
- **배치 재정리**: `sentry.ts`의 나머지 심볼(`OperationalErrorCode`,
  `captureOperationalEvent` 등)은 기능 이름이 안 붙은 범용 인프라인데
  `emitExamBreadcrumb`만 "exam"이 박혀 있었다. `sentry.ts`엔 범용
  `emitBreadcrumb(category: string, data, level?)`만 남기고,
  `ExamBreadcrumbCategory`와 `emitExamBreadcrumb` 래퍼는 새 파일
  [exam-breadcrumb.ts](../../src/screens/mock-exam/exam-breadcrumb.ts)로 옮겼다.
- **breadcrumb level 분리**: 모든 phase breadcrumb가 `info`로 균일해 복구 계열
  phase가 트레일에서 안 튀어 보였다. `part-prelude-error`·`interrupted`·
  `recording-recovery`·`registration-recovery` 4개만 `warning`, 나머지 12개는
  `info`로 나눴다(사용자 확인 후 반영).

## 기준 충돌

아직 없음. 뼈대 코드 작성 시 재검토.

## 남은 결정 (breadcrumb 착수 전 필요)

없음 — 아래 "확정된 결정 로그"의 5건으로 착수 전 설계 결정을 모두 닫았다. 다음은
AGENTS.md 5단계 흐름의 3단계(사람이 뼈대 코드 작성)로 넘어간다.

### 확정된 결정 로그

- breadcrumb 형태: **A (Sentry 전용)** — 위 "결정" 섹션 참고.
- app lifecycle 배치: **`ExamSessionState` 밖에서 분리 유지, breadcrumb는 공유 헬퍼로
  emit 지점만 분리** — 위 "app lifecycle 배치 (결정 2)" 참고.
- watchdog 대상 분류: **`ExamPartDirectionsContent`(공용 오디오 stall 훅으로) +
  `Part4Table.onReady`(별도 마운트 데드라인 타이머로), C3는 대상 없음** — 위
  "watchdog 대상 분류 (남은 결정 1)" 참고.
- `ExamPartGuideScreen` timeout: **채택 안 함** — 순수 네이티브 화면이라 침묵 구간
  자체가 없고, 자동 진행 타이머도 사용자 의도 구분 불가로 기각. 위 "watchdog 대상
  분류" 섹션 하단 참고.
- phase union 통합: **통합 안 함(A)** — `GradingWaitPhase`는 `ExamSessionPhase`와
  공존 시점이 없어 구조적으로 성립하지 않고, `AnswerSubmissionStage` 통합도 기존
  결합도 경고와 같은 방향이라 기각. 위 "phase union 통합 여부 (남은 결정 마지막)"
  참고.
