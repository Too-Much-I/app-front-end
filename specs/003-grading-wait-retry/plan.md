# Implementation Plan: 채점 대기 폴링과 재요청

**Branch**: `feat/#TMI-15` | **Date**: 2026-07-28 | **Spec**: [spec.md](spec.md)

**Approval**: Approved by the user for implementation on 2026-07-28.

**Input**: Feature specification from `/specs/003-grading-wait-retry/spec.md`

## Summary

채점 대기 UI의 진행 값은 `gradedPartCount` 하나로 유지한다. 화면 진입 후 첫 네 체크는
10초마다 하나씩 추가하되 4에서 멈추고, 서버 상태는 첫 요청을 즉시 보낸 뒤 각 응답이
끝난 3초 후 다음 요청을 보내 중첩을 막는다. `COMPLETED`가 오면 체크·마감·폴링 타이머를
정리하고 현재 카운트부터 5까지 빠르게 순차 증가시킨 뒤 결과 진입점으로 한 번만 이동한다.

최초 `FAILED` 또는 3분 초과는 재요청 가능 상태이며 최종 오류가 아니다. 사용자가 재요청을
선택하면 체크를 0으로 초기화하고 `POST /api/v1/exams/{examId}/grading/retry`를 호출한다.
HTTP 성공 뒤 두 번째 polling을 시작하고, 호출 실패 또는 두 번째 시도의 `FAILED`/3분 초과만
최종 오류로 보낸다.

## Technical Context

**Language/Version**: strict TypeScript 6.0, React 19.2

**Primary Dependencies**: Expo 57, React Native 0.86, React Navigation 7, Expo Video 57,
existing `apiFetch<T>()`

**Storage**: 영속 저장 없음. `GradingWait`는 기존처럼 `examId`만 route parameter로 받음

**Testing**: `pnpm lint`, `pnpm exec tsc --noEmit`, iOS/Android 수동 시나리오. 자동 테스트
runner는 현재 없음

**Target Platform**: Expo 기반 iOS 및 Android 앱

**Project Type**: mobile application

**Performance Goals**: 동시에 진행 중인 상태 조회 최대 1건, 10/20/30/40초 체크 전환,
`COMPLETED` 확인 후 2초 이내 최종 체크와 navigation 완료

**Constraints**: 시도당 최대 180초, 조회 간격 3초, 사용자 재요청 최대 1회, 시간만으로
마지막 체크 금지, polling/retry 로직을 위한 새 dependency 금지, 앱 프로세스 종료 뒤 복원은
범위 밖. TMI-23 UI의 달리는 토끼 영상은 Expo 57 호환 `expo-video`를 사용한다.

**Scale/Scope**: 채점표 5개 파트와 최초/재요청의 최대 2개 채점 시도

## Constitution Check

*GATE: Passed before Phase 0 and re-checked after Phase 1.*

- [x] The specification is approved and separates facts, assumptions, scope, out-of-scope behavior, and open questions.
- [x] Acceptance criteria describe observable behavior and include failure or interruption paths.
- [x] The design uses Expo/React Native APIs and preserves strict TypeScript and existing architectural boundaries.
- [x] Existing shared UI, theme, navigation, API, mapper, and domain layers are reused where applicable.
- [x] At least two viable approaches were considered, or the plan explains why only one approach is practical.
- [x] The validation plan includes `pnpm lint`, `pnpm exec tsc --noEmit`, and relevant manual or device checks.
- [x] No secret or unapproved Jira write, commit, push, dependency addition, or other external side effect is required.

Post-design re-check: polling/retry 설계는 dependency나 브라우저 전용 API를 추가하지 않는다.
TMI-23 UI의 영상은 Expo SDK 호환 `expo-video`와 정적 번들 asset을 사용한다. endpoint access는
exam API/feature 계층에 유지하고 typed route params, cleanup, failure, accessibility, device
validation을 포함한다. Constitution exception은 필요하지 않다.

## Current Flow

