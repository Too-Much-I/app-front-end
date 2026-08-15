# Implementation Plan: Sentry 운영 오류 보고 범위

**Branch**: `feat/#TMI-84` (feature ID: `012-sentry-error-reporting`) | **Date**: 2026-08-12 |
**Spec**: [spec.md](./spec.md) | **Requirements**: [requirements.md](./requirements.md)

**Approval**: Approved 2026-08-12 — 사용자가 "진행해"라고 요청해 이 계획의 task 생성과
구현 진행을 승인했다.

**Input**: Feature specification from `/specs/012-sentry-error-reporting/spec.md`

## Summary

기존 Sentry 초기화와 전역 crash 수집 위에 typed 운영 오류 카탈로그를 둔다. 수동 이벤트는
catch 지점이 아니라 각 기능 소유자가 사용자 실패 상태를 확정하는 지점에서 안정된 code와
허용 목록 metadata만 전달한다. 공용 reporter는 raw error를 전송하지 않고 API status/code와
제한된 분류만 정규화한다. 자동 재시도, 취소, 권한 거부와 background abort는 caller의 기존
상태 규칙에서 제외하고, WebView 등 중복 callback 가능 경로만 작업 소유 ref로 한 번 보고한다.

## Technical Context

**Language/Version**: strict TypeScript 6.0, React 19.2

**Primary Dependencies**: Expo 57, React Native 0.86, `@sentry/react-native` 7.11; 새 dependency 없음

**Storage**: N/A — 오류 보고 상태는 화면·controller 수명 동안만 유지하며 영속 식별자를 만들지 않음

**Testing**: `pnpm lint`, `pnpm exec tsc --noEmit`, `git diff --check`, Expo native bundle export,
15종 failure-injection matrix와 Sentry 프로젝트 수신 확인; 자동 test runner는 구성되어 있지 않음

**Target Platform**: Expo 기반 iOS 및 Android production native build

**Project Type**: React Native mobile application

**Performance Goals**: 실패 상태 전환에서 동기 네트워크 대기나 UI 지연을 만들지 않고, 정상
경로에는 이벤트·추가 렌더·추가 API 요청을 만들지 않을 것

**Constraints**: raw exception/message/body/URL/ID/audio URI 전송 금지, 낮은 cardinality tag만 허용,
기존 timeout·retry·UI 상태 보존, Sentry 비활성 또는 SDK 실패가 앱 흐름을 바꾸지 않을 것

**Scale/Scope**: 15개 수동 오류 code, 인증·시험·피드백·재답변·설정의 약 20개 terminal
transition, 기존 자동 crash/privacy filter 1개

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] The specification is approved and separates facts, assumptions, scope, out-of-scope behavior, and open questions.
- [x] Acceptance criteria describe observable behavior and include failure or interruption paths.
- [x] The design uses Expo/React Native APIs and preserves strict TypeScript and existing architectural boundaries.
- [x] Existing shared UI, theme, navigation, API, mapper, and domain layers are reused where applicable.
- [x] At least two viable approaches were considered, or the plan explains why only one approach is practical.
- [x] The validation plan includes `pnpm lint`, `pnpm exec tsc --noEmit`, and relevant manual or device checks.
- [x] No secret or unapproved Jira write, commit, push, dependency addition, or other external side effect is required.

**Pre-research gate**: PASS. **Post-design re-check**: PASS. 설계는 기존 SDK와 상태 소유자를
재사용하고 dependency, navigation, storage, UI 또는 외부 쓰기를 추가하지 않는다. 실제 Sentry
수신 검증은 별도 승인을 받은 검증 환경에서만 수행한다.

## Current Flow

1. `index.ts`가 다른 초기화보다 먼저 `initializeSentry()`를 실행하고 `withSentry(App)`으로 root를
   감싼다. `EXPO_PUBLIC_ENABLE_SENTRY=true`인 빌드만 SDK를 초기화한다.
2. `src/lib/sentry.ts`는 default PII를 끄고 request header/cookie/data, user, 알려진 ID·token
   key를 `beforeSend`와 breadcrumb 단계에서 제거한다. trace sampling은 0이다.
3. 처리되지 않은 JS/native crash와 React render error는 SDK가 자동 보고한다.
4. catch한 오류 대부분은 console과 사용자 상태에만 남는다. 유일한 수동 event는 종합 피드백
   재생성의 접수·poll·timeout 실패이며 `FeedbackScreen`의 공유 operation 안에서 호출된다.
