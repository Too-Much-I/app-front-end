# Tasks: 통합 피드백 UI 목업

**Input**: Design documents from `/specs/005-unified-feedback-flow/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Validation**: 자동 테스트 러너가 없으므로 lint, typecheck와 quickstart의 수동/기기 검증을 수행한다.

**Organization**: Tasks are grouped by user story so each user-visible flow can be implemented and checked independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 동적 오각형 그래프에 필요한 Expo 호환 의존성과 화면 파일 구조를 준비한다.

- [X] T001 Install Expo-compatible `react-native-svg@15.15.4` in package.json and pnpm-lock.yaml
- [X] T002 Create the feedback component and fixture directories under src/screens/feedback/components/ and src/screens/feedback/mocks/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 세 사용자 흐름이 공유하는 타입 안전 데이터, 표시 모델과 시각 토큰을 만든다.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [X] T003 [P] Add semantic feedback colors to src/theme/tokens.js and typed exports in src/theme/index.ts
- [X] T004 [P] Create ExamGradingResult and ExamQuestionDetail fixtures with static mascot sources in src/screens/feedback/mocks/feedback-result.ts
- [X] T005 Build typed part view models, radar axes, score validation, and question lookup helpers in src/screens/feedback/feedback-view-model.ts

**Checkpoint**: Fixture data and reusable presentation inputs are type-safe and ready.

---

## Phase 3: User Story 1 - 한 화면에서 전체 결과 확인 (Priority: P1) 🎯 MVP

**Goal**: 사용자가 단계 표시 없이 결과의 다섯 주요 섹션을 한 번의 세로 스크롤로 확인한다.

**Independent Test**: 피드백 탭을 열어 `예상 총점 → 한눈에 보기 → 종합 피드백 → 파트별 피드백 → 파트별 점수` 순서를 확인하고 단계 숫자, 옆 인덱스와 다음 학습 추천이 없음을 확인한다.

- [X] T006 [P] [US1] Implement the result header and score summary in src/screens/feedback/components/FeedbackHeader.tsx and src/screens/feedback/components/ScoreSummaryCard.tsx
- [X] T007 [P] [US1] Implement strengths/weaknesses and overall feedback mascot cards in src/screens/feedback/components/AtAGlanceSection.tsx and src/screens/feedback/components/OverallCommentCard.tsx
- [X] T008 [P] [US1] Implement responsive part feedback cards and section layout in src/screens/feedback/components/PartFeedbackCard.tsx and src/screens/feedback/components/PartFeedbackSection.tsx
- [X] T009 [US1] Compose the safe-area-aware single result ScrollView in src/screens/feedback/FeedbackScreen.tsx
- [X] T010 [US1] Verify the continuous-scroll order and intentional omissions using specs/005-unified-feedback-flow/quickstart.md scenarios 1-3

**Checkpoint**: The complete static result is visible in one continuous scroll.

---

## Phase 4: User Story 2 - 파트에서 문제 상세로 이동 (Priority: P1)

**Goal**: 파트 카드에서 제공되는 Q 상세를 열고 같은 파트의 문제를 바꾼 뒤 원래 스크롤 위치로 돌아온다.

**Independent Test**: 파트 카드의 `문항별 피드백 보기`를 눌러 첫 Q 상세를 열고 다른 Q를 고른 후 뒤로 돌아가 직전 결과 위치가 복원되는지 확인한다.

- [X] T011 [P] [US2] Implement accessible Q selection, answer, evaluation, correction, and recommendation UI in src/screens/feedback/components/QuestionFeedbackView.tsx
- [X] T012 [US2] Add result/question mode, validated question selection, scroll offset capture, and scroll restoration in src/screens/feedback/FeedbackScreen.tsx
- [X] T013 [US2] Verify Q routing and scroll restoration using specs/005-unified-feedback-flow/quickstart.md scenarios 4-5

**Checkpoint**: Every provided question detail is reachable and returning preserves context.

---

## Phase 5: User Story 3 - 칠판을 돌려 파트 점수 비교 (Priority: P1)

**Goal**: 닫힌 칠판을 한 번 눌러 Part 1-5 점수를 채워진 오각형과 텍스트 목록으로 확인한다.

**Independent Test**: 칠판을 눌러 앞면과 그래프 뒷면을 반복 전환하고, 빠르게 여러 번 눌러도 회전이 중첩되지 않으며 동작 감소 설정에서는 즉시 전환되는지 확인한다.

- [X] T014 [P] [US3] Draw responsive radar grids, data polygon, markers, and accessible score alternatives in src/screens/feedback/components/PartRadarChart.tsx
- [X] T015 [US3] Implement the boolean Reanimated chalkboard toggle, repeated-tap guard, reduced-motion behavior, and mascot affordance in src/screens/feedback/components/PartScoreBoard.tsx
- [X] T016 [US3] Integrate persistent chalkboard state into src/screens/feedback/FeedbackScreen.tsx
- [X] T017 [US3] Verify graph values, two-way toggle, persistence, repeated taps, and reduced motion using specs/005-unified-feedback-flow/quickstart.md scenarios 6-9

**Checkpoint**: The score board safely reveals and retains an accurate five-part comparison.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 전체 화면의 반응형, 접근성, 타입 안정성과 명세 일치를 확인한다.

- [X] T018 Review phone/tablet, safe-area, large-text, VoiceOver/TalkBack, and iOS/Android flip behavior using specs/005-unified-feedback-flow/quickstart.md
- [X] T019 Run `pnpm lint` and resolve in-scope findings across src/screens/feedback/ and src/theme/
- [X] T020 Run `pnpm exec tsc --noEmit` and resolve strict typing findings across src/screens/feedback/ and src/theme/
- [X] T021 Review git diff against specs/005-unified-feedback-flow/spec.md, plan.md, and tasks.md and complete the Developer Explain-Back checklist in specs/005-unified-feedback-flow/plan.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately.
- **Foundational (Phase 2)**: Depends on Setup and blocks all stories.
- **US1 (Phase 3)**: Depends on Foundational and provides the shared result composition.
- **US2 (Phase 4)**: Depends on the US1 part cards and result screen composition.
- **US3 (Phase 5)**: Depends on the US1 result composition; its chart can be built alongside US2.
- **Polish (Phase 6)**: Depends on all selected stories.

### User Story Dependencies

- **US1**: Independent MVP after the foundation.
- **US2**: Uses US1's part card and result screen, but question detail is independently testable with fixtures.
- **US3**: Uses US1's final section, but radar rendering and board behavior are independently testable with axes.

### Parallel Opportunities

- T003 and T004 touch separate files and can run in parallel.
- T006, T007, and T008 build separate result components and can run in parallel.
- After US1, T011 and T014 build separate user-story components and can run in parallel.
- Static checks T019 and T020 can be started independently after implementation stabilizes.

## Parallel Examples

### User Story 1

```text
T006: Header and score summary components
T007: At-a-glance and overall comment components
T008: Part feedback components
```

### User Stories 2 and 3

```text
T011: Question feedback detail view
T014: Part radar chart
```

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational tasks.
2. Complete US1 and validate the continuous result scroll.
3. Add US2 question navigation without changing the scroll contract.
4. Add US3 as the final score reveal interaction.
5. Finish cross-cutting validation before handoff.

### Incremental Delivery

Each story leaves the feedback tab usable: US1 supplies the readable result, US2 adds question depth, and US3 adds the optional visual score comparison. No story requires an API or navigation contract change.

## Notes

- `[P]` indicates work in different files without an unfinished prerequisite.
- No automated tests are generated because the repository has no configured runner and the approved plan specifies static and manual validation.
- Commit, push, and external issue updates remain excluded without explicit user approval.