1. `useExamSessionController` records and submits each answer. All expected submission jobs must reach
   `succeeded` before the controller changes from
   `submission-barrier` to `completed`.
2. `ExamSessionScreen` waits briefly, then replaces itself with `GradingWait` and passes `examId`.
3. `useGradingStatus`는 현재 `GET /api/v1/exams/{examId}/status`를 호출하지만, 확정된 polling
   경로는 `GET /api/v1/exams/{examId}/summary`다. 현재 loop는 각 응답 종료 3초 뒤 다음 호출을
   예약해 요청 중첩을 이미 방지한다.
4. The current hook derives checks over 90 seconds, caps them at four, sets all five at once on
   `COMPLETED`, and navigates after 900ms. `FAILED` goes directly to the terminal notice. There is no
   three-minute attempt deadline, abort signal, or manual re-request.
5. `GradingWaitScreen` renders the approved waiting UI and sends completion to the placeholder
   `Feedback` tab. Its current Home callback only pops the nested MockExam stack and does not select the
   app's `Home` tab.
6. `MyPageScreen` still exposes a development preview and the route/hook contain preview-only branches.
7. 재요청 endpoint는 `POST /api/v1/exams/{examId}/grading/retry`로 확정됐지만 현재 frontend
   API module과 화면 연결은 아직 없다.

## Design Options

### Option A - 단일 체크 카운트와 작은 controller hook

- `gradedPartCount` 하나가 `GradingSheet`의 유일한 진행 입력이다.
- hook은 최소 phase, 시도 번호와 timer/request 정리만 소유한다.
- 첫 네 체크는 하나의 10초 timer가 카운트를 최대 4까지 올린다.
- status polling은 기존 순차 `setTimeout` loop를 유지한다.
- `COMPLETED`에서는 현재 카운트부터 5까지 짧은 timeout chain으로 증가한다.

장점은 현재 UI 계약을 그대로 재사용하고 상태가 작으며, 사용자가 설명한 인덱스 모델과
일치한다는 점이다. timeout/완료 경쟁은 시도별 local `settled`와 request abort로 정리한다.

### Option B - reducer 기반 상세 상태 머신

체크 tick, poll response, deadline, retry request, animation step을 모두 action으로 만들고
reducer가 전환을 검증한다. 전환을 한곳에서 볼 수 있지만 이 화면의 UI 데이터가 카운트 하나인
것에 비해 action과 boilerplate가 커진다. 자동 테스트 runner가 없는 현재 저장소에서는 작은
변경에 비해 검증 부담도 커진다.

### Option C - TanStack Query refetch interval

기존 dependency의 query polling을 쓰는 방법이다. 그러나 응답 완료 후 3초의 순차 간격,
시도별 deadline, request 정리, 체크 완료 연출과 exactly-once navigation은 별도
controller가 다시 필요하다. 현재 수동 loop보다 책임이 줄지 않는다.

### Option D - retry/error를 별도 navigation route로 분리

각 route의 JSX는 작아지고 route별 analytics/deep link가 쉬워진다. 반면 count, attempt,
deadline과 request ownership을 route 사이로 전달하거나 상위 store로 승격해야 하며, 화면 이동
때 polling 중복·timer 재시작·뒤로가기 stack 문제가 생긴다. 독립적으로 진입할 필요가 없는
일시적 phase에는 비용이 더 크다.

## Decision

Option A를 선택한다. 표현 상태는 `gradedPartCount` 하나로 제한하고, 화면 분기에만 다음 최소
phase를 사용한다. `retry-ready`, `retry-requesting`, `terminal-error`는 navigation하지 않고
같은 `GradingWaitScreen` 안에서 전용 표현 컴포넌트를 조건부 렌더링한다.

```text
polling -> retry-ready -> retry-requesting -> polling -> completing
   |                              |              |
   | first failed/timeout         | request fail | second failed/timeout
   |                              v              v
   +-------------------------- terminal-error <-+
```

