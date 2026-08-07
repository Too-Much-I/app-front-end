# Tasks: Part 4 표 가로 전체화면

**Input**: Design documents from `/specs/011-exam-landscape-mode/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Validation**: 자동 test runner가 구성되어 있지 않으므로 lint, typecheck, Expo config 생성 결과 확인과 quickstart의 기기 시나리오를 검증한다.

**Organization**: 공통 native 방향 기반을 먼저 만들고, 사용자 스토리별로 진입·열람, 시험 흐름 유지·복귀, 실패 복구를 구현한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일을 수정하며 미완료 태스크에 의존하지 않아 병렬 실행 가능
- **[Story]**: 명세의 사용자 스토리(US1, US2, US3)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Expo SDK 57 호환 native 방향 모듈과 iOS capability를 선언한다.

- [x] T001 Expo SDK 57 호환 `expo-screen-orientation ~57.0.1` 의존성을 `package.json`과 `pnpm-lock.yaml`에 추가한다
- [x] T002 `app.json`에 iPad `requireFullScreen`, screen-orientation `PORTRAIT_UP` 초기값과 runtime orientation support plugin을 선언하고 `plugins/with-ipad-portrait-only.js`를 `plugins/with-ios-runtime-orientation-support.js`로 교체한다

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 사용자 스토리가 공유하는 방향 상태와 native 요청 단일 소유권을 만든다.

**⚠️ CRITICAL**: 이 단계가 끝나기 전에는 가로 표 UI를 연결하지 않는다.

- [x] T003 [P] `src/features/orientation/orientation-context.ts`에 네 가지 orientation mode, derived 상태, enter/restore action의 strict TypeScript contract와 consumer hook을 정의한다
- [x] T004 `src/features/orientation/OrientationProvider.tsx`에 지원 여부 확인, serialized enter/restore, mount·foreground 재적용과 portrait fallback을 구현한다
- [x] T005 `App.tsx`에 `OrientationProvider`를 설치하고 `src/components/ui/PortraitOnlyNotice.tsx`가 명시적 가로 표 세션 동안만 기존 센서 안내를 억제하도록 연결한다

**Checkpoint**: 기본 화면은 세로로 유지되고 전역 provider가 방향 예외와 안내 정책을 함께 소유한다.

---

## Phase 3: User Story 1 - 표를 가로 전체화면으로 확인한다 (Priority: P1) 🎯 MVP

**Goal**: live Part 4 표의 전용 버튼으로만 가로 전체화면에 진입해 기존 표 정보 전체를 탐색한다.

**Independent Test**: Part 4 읽기 또는 Q8~Q10에서 버튼을 눌렀을 때만 가로 modal이 열리고, 표 전체와 복귀 제어만 표시되며 재답변과 다른 Part에는 버튼이 없는지 확인한다.

- [x] T006 [P] [US1] `src/components/exam/Part4Table.tsx`에 optional landscape action, 접근성 이름·상태, 최소 터치 영역을 추가하되 기존 `onReady`와 가로 grid scroll을 보존한다
- [x] T007 [P] [US1] `src/screens/mock-exam/components/ExamInformationReading.tsx`와 `src/screens/mock-exam/components/ExamQuestionContent.tsx`가 live Part 4 경로에서만 landscape callback을 전달하도록 props를 확장한다
- [x] T008 [US1] `src/screens/mock-exam/components/Part4TableLandscapeModal.tsx`에 full-screen native modal, status bar 숨김, safe area, 고정 복귀 제어, 세로·가로 scroll과 공용 `Part4Table` 재사용을 구현한다
- [x] T009 [US1] `src/screens/mock-exam/ExamSessionScreen.tsx`에서 현재 reading/question의 canonical Part 4 table을 파생하고 버튼 enter action과 modal 표시를 연결한다

**Checkpoint**: 전용 버튼으로 가로 표를 열고 모든 정보를 확인할 수 있으며 기본/비대상 화면은 기존 세로 동작을 유지한다.

---

## Phase 4: User Story 2 - 시험 흐름을 유지하며 원래 화면으로 돌아간다 (Priority: P1)

**Goal**: 가로 표가 열린 동안 timer/audio/recorder가 계속 진행되고 close/back으로 현재 시험 상태에 복귀한다.

**Independent Test**: 읽기·재생·준비·녹음 중 modal을 열고 닫아 남은 시간과 단계가 계속 진행되고 재생·녹음이 재시작되지 않으며 Android back이 시험을 이탈시키지 않는지 확인한다.

- [x] T010 [US2] `src/screens/mock-exam/ExamSessionScreen.tsx`와 `src/screens/mock-exam/components/Part4TableLandscapeModal.tsx`에서 close/Android back을 portrait restore로 처리하고 navigation focus, controller subtree와 modal table의 `onReady` 미전달을 보존한다
- [x] T011 [US2] `src/screens/mock-exam/ExamSessionScreen.tsx`가 reading→Q8 및 Q8→Q10 사이 canonical Part 4 table이 유효한 동안 modal을 유지하고 최신 phase를 그대로 드러내며 복귀하도록 통합한다

**Checkpoint**: 가로 표 presentation 변경이 시험 lifecycle을 멈추거나 다시 시작하지 않고 한 번의 close/back으로 현재 세로 시험 화면에 돌아온다.

---

## Phase 5: User Story 3 - 예외 상황에서도 세로 기본 상태로 복구한다 (Priority: P2)

**Goal**: 중복 입력, native lock 실패, Part 4 이탈, screen unmount와 background/foreground 전환 뒤에도 recoverable portrait 정책으로 끝난다.

**Independent Test**: unsupported/rejected lock, enter 중 close, 빠른 연속 입력, Part 4→Part 5, 시험 이탈과 background 복귀를 재현해 blank modal이나 일반 화면의 landscape lock이 남지 않는지 확인한다.

- [x] T012 [US3] `src/features/orientation/OrientationProvider.tsx`에서 overlapping enter/restore의 마지막 portrait 요청, idempotent restore, 실패 로그와 UI portrait fallback을 완성한다
- [x] T013 [US3] `src/screens/mock-exam/ExamSessionScreen.tsx`에서 active Part 4 table 소멸과 screen unmount 시 portrait restore를 요청하고 전환 중 중복 enter/close 상태를 modal에 반영한다

**Checkpoint**: 모든 종료·실패 경로가 시험을 막지 않고 기본 세로 정책과 기존 자세 안내를 복원한다.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 선언형 native 결과, 회귀 범위와 문서 추적성을 검증한다.

- [x] T014 [P] 기존 세로 전용 설계의 명시적 Part 4 예외와 iPad multitasking 제외 trade-off를 `docs/superpowers/specs/2026-08-07-portrait-only-notice-design.md`에 기록한다
- [x] T015 `pnpm exec expo config --type prebuild` 결과로 `app.json`과 `plugins/with-ios-runtime-orientation-support.js`가 full-screen, portrait initial mask, iPhone/iPad runtime orientation capability를 생성하는지 확인한다
- [x] T016 `pnpm lint`와 `pnpm exec tsc --noEmit`을 실행하고 모든 정적 검사 오류를 수정한다
- [x] T017 `specs/011-exam-landscape-mode/quickstart.md`의 iOS/Android 휴대폰·태블릿 시나리오를 가능한 범위에서 검증하고 실기기 또는 rebuild가 필요한 미실행 항목을 기록한다
- [x] T018 최종 diff를 `specs/011-exam-landscape-mode/spec.md`, `plan.md`, `tasks.md`, UI contract와 대조하고 `plan.md`의 Developer Explain-Back 항목을 재확인한다

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 즉시 시작한다.
- **Foundational (Phase 2)**: Setup 완료 후 시작하며 모든 사용자 스토리를 차단한다.
- **User Story 1 (Phase 3)**: Foundational 완료 후 시작한다.
- **User Story 2 (Phase 4)**: User Story 1의 modal과 screen integration에 의존한다.
- **User Story 3 (Phase 5)**: User Story 1·2의 진입/복귀 경로에 실패 및 이탈 복구를 더한다.
- **Polish (Phase 6)**: 구현하려는 모든 사용자 스토리 완료 후 실행한다.

### User Story Dependencies

- **US1 (P1)**: foundation 이후 독립적으로 전용 버튼과 table-only modal을 검증할 수 있다.
- **US2 (P1)**: US1의 modal을 사용하지만 시험 lifecycle 연속성과 복귀 결과를 별도로 검증할 수 있다.
- **US3 (P2)**: US1/US2의 정상 전환 위에 실패·중단 복구를 추가하며 각각의 오류 시나리오로 독립 검증할 수 있다.

### Within Each User Story

- shared table action과 parent props를 먼저 정의한 뒤 modal과 screen integration을 연결한다.
- native 요청은 provider를 통해서만 실행한다.
- `ExamSessionScreen.tsx`를 수정하는 태스크는 T009 → T010 → T011 → T013 순서로 실행한다.
- 자동 test runner가 없으므로 각 checkpoint에서 quickstart의 해당 수동 시나리오와 정적 타입 검증 가능성을 확인한다.

### Parallel Opportunities

- T003은 T002와 다른 파일이므로 native dependency/config 작업과 병렬로 설계할 수 있다.
- T006과 T007은 서로 다른 컴포넌트 파일을 대상으로 병렬 구현할 수 있다.
- T014는 runtime 구현 파일과 겹치지 않아 사용자 스토리 구현 이후 검증 준비와 병렬로 진행할 수 있다.

---

## Parallel Example: User Story 1

```text
Task T006: Part4Table optional landscape action 구현
Task T007: reading/question parent callback props 구현
```

T008은 T006의 공용 renderer contract에, T009는 T007·T008의 props와 modal에 의존하므로 그 뒤에 순차 실행한다.

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup 완료
2. Phase 2 Foundational 완료
3. Phase 3 User Story 1 완료
4. Part 4 button-only 진입, table-only modal, 비대상 화면 회귀 검증

### Incremental Delivery

1. Setup + Foundational → 기본 portrait 정책과 runtime coordinator 준비
2. US1 → 전용 버튼과 가로 table-only modal
3. US2 → timer/audio/recorder 연속성과 close/back 복귀
4. US3 → 실패, 이탈, background와 race 복구
5. Polish → config/static/manual 검증과 최종 추적성 확인

## Notes

- `[P]` 태스크만 미완료 의존성이 없고 파일 충돌 없이 병렬 실행 가능하다.
- generated `ios/`, `android/` 파일은 수정하거나 커밋하지 않는다.
- 재답변의 `Part4Table`에는 callback을 넘기지 않아 범위 밖 상태를 보존한다.
- 커밋, push 또는 외부 이슈 수정은 이 작업에 포함하지 않는다.