5. 인증은 `AuthController.setRetry`, 시험 session은 `SoundTestScreen`, 필수 audio는 sound test와
   cue components, prelude는 session controller가 terminal 사용자 상태를 소유한다.
6. live 답변은 recorder와 submission registry, 시험 채점은 `useGradingStatus`, 재답변은 question·
   recorder·submission hook이 각각 terminal 상태를 소유한다. 여러 네트워크 catch는 정상적으로
   재시도하거나 background에서 pause되므로 catch 자체는 reporting 시점이 아니다.
7. 피드백 WebView는 `onError`, `onHttpError`, `renderError`가 같은 load failure에서 중복 호출될
   수 있다. native data bridge와 history 화면은 별도 실패 상태를 가진다.

## Design Options

### Option A - Typed central reporter + terminal owner reporting

공용 module에 15개 오류 code와 code별 허용 context를 discriminated union으로 정의한다. reporter는
stable message/fingerprint/tag를 만들고 raw error에서는 허용된 API status/code만 추출한다. 각
feature는 terminal state를 확정하는 기존 함수에서 reporter를 호출하고, 중복 callback이 실제로
있는 owner만 ref/set으로 시도 범위를 지킨다.

- 장점: compile-time에 code별 허용 데이터를 제한하고 raw error 실수 전송을 막는다. 기존 retry와
  cancellation 의미를 가장 잘 알고 있는 owner가 정확한 시점을 결정한다.
- 비용: 여러 feature 파일에 작고 명시적인 호출이 추가된다. 중복 기준이 다른 owner별 guard를
  검토해야 한다.
- 실패 모드: 새 terminal 경로가 생겼는데 호출을 빠뜨릴 수 있어 contract table과 source scan을
  함께 유지해야 한다.

### Option B - 공용 API/console 계층에서 모든 오류 자동 보고

`serviceFetch`나 console interception에서 throw/catch되는 오류를 일괄 보고한다.

- 장점: 연결 파일 수가 적고 네트워크 오류를 빠짐없이 관측할 수 있다.
- 비용: 자동 재시도 중간 실패, background abort, 사용자에게 영향 없는 조회까지 대량 보고하며
  같은 사용자 장애가 여러 API event로 분해된다. feature terminal 의미와 재시도 경계를 알 수 없다.
- 실패 모드: 쿼터와 빈도를 왜곡하고 request URL/body 및 서버 원문 노출 위험이 커진다.

### Option C - 오류 UI가 렌더될 때 화면에서 보고

각 error panel/component가 mount되거나 status prop을 받을 때 보고한다.

- 장점: 사용자가 실제 오류 UI를 봤다는 조건과 가깝다.
- 비용: 렌더/effect 반복, navigation focus와 orientation 변화로 중복되며, UI가 없는 answer job
  단위 실패와 background terminal state를 놓친다.
- 실패 모드: React lifecycle이 작업 attempt와 같지 않아 중복·누락 기준이 불안정하다.

## Decision

Option A를 선택한다. `src/lib/sentry.ts`는 SDK 초기화·공통 scrub 책임을 유지하고, 새
`src/lib/operational-error-reporting.ts`가 공개 오류 code, code별 typed context, safe API error
분류와 안정된 `captureMessage` 호출을 소유한다. raw error/message/body는 함수 입력으로 받더라도
전송 객체에 넣지 않으며, `ApiError`에서는 number status와 bounded server code만 sanitize한다.

각 terminal owner는 상태를 바꾸는 같은 분기에서 보고한다. 답변 submission은 `markFailed`가
job key와 error code 기준 중복을 막고, user retry로 job이 pending이 되면 새 attempt generation을
올린다. WebView load는 reload nonce별 ref, audio cue는 component playback generation, auth는
`setRetry` 호출별 bootstrap/retry attempt로 묶는다. 일반적으로 한 번만 실행되는 catch에는 별도
전역 dedupe cache를 두지 않는다. 전역 cache는 다른 사용자의 정상적인 새 시도를 오탐으로
억제하고 내부 ID를 장기간 보유하기 때문이다.

공통 `beforeSend`는 request URL 자체, request headers/cookies/data, user와 민감 key를 제거하고,
breadcrumb/context/extra의 URL·token·ID·audio URI key를 recursive scrub한다. 수동 event는 애초에
허용 목록만 생성하고 scrub은 방어선으로 유지한다. 기존 summary feedback code는 새 catalog의
`SUMMARY_FEEDBACK_RETRY_FAILED`로 통일하고 requestId는 전송 context에서 제거한다.