`polling`의 최초/재요청 구분은 별도 UI 상태가 아니라 `attempt = 0 | 1`로 관리한다. 각 시도
closure의 local `settled`는 deadline/FAILED/COMPLETED 중 먼저 확정된 전환만 허용한다.
`retryLockedRef`는 연속 탭을, `didNavigateRef`는 중복 이동을 막는다. 진행 중 fetch는 시도마다
새 `AbortController`를 만들고 화면 해제, deadline, 완료, 재요청 시작 시 취소한다. await 뒤
`signal.aborted`이면 그 응답을 적용하지 않는다.

### Timing and polling

1. 시도 시작 시 `gradedPartCount = 0`, `attemptStartedAt = Date.now()`,
   `deadlineAt = attemptStartedAt + 180_000`을 설정한다.
2. 체크 timer는 10초마다 count를 `Math.min(4, count + 1)`로 갱신한다. 40초 뒤에는 계속 4를
   유지하며 시간만으로 5를 만들지 않는다.
3. status는 시도 시작 직후 한 번 조회한다. `PENDING`/`PROCESSING` 또는 일시적 조회 오류이면
   이전 요청 종료 3초 뒤 다음 조회를 예약한다. literal `setInterval`은 10초 API timeout과
   겹칠 수 있으므로 쓰지 않는다.
4. deadline이 먼저 오면 fetch와 두 timer를 정리한다. attempt 0이면 `retry-ready`, attempt
   1이면 `terminal-error`다.
5. `COMPLETED`가 먼저 오면 phase를 `completing`으로 고정하고 모든 timer/request를 정리한다.
   `gradedPartCountRef.current + 1`부터 5까지 짧은 고정 간격으로 state를 순차 갱신한다.
   다섯 번째 체크가 렌더링되고 체크 stroke를 볼 짧은 hold 뒤 `onComplete`를 한 번 호출한다.

### Re-request boundary

1. `GradingWait` route는 기존처럼 `examId`만 받는다. 재요청을 위해 문항이나 업로드 데이터를
   navigation으로 전달하지 않는다.
2. `exam-grading-retry.ts`가 `POST /api/v1/exams/{examId}/grading/retry`를 호출하고
   `retryExamGrading(examId, signal): Promise<void>`를 제공한다. request body는 보내지 않으며
   HTTP 2xx resolve, non-2xx/transport error reject로 정규화한다.
3. Retry 선택 즉시 single-flight lock을 잡고 count를 0으로 초기화한 뒤 `retry-requesting`을
   표시한다. Promise resolve는 접수 성공, reject는 접수 실패로 해석한다.
4. resolve 뒤 attempt 1의 새 check/deadline/polling을 시작한다. reject면 세 번째 요청을
   제공하지 않고 `terminal-error`로 간다.

### Screen and navigation responsibilities

- `GradingSheet`는 변경 없이 `gradedPartCount`만 받는다.
- `GradingWaitScreen`은 hook 결과에 따라 waiting, retry notice, terminal notice만 분기한다.
- retry notice는 첫 실패/timeout에만 Retry CTA를 표시하며, 요청 중에는 shared `Pressable`을
  disabled 처리하고 중복 선택을 막는다.
- terminal notice는 기존 mascot과 Home CTA를 유지한다. Home은 MockExam stack을
  `popToTop()`한 뒤 parent tab을 `Home`으로 이동한다.
- 결과 상세 화면은 범위 밖이므로 완료 destination은 현재의 `Feedback` placeholder를
  유지한다. 실제 결과 route가 생기면 completion callback만 교체한다.
- 탭 전환으로 screen이 mounted 상태인 동안 현재 동작처럼 polling은 계속된다. MockExam
  stack에서 screen이 제거되거나 unmount되면 모든 client timer/request/후속 navigation을
  취소한다. 운영체제에 의해 앱 프로세스가 중단된 동안의 background polling은 보장하지 않는다.

## Failure and Recovery Paths

