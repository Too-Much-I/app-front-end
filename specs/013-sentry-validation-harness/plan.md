# Implementation Plan: Sentry 오류 카탈로그 검증 도구

**Branch**: `013-sentry-validation-harness` | **Date**: 2026-08-12 | **Spec**: [spec.md](spec.md)

**Approval**: Draft plans MUST be approved before tasks or implementation begin.

**Input**: Feature specification from `/specs/013-sentry-validation-harness/spec.md`

## Summary

개발 빌드에서만 선택되는 독립 검증 루트와 15개 typed fixture를 추가한다. 로컬 preview는 기존
운영 오류의 안전한 payload 생성 함수를 그대로 사용하고, 실제 전송은 동일한 Sentry capture 경계를
통과한다. 검증 모드의 Sentry environment와 tag를 고정해 일반 운영 이벤트와 분리하며, 에뮬레이터
화면의 15개 event ID·flush 결과와 Sentry의 동일 시간대 조회 결과를 대조한다.

## Technical Context

**Language/Version**: TypeScript 6.0 strict, React 19.2, React Native 0.86

**Primary Dependencies**: Expo 57, `@sentry/react-native` 7.11, NativeWind 4, existing shared UI primitives

**Storage**: 영속 저장 없음; 현재 검증 실행과 결과만 화면 메모리에 유지

**Testing**: 자동 test runner 없음; oxlint, TypeScript no-emit, Expo iOS/Android export, Android
Emulator 수동 검증, Sentry read-only event 조회

**Target Platform**: Android Emulator `Pixel_8`; 일반 iOS/Android production build에는 진입점 없음

**Project Type**: Expo/React Native mobile application

**Performance Goals**: 15개 로컬 preview 즉시 표시, 15개 capture와 flush를 2분 이내 완료

**Constraints**: 새 dependency 없음, 실제 API·사용자 데이터 접근 없음, `__DEV__`와 명시적 validation
flag 이중 gate, 합성 이벤트 정확히 15건, 기존 운영 report call site 동작 불변

**Scale/Scope**: 15 fixtures, 독립 진단 화면 1개, Sentry reporting 경계와 app root의 최소 확장

## Constitution Check

*GATE: Phase 0 전 및 Phase 1 설계 후 재검사 완료.*

- [x] 명세가 2026-08-12 승인됐고 사실, 가정, 범위, 범위 밖과 열린 질문을 구분한다.
- [x] 수용 기준은 15/15, privacy, 중복, background, 비활성·전송 실패를 관찰 가능하게 정의한다.
- [x] Expo/React Native와 strict TypeScript를 유지하고 기존 typed operational reporter를 재사용한다.
- [x] 공유 `Text`, `Pressable`, theme token과 SafeArea를 사용하며 API·mapper 계층은 건드리지 않는다.
- [x] 독립 검증 루트, 실제 경로 fault injection, host script 세 대안을 비교했다.
- [x] lint, typecheck, bundle, Android Emulator와 Sentry 수신 검증을 포함한다.
- [x] dependency, secret, Jira, commit, push 변경은 없고 외부 Sentry 합성 이벤트 15건은 사용자가
  2026-08-12에 명시적으로 승인했다. Sentry 조회는 read-only다.

## Current Flow

1. `index.ts`가 Sentry를 먼저 초기화하고 Clarity를 초기화한 뒤 `withSentry(App)`을 등록한다.
2. `App.tsx`는 orientation/auth provider를 거쳐 인증 상태가 준비돼야 일반 navigation을 그린다.
3. 각 terminal owner가 `reportOperationalError(OperationalErrorInput)`을 호출한다.
4. `src/lib/operational-error-reporting.ts`가 code별 feature와 primitive allowlist context를 만들고 raw
   cause는 제한된 HTTP status/server code로만 분류한다.
5. `src/lib/sentry.ts`가 fixed message/fingerprint/tags/context로 capture하고 `beforeSend`에서 자동
   request/user/breadcrumb/context/extra/exception을 최종 정제한다.
6. 현재 reporter는 반환값이 없고, 개발 앱에서 15개를 독립 합성하거나 정제 결과·event ID·flush를
   확인할 진입점이 없다.

## Design Options

### Option A - 독립 개발 검증 루트와 기존 reporter 재사용

`__DEV__`와 명시적 환경 flag가 모두 참일 때 인증/navigation 대신 진단 화면을 렌더링한다. 15개
fixture가 기존 preview/capture 경계를 사용하며 event ID와 flush 결과를 화면에 남긴다.

- 장점: 서버·마이크·시험 데이터가 필요 없고 정확히 15개를 재현 가능하다. 인증 bootstrap이나
  Clarity가 별도 외부 이벤트를 만들지 않는다. 같은 typed/scrub 경계를 직접 검증한다.
- 비용: 실제 15개 terminal UI 전환 자체를 재현하는 통합 검증은 아니다.
- 실패 모드: flag 누락 시 일반 앱이 열리며, Sentry 비활성 시 preview만 되고 event ID가 없다.

### Option B - 실제 사용자 경로에 fault injection 추가

인증, 오디오, recorder, API와 polling 각각에 개발용 실패 switch를 넣고 실제 화면을 순회한다.

- 장점: terminal 상태 전환과 owner-local dedupe까지 end-to-end로 검증한다.
- 비용: 15개 subsystem에 분산된 test hook이 제품 코드와 상태를 크게 오염시키고, backend fixture와
  긴 timeout 제어가 필요하다. 정확히 15건을 안정적으로 재현하기 어렵다.
- 실패 모드: hook이 production에 남거나 실제 답변·삭제 흐름을 건드릴 위험이 있다.