## Failure and Recovery Paths

- Sentry가 비활성화되면 reporter는 즉시 return하고 상태 전환은 그대로 진행한다.
- SDK 호출은 사용자 상태를 소유하지 않는다. 예외가 발생해도 swallow하여 원래 실패 UI와
  retry 동작을 보존한다.
- automatic retry/polling catch는 기존처럼 조용히 다음 시도를 예약한다. terminal helper에서만
  report하므로 중간 오류가 유출되지 않는다.
- permission denied, user cancel, unmount/background abort와 cancelled result는 명시적으로
  reporter 이전에 return한다.
- live grading 첫 attempt 실패는 `retry-ready`만 만들고 보내지 않는다. 두 번째 attempt 또는
  retry request가 `terminal-error`를 만들 때만 한 번 보낸다.
- feedback WebView의 onError/onHttpError/renderError는 같은 reload generation에서 ref guard를
  공유한다. 사용자가 reload하면 generation이 바뀌어 새 실패 한 건을 허용한다.
- answer submission은 여러 question job을 독립 attempt로 보고하되 같은 job의 자동 retry는
  하나의 attempt다. user retry만 generation을 올린다.
- summary feedback의 여러 requestId가 같은 exam operation을 공유하면 operation 생성 지점에서만
  한 번 보고하고, requestId/examId는 보내지 않는다.
- reporting 변경을 rollback하면 reporter 호출과 module만 제거하면 된다. 사용자 상태·API·UI
  계약은 수정하지 않으므로 동작 rollback 위험이 낮다.

## Validation Coverage

| Verification layer | What can be confirmed | Environment needed |
|---|---|---|
| Static/type validation | 15 codes, typed allowed context, all terminal call sites, forbidden raw fields | Current workspace |
| Local failure injection | per-attempt timing, no intermediate/cancel events, dedupe and unchanged UI | iOS/Android development build or simulator |
| Bundle validation | SDK integration and native bundle compilation | Expo export/native build toolchain |
| Sentry delivery | final scrubbed payload, grouping, release/environment and exact event counts | Sentry-enabled validation build, network and project access |

따라서 15종 모두 **생성 조건과 payload**는 구현 후 확인할 수 있다. 실제 Sentry 서버 수신까지의
전수 확인은 외부 event write이므로 사용자의 별도 승인과 Sentry 접근 가능한 검증 빌드가 필요하다.

## Developer Explain-Back

- [x] The affected files and their responsibilities can be explained.
- [x] The changed data and state transitions can be described in order.
- [x] The selected tradeoffs and rejected alternatives can be explained.
- [x] The validation and rollback approach can be explained.

## Project Structure

### Documentation (this feature)

```text
specs/012-sentry-error-reporting/
├── requirements.md
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── operational-error-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── sentry.ts                         # SDK init and final privacy scrub
│   └── operational-error-reporting.ts   # typed catalog, safe classification, capture
├── features/
│   ├── auth/auth-controller.ts           # auth terminal retry state
│   └── exam/
│       ├── use-answer-recorder.ts        # recording terminal failure
│       ├── use-answer-submissions.ts     # live answer terminal jobs and attempts
│       ├── use-grading-status.ts         # retry-after-terminal grading failure
│       ├── use-reanswer-question.ts      # question load terminal failure
│       └── use-reanswer-submission.ts    # reanswer submit/grading terminal failure
└── screens/
    ├── feedback/
    │   ├── FeedbackScreen.tsx            # page/data/summary retry failures
    │   └── components/ExamHistoryScreen.tsx
    ├── home/use-recent-feedback.ts
    ├── mock-exam/
    │   ├── SoundTestScreen.tsx            # session create/required audio
    │   ├── hooks/use-exam-session-controller.ts
    │   └── components/Exam*Cue.tsx        # required cue playback
    ├── reanswer/ReanswerScreen.tsx        # recording recovery transition
    └── settings/use-delete-learning-records.ts
```

**Structure Decision**: SDK-specific init/scrub과 product error taxonomy를 분리한다. 실패 timing과
attempt lifecycle은 새 service로 옮기지 않고 이미 해당 상태를 소유한 hook/controller에 남긴다.
UI와 API contract는 바뀌지 않으며 navigation 변경도 없다.

## Complexity Tracking

해당 없음. Constitution 예외나 새 dependency가 필요하지 않다.
