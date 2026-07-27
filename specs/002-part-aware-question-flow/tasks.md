# Tasks: 파트별 시험 흐름과 복구 접근성

**Input**: Design documents from `/specs/002-part-aware-question-flow/`

**Prerequisites**: Approved `spec.md`, approved `plan.md`, `research.md`, `data-model.md`,
`contracts/`, `quickstart.md`

**Validation**: 자동 테스트 러너가 없으므로 lint, strict typecheck, diff check와 mock/실기기 수동
검증을 사용한다.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 기존 Expo 구조와 검증 경계를 확인한다.

- [X] T001 Verify existing Expo, NativeWind, expo-audio, safe-area, and ignore configuration against `package.json`, `.gitignore`, and `specs/002-part-aware-question-flow/plan.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 story가 공유하는 정규화된 prelude 계약을 구현한다.

- [X] T002 Define serializable valid/invalid part prelude domain unions and add them to `ExamSession` in `src/types/exam.ts`
- [X] T003 Create Part 3 audio source resolution and Part 3/4 validation helpers in `src/features/exam/part-prelude.ts`
- [X] T004 Normalize Part 3 data and the canonical shared Part 4 table in `src/features/exam/map-exam-session.ts`
- [X] T005 Add the bundled Part 3 guide logical URL to the mock response in `src/features/exam/mocks/exam-session.ts`

**Checkpoint**: UI는 raw optional 조합이 아니라 valid/invalid prelude만 소비할 수 있다.

---

## Phase 3: User Story 1 - 파트에 맞는 사전 정보를 확인한다 (Priority: P1) 🎯 MVP

**Goal**: Part 3 상황 안내와 Part 4 표 읽기를 첫 문제 전의 별도 단계로 제공한다.

**Independent Test**: Part 3/4 첫 진입에서 사전 단계가 각각 한 번만 나타나고 정상 완료 뒤
Q5/Q8 준비로 이동하며, 동일 표가 Part 4 준비 화면과 Q8~Q10 모두에 표시되는지 확인한다.

- [X] T006 [P] [US1] Extract the reusable neutral information table in `src/screens/mock-exam/components/ExamInformationTable.tsx`
- [X] T007 [P] [US1] Implement Part 3 intro text and guide audio lifecycle in `src/screens/mock-exam/components/ExamPartIntroContent.tsx`
- [X] T008 [P] [US1] Implement the table-only Part 4 reading presentation in `src/screens/mock-exam/components/ExamInformationReading.tsx`
- [X] T009 [US1] Add explicit Part 3 intro and Part 4 visible-time reading phases and guarded transitions in `src/screens/mock-exam/hooks/use-exam-session-controller.ts`
- [X] T010 [US1] Render the new phases, bridge focus/AppState, and reuse the canonical table in `src/screens/mock-exam/ExamSessionScreen.tsx` and `src/screens/mock-exam/components/ExamQuestionContent.tsx`
- [X] T011 [US1] Add the `READING TIME` timer presentation in `src/screens/mock-exam/components/ExamTimerCard.tsx`

**Checkpoint**: Part 3/4 사전 단계와 기존 문제별 준비/응답 단계가 서로 섞이지 않는다.

---

## Phase 4: User Story 2 - 실패한 답변을 끝까지 확인하고 복구한다 (Priority: P1)

**Goal**: 긴 제출 실패 목록의 마지막 복구 버튼까지 안전 영역 위에서 접근할 수 있게 한다.

**Independent Test**: 11개 실패 항목과 큰 글자에서 첫 항목부터 마지막 retry 버튼까지 스크롤하고
누를 수 있는지 확인한다.

- [X] T012 [US2] Replace the final submission branch with a safe-area vertical scroll layout in `src/screens/mock-exam/ExamSessionScreen.tsx`
- [X] T013 [US2] Use neutral natural-height failure cards with stable actions in `src/screens/mock-exam/components/ExamAnswerStatus.tsx`

---

## Phase 5: User Story 3 - 디렉션과 문제를 명확히 구분한다 (Priority: P2)

**Goal**: 실제 시험 흐름에서 베이지색을 카드가 아닌 directions 화면 배경에만 사용한다.

**Independent Test**: 모든 파트 directions와 문제/상황/표 카드를 비교해 문제 영역의 beige card가
0개인지 확인한다.

- [X] T014 [US3] Separate the beige directions presentation from white question surfaces in `src/screens/mock-exam/components/ExamPartDirectionsContent.tsx`
- [X] T015 [US3] Convert exam roots, question badges, references, and recovery surfaces to white or neutral in `src/screens/mock-exam/ExamSessionScreen.tsx`, `src/screens/mock-exam/components/ExamQuestionContent.tsx`, and `src/screens/mock-exam/components/ExamAnswerStatus.tsx`

---

## Phase 6: User Story 4 - 사전 정보 오류를 이해하고 복구한다 (Priority: P3)

**Goal**: 필수 prelude 누락·충돌·재생 실패 시 문제와 녹음을 차단하고 복구 행동을 제공한다.

**Independent Test**: Part 3 text/audio, Q8 표 누락과 표 충돌을 각각 주입해 오류 및 retry/exit가
보이고 preparation/recording이 시작되지 않는지 확인한다.

- [X] T016 [US4] Present typed immutable prelude errors and an exam exit action in `src/screens/mock-exam/components/ExamPreludeError.tsx` and `src/screens/mock-exam/ExamSessionScreen.tsx`
- [X] T017 [US4] Guard Part 3 playback failures, duplicate completion, blur, and media reset recovery in `src/screens/mock-exam/components/ExamPartIntroContent.tsx`

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 문서와 구현의 일치 및 저장소 품질 gate를 검증한다.

- [X] T018 Run `pnpm lint`, `pnpm exec tsc --noEmit`, and `git diff --check` from the repository root
- [X] T019 Review the final diff against `specs/002-part-aware-question-flow/spec.md`, `specs/002-part-aware-question-flow/plan.md`, and `specs/002-part-aware-question-flow/contracts/`
- [X] T020 Execute or report environment limits for the manual scenarios in `specs/002-part-aware-question-flow/quickstart.md`
- [X] T021 Complete the Developer Explain-Back checklist in `specs/002-part-aware-question-flow/plan.md`

---

## Phase 8: Approved UI Corrections

**Purpose**: 사용자 피드백에 따라 디렉션 표현과 Part 4 읽기 조작을 수정한다.

- [X] T022 [US3] Remove the rounded directions card and restore the full beige directions background in `src/screens/mock-exam/components/ExamPartDirectionsContent.tsx`
- [X] T023 [US1] Remove visible Part 3 situation-intro labels in `src/screens/mock-exam/components/ExamPartIntroContent.tsx` and `src/screens/mock-exam/components/ExamPreludeError.tsx`
- [X] T024 [US1] Add an early-completion action that transitions from Part 4 reading to Q8 preparation in `src/screens/mock-exam/ExamSessionScreen.tsx` and `src/screens/mock-exam/hooks/use-exam-session-controller.ts`
- [X] T025 Re-run lint, typecheck, Expo bundle, and diff validation from the repository root after the approved corrections

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 blocks all user stories.
- US1 depends on the normalized prelude foundation.
- US2 and US3 are independently testable after Phase 2, but shared screen files are edited sequentially.
- US4 depends on US1 phases/components and the invalid prelude union.
- Polish runs after all selected stories.

## Parallel Opportunities

- T006, T007, and T008 touch separate presentation files after the foundation is complete.
- T014 can be developed independently of submission scrolling, but integration into shared screen styles remains
  sequential.

## Implementation Strategy

1. Complete T001–T005 to stabilize the data contract.
2. Complete T006–T011 and validate the Part 3/4 happy path as the MVP.
3. Complete T012–T015 for recovery access and visual separation.
4. Complete T016–T017 for invalid/interrupted paths.
5. Complete T018–T021 and report device-only checks separately from static checks.