### Option C - 호스트 스크립트에서 SDK 호출

모바일 앱 밖의 script가 15개 payload를 구성하고 Sentry에 보낸다.

- 장점: 구현과 실행이 가장 짧다.
- 비용: React Native SDK 초기화, `beforeSend`, 앱 환경과 bundle gate를 통과하지 않아 에뮬레이터
  검증 요구를 충족하지 못한다.
- 실패 모드: script 전송 성공을 앱 통합 성공으로 오인한다.

## Decision

Option A를 선택한다. 이번 목표는 실제 장애 데이터를 만들지 않고 15개 catalog와 공용 privacy/Sentry
경계를 에뮬레이터에서 확인하는 것이다. Option B는 terminal UI 통합 검증이 더 깊지만 위험과 변경
면적이 과도하고, Option C는 모바일 통합을 검증하지 못한다.

구체적으로:

- `src/features/diagnostics/sentry-validation-catalog.ts`가 `OperationalErrorCode` 전수 mapping으로
  15개 fixture를 정의한다. `Record<OperationalErrorCode, ...>`/`satisfies`로 code 변화 시 compile
  failure가 나게 한다.
- operational reporter는 안전 payload preview와 capture receipt를 반환한다. 기존 caller는 반환값을
  무시하므로 제품 동작은 바뀌지 않는다.
- Sentry capture는 event ID를 반환하고 validation mode에서만 environment
  `synthetic-validation`, tag `synthetic_validation=true`를 붙인다. `flush()` 결과를 검증 화면에
  제공하되 전송 실패는 throw하지 않는다.
- `src/screens/diagnostics/SentryValidationScreen.tsx`는 개별 preview/capture, 전체 15건 전송, 코드별
  event ID, flush 성공/실패와 15/15 집계를 표시한다. 전체 전송 버튼은 실행 중 및 같은 screen run
  완료 뒤 잠가 중복을 막는다.
- `App.tsx`는 validation mode에서 auth/navigation을 우회한 독립 화면을 선택한다. `index.ts`는 이
  모드에서 Sentry는 초기화하지만 Clarity는 초기화하지 않는다.
- 빌드 선택은 `__DEV__ && EXPO_PUBLIC_SENTRY_VALIDATION_MODE === "true"`로 이중 제한한다. production
  build에서는 env 값이 잘못 들어가도 진입점이 없다.
- 실제 수신은 emulator 전체 전송 직전 시간을 기록하고 Sentry에서
  `environment:synthetic-validation synthetic_validation:true`와 해당 시간 window로 조회해 15개
  code/event ID를 대조한다. 기존 auth token에 read 권한이 없으면 외부 수신 확인만 사용자 대시보드
  query로 수행하고 그 제한을 보고한다.

## Failure and Recovery Paths

- validation flag 또는 `__DEV__` 조건이 맞지 않으면 일반 앱이 열리며 이벤트를 보내지 않는다.
- Sentry enable flag가 꺼져 있으면 화면은 15개 safe preview를 표시하지만 전송 가능 상태가 아님을
  명시하고 전체 전송을 막는다.
- capture 한 건이 event ID를 반환하지 않으면 해당 code만 실패로 기록하고 다음 fixture를 계속한다.
- capture 뒤 flush가 false이거나 throw하면 15개를 수신 완료로 표시하지 않는다. 사용자 흐름에는
  throw하지 않고 재실행 가능한 실패 상태를 표시한다.
- 전체 전송 중 background/unmount가 발생하면 화면 state 갱신을 중단한다. 이미 capture된 이벤트는
  취소할 수 없으므로 재실행 전에 Sentry time window를 새로 잡고 이전 run과 구분한다.
- 반복 탭은 single-flight guard가 막는다. 완료한 동일 screen run에서는 다시 보내지 않고 명시적인
  reset이 새 run을 만든다.
- Sentry read API가 권한 또는 network로 실패하면 emulator의 event IDs/flush 결과는 보존하고,
  대시보드 검색어와 시간 범위를 제공해 수동 확인한다.
- 실제 Sentry 결과가 15건보다 적으면 누락 code/event ID를 기록하고 동일 run을 무작정 재전송하지
  않는다. 원인을 수정한 뒤 새 time window에서 새 run을 승인 범위 안에서 한 번 수행한다.

## Developer Explain-Back

- [ ] validation mode가 왜 일반 auth/navigation과 분리되는지 설명할 수 있다.
- [ ] fixture → safe preview → capture receipt → flush → Sentry 조회 흐름을 순서대로 설명할 수 있다.
- [ ] 실제 경로 fault injection과 host script를 선택하지 않은 이유를 설명할 수 있다.
- [ ] 정확히 15건, privacy, production gate와 실패 시 재검증 절차를 설명할 수 있다.

## Project Structure

### Documentation (this feature)

```text
specs/013-sentry-validation-harness/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── sentry-validation-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
App.tsx
index.ts
src/
├── features/
│   └── diagnostics/
│       └── sentry-validation-catalog.ts
├── lib/
│   ├── operational-error-reporting.ts
│   ├── sentry.ts
│   └── sentry-validation-mode.ts
└── screens/
    └── diagnostics/
        └── SentryValidationScreen.tsx
```

**Structure Decision**: 일반 navigation에 route를 추가하지 않고 app root에서 compile/runtime gated
진단 화면을 선택한다. fixture는 feature 계층, SDK 경계는 lib, 화면은 diagnostics screen 책임으로
나눠 기존 구조를 따른다.

## Complexity Tracking

해당 없음. 새 dependency, production route, API 또는 별도 test framework를 추가하지 않는다.
