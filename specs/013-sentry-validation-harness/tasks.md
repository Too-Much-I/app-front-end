---

description: "Sentry 오류 카탈로그 검증 도구 구현 작업"

---

# Tasks: Sentry 오류 카탈로그 검증 도구

**Input**: Design documents from `/specs/013-sentry-validation-harness/`

**Prerequisites**: Approved spec.md and plan.md, research.md, data-model.md, contracts/, quickstart.md

**Validation**: 자동 test runner가 없으므로 exhaustive typecheck, source/privacy audit, lint, native
bundle, Android Emulator와 실제 Sentry 수신 검증을 수행한다.

**Organization**: 개발 전용 gate와 공용 preview/capture receipt를 먼저 만든 뒤, 15개 fixture,
진단 화면, production 격리와 실제 delivery 검증 순서로 진행한다.

## Phase 1: Setup

**Purpose**: 기존 15개 catalog와 app/Sentry 초기화 경계를 확정한다.

- [x] T001 `src/lib/operational-error-reporting.ts`, `src/lib/sentry.ts`, `App.tsx`, `index.ts`의 현재 catalog·초기화·privacy 흐름을 `specs/013-sentry-validation-harness/contracts/sentry-validation-contract.md`와 대조한다

---

## Phase 2: Foundational

**Purpose**: 모든 검증 story가 공유하는 개발 전용 gate와 safe preview/capture receipt를 구현한다.

- [x] T002 `src/lib/sentry-validation-mode.ts`에 `__DEV__`와 명시적 환경 flag를 모두 요구하는 validation mode와 synthetic environment/tag 상수를 구현한다
- [x] T003 `src/lib/operational-error-reporting.ts`에서 실제 capture와 같은 safe payload preview 및 throw-free receipt를 반환하도록 reporter 경계를 확장한다
- [x] T004 `src/lib/sentry.ts`에서 validation environment/tag, capture event ID와 throw-free flush 결과를 제공하되 기존 production message/fingerprint를 유지한다

**Checkpoint**: 외부 전송 없이 safe payload를 확인하고, 승인된 모드에서만 같은 payload를 capture할 기반이 준비된다.

---

## Phase 3: User Story 1 - 15개 오류를 안전하게 주입한다 (Priority: P1) 🎯 MVP

**Goal**: 실제 API나 사용자 데이터를 건드리지 않고 기존 15개 code를 개별/전체 preview 및 capture할 수 있다.

**Independent Test**: typed fixture mapping과 로컬 preview를 실행해 code 15/15, expected feature/context와 forbidden field 0건을 확인한다.

- [x] T005 [US1] `src/features/diagnostics/sentry-validation-catalog.ts`에 `OperationalErrorCode` 전수 mapping으로 15개 안전 fixture와 화면 설명을 구현한다
- [x] T006 [US1] `src/features/diagnostics/sentry-validation-catalog.ts`에 개별 preview와 15개 순차 capture 결과를 만드는 validation run 함수를 구현한다
- [x] T007 [US1] `src/features/diagnostics/sentry-validation-catalog.ts`와 `src/lib/operational-error-reporting.ts`를 source audit해 fixture/receipt에 ID·URL·URI·path·token·body·message·본문·raw cause가 남지 않음을 확인한다

**Checkpoint**: 15개 catalog를 같은 reporting/privacy 경계로 안전하게 합성할 수 있다.

---

## Phase 4: User Story 2 - 에뮬레이터에서 결과를 판별한다 (Priority: P1)

**Goal**: Android Emulator 화면에서 local preview, code별 event ID, flush와 15/15 집계를 판별한다.

**Independent Test**: `Pixel_8`에서 validation root를 열고 preview 15/15와 capture/flush 상태 UI를 확인한다.

- [x] T008 [US2] `src/screens/diagnostics/SentryValidationScreen.tsx`에 15개 목록, 개별 preview/capture, 전체 전송 single-flight, event ID, flush 및 집계 UI를 공유 Text/Pressable/theme/SafeArea로 구현한다
- [x] T009 [US2] `App.tsx`에서 validation mode일 때 auth/navigation을 우회하고 `SentryValidationScreen`을 독립 root로 렌더링한다
- [x] T010 [US2] `index.ts`에서 validation mode에는 Sentry만 초기화하고 Clarity를 실행하지 않도록 분리한다
- [x] T011 [US2] `Pixel_8` Android Emulator에서 validation 화면 진입과 local preview 15/15를 확인하고 결과를 `specs/013-sentry-validation-harness/quickstart.md`에 기록한다