| Event | Required state/result | Recovery |
|---|---|---|
| 최초 `PENDING`/`PROCESSING` | `polling`, count 0~4 | 응답 종료 3초 뒤 재조회 |
| 일시적 status network error | 현재 count/attempt 유지 | deadline 안에서 3초 뒤 재조회 |
| 최초 `FAILED` | `retry-ready` | Retry CTA 1회 제공 |
| 최초 180초 deadline | `retry-ready` | 최종 오류 없이 Retry CTA 1회 제공 |
| 빠른 Retry 연속 탭 | 첫 요청만 `retry-requesting` | CTA disabled + ref lock |
| `POST /grading/retry` reject | `terminal-error` | 추가 retry 없이 Home |
| 재요청 접수 성공 | count 0, attempt 1 `polling` | 새 check/deadline/poll 시작 |
| 두 번째 `FAILED` 또는 180초 deadline | `terminal-error` | 추가 retry 없이 Home |
| 어느 시도든 `COMPLETED` | `completing` | 남은 count를 5까지 순차 표시 후 Feedback |
| `COMPLETED`와 deadline 경쟁 | 먼저 `settledRef`를 점유한 전환 하나 | 늦은 callback/response 무시 |
| 재요청 뒤 최초 시도 응답 callback | 이전 signal aborted 또는 local settled | 응답 무시, 새 loop가 현재 상태 확인 |
| screen unmount | timer clear + fetch/retry abort | state/navigation callback 금지 |

## Developer Explain-Back

- [x] The affected files and their responsibilities can be explained.
- [x] The changed data and state transitions can be described in order.
- [x] The selected tradeoffs and rejected alternatives can be explained.
- [x] The validation and rollback approach can be explained.

핵심 explain-back: UI는 count 하나이고, phase는 첫 실패와 최종 실패를 구분하기 위해서만
존재한다. 서버 완료의 유일한 권위는 exam-level polling의 overall `COMPLETED`다. 재요청
transport는 `retryExamGrading(examId)`로 분리되므로 화면 상태 머신과 API parsing이 섞이지
않는다. rollback은 hook과 화면 분기를 기존 polling으로 되돌리는 파일 단위 변경이며 서버
데이터 migration은 없다.

## Project Structure

### Documentation (this feature)

```text
specs/003-grading-wait-retry/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── grading-wait-contract.md
└── tasks.md                 # $speckit-tasks 승인 뒤에만 생성
```

### Source Code (repository root)

```text
src/
├── features/exam/
│   ├── api/
│   │   ├── exam-grading-summary.ts     # GET summary lifecycle/result endpoint 통합
│   │   └── exam-grading-retry.ts       # POST exam-level retry
│   └── use-grading-status.ts           # count, polling, deadline, retry, completion
├── navigation/
│   └── types.ts                        # preview 제거, examId route 유지
├── screens/
│   ├── mock-exam/
│   │   ├── GradingWaitScreen.tsx       # 같은 screen 안의 phase 분기와 navigation
│   │   └── components/
│   │       ├── GradingRetryNotice.tsx  # 첫 실패/timeout retry CTA
│   │       ├── GradingFailedNotice.tsx # 최종 오류 + Home
│   │       └── GradingSheet.tsx        # count-only, 구조 변경 없음
│   └── my-page/
│       └── MyPageScreen.tsx            # preview 진입점 제거
└── types/
    └── exam.ts                         # polling의 4-state union
```

**Structure Decision**: 기존 Expo 단일 앱 구조와 exam feature/API 경계를 유지한다. 현재
`exam-grading-status.ts`와 `exam-grading-result.ts`가 서로 다른 경로를 가정하므로 확정된
`GET /summary` 책임은 `exam-grading-summary.ts` 한 파일로 모아 한 endpoint 한 파일 원칙을
지킨다. 화면은 navigation/rendering, hook은 lifecycle, `GradingSheet`는 표현만 담당한다.
재요청 POST는 별도 API 파일과 `retryExamGrading(examId)` 경계로 연결한다.

## Complexity Tracking

Constitution violation 없음.