**Checkpoint**: 실제 모바일 실행 환경에서 외부 전송 전 15개 safe payload를 판별할 수 있다.

---

## Phase 5: User Story 3 - 운영 노출과 외부 오염을 방지한다 (Priority: P2)

**Goal**: 합성 검증을 production과 분리하고 승인된 정확히 15건만 Sentry에서 확인한다.

**Independent Test**: validation off bundle에서 진입점이 없음을 확인하고, validation run 한 번의 event ID 15개를 Sentry time window 조회와 대조한다.

- [x] T012 [US3] `src/lib/sentry-validation-mode.ts`, `App.tsx`, `index.ts`를 감사해 `__DEV__`와 explicit flag 이중 gate 및 validation mode 외 기존 app 동작 불변을 확인한다
- [x] T013 [US3] `src/screens/diagnostics/SentryValidationScreen.tsx`에서 반복 tap, background/unmount와 completed run 재호출이 추가 이벤트를 만들지 않도록 run lifecycle을 완성한다
- [x] T014 [US3] `Pixel_8` Android Emulator에서 전체 전송을 정확히 한 번 실행해 event ID 15개와 flush success를 확인한다
- [x] T015 [US3] Sentry project `tmi-wh/tosunsaeng-app`에서 `environment:synthetic-validation synthetic_validation:true`의 이번 time window 15건 수신을 확인하고, emulator의 code/event ID 및 local preview의 forbidden field 0건과 대조한다

**Checkpoint**: 합성 이벤트가 운영 이벤트와 분리되고 emulator와 Sentry 양쪽에서 15/15로 대조된다.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 품질 게이트와 문서 기록을 완료하고 승인된 설계와 diff를 수렴시킨다.

- [x] T016 `CI=true pnpm lint`를 실행하고 결과를 `specs/013-sentry-validation-harness/quickstart.md`에 기록한다
- [x] T017 `CI=true pnpm exec tsc --noEmit`을 실행하고 결과를 `specs/013-sentry-validation-harness/quickstart.md`에 기록한다
- [x] T018 `CI=true pnpm exec expo export --platform all --output-dir /tmp/app-front-end-sentry-validation-dist`로 iOS/Android bundle을 검증하고 결과를 기록한다
- [x] T019 `git diff --check`와 최종 source/privacy/catalog audit를 수행해 `specs/013-sentry-validation-harness/quickstart.md` completion record를 마친다
- [x] T020 spec.md, plan.md, tasks.md와 현재 코드를 수렴 검토하고 일반 app 회귀·Sentry delivery 제한·미해결 항목을 기록한다

---

## Dependencies & Execution Order

- Phase 1 → Phase 2가 모든 story를 차단한다.
- US1 fixture/preview가 US2 화면을 차단한다.
- US2 emulator local 검증이 US3 실제 외부 전송을 차단한다.
- US3는 production gate audit 뒤 정확히 한 번 전송하고 read-only Sentry 조회로 끝낸다.
- Polish는 실제 delivery 검증까지 끝난 뒤 수행한다.

## Parallel Opportunities

- T002–T004는 같은 reporting boundary에 연결되므로 충돌 방지를 위해 순차 수행한다.
- T008 구현 중 T009/T010은 app root 파일이 달라도 화면 export에 의존하므로 순차 수행한다.
- T016–T018은 구현 완료 후 논리적으로 독립적이나 dependency state와 output 안정성을 위해 순차 실행한다.

## Implementation Strategy

1. T001–T004로 validation gate와 safe receipt foundation을 만든다.
2. T005–T007로 15개 typed fixture와 privacy-safe preview를 완성한다.
3. T008–T011로 진단 UI와 emulator local 15/15를 검증한다.
4. T012–T015로 production 격리 뒤 승인된 Sentry 15건을 한 번 보내고 수신을 대조한다.
5. T016–T020으로 정적·bundle·diff와 Spec Kit 수렴을 완료한다.

## Notes

- 실제 Sentry 합성 이벤트 15건 전송은 사용자가 2026-08-12에 승인했다.
- 실제 feature API나 사용자 데이터를 고의로 실패시키지 않는다.
- commit, push, Jira write, Sentry issue 수정·삭제는 포함하지 않는다.
