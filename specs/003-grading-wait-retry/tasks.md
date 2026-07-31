# Tasks: 채점 대기 폴링과 재요청

**Input**: Design documents from `/specs/003-grading-wait-retry/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/grading-wait-contract.md

**Validation**: 자동 테스트 runner가 없으므로 lint, typecheck와 quickstart의 수동/기기 검증을 수행한다.

**Organization**: 작업은 승인된 사용자 스토리 우선순위와 동일하게 구성한다.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 폴링과 재요청이 공유할 타입 및 시험 단위 API 경계를 준비한다.

- [X] T001 Define the shared four-state grading lifecycle type and add `PENDING` to status polling types in src/types/exam.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 화면 lifecycle이 사용할 abort 가능한 status polling과 retry API를 준비한다.

**⚠️ CRITICAL**: 이 단계가 끝나기 전에는 화면 controller를 구현하지 않는다.

- [X] T002 Implement the `GET /api/v1/exams/{examId}/status` lifecycle boundary with caller AbortSignal support in src/features/exam/api/exam-grading-status.ts and keep completed result retrieval in src/features/exam/api/exam-grading-summary.ts
- [X] T003 [P] Implement bodyless `POST /api/v1/exams/{examId}/grading/retry` with caller AbortSignal support in src/features/exam/api/exam-grading-retry.ts

**Checkpoint**: 시험 식별자 하나로 polling과 retry를 호출할 수 있다.

---

## Phase 3: User Story 1 - 채점 완료까지 상태 확인 (Priority: P1) 🎯 MVP

**Goal**: 3초 순차 polling, 10초 단위 첫 네 체크와 `COMPLETED` 기반 마지막 체크 후 이동을 제공한다.

**Independent Test**: status를 `PENDING → PROCESSING → COMPLETED`로 바꾸고 10/20/30/40초 count, 요청 중첩 0건, 마지막 체크 뒤 Feedback 이동 1회를 확인한다.

- [X] T004 [US1] Rework the attempt-scoped AbortController, 180-second deadline, sequential three-second polling, and ten-second count progression in src/features/exam/use-grading-status.ts
- [X] T005 [US1] Add abort-safe sequential completion count animation through part five and exactly-once completion callback handling in src/features/exam/use-grading-status.ts
- [X] T006 [US1] Integrate the count-only waiting controller without intermediate navigation changes in src/screens/mock-exam/GradingWaitScreen.tsx

**Checkpoint**: 정상 채점은 마지막 체크 전까지 count 4에 머물고 완료 뒤에만 결과 진입점으로 이동한다.

---

## Phase 4: User Story 2 - 첫 실패 후 채점 재요청 (Priority: P2)

**Goal**: 최초 실패 또는 3분 초과에서 같은 화면의 Retry UI를 제공하고 성공한 POST 뒤 새 시도를 시작한다.

**Independent Test**: 최초 `FAILED`와 최초 180초 초과가 모두 최종 오류 없이 Retry UI를 표시하고, 빠른 연속 선택에도 POST 1건과 count 0 초기화 후 두 번째 polling만 시작하는지 확인한다.

- [X] T007 [P] [US2] Add the accessible retry-ready and retry-requesting presentation with a disabled shared Pressable state in src/screens/mock-exam/components/GradingRetryNotice.tsx
- [X] T008 [US2] Add single-flight retry handling, prior-attempt abort, count reset, retry POST, and second-attempt restart in src/features/exam/use-grading-status.ts
- [X] T009 [US2] Render retry phases inside the existing route and wire the retry action in src/screens/mock-exam/GradingWaitScreen.tsx

**Checkpoint**: 최초 실패/timeout은 화면 이동 없이 재요청 가능 상태가 되고 재요청 성공 뒤 새 3분 lifecycle이 시작된다.

---

## Phase 5: User Story 3 - 재요청 실패 후 안전하게 종료 (Priority: P3)

**Goal**: retry POST 실패 또는 두 번째 시도 실패/timeout에서 추가 Retry 없이 최종 오류와 실제 Home 탭 이동을 제공한다.

**Independent Test**: retry POST 오류, 두 번째 `FAILED`, 두 번째 180초 초과 각각에서 terminal notice만 표시하고 Home 선택 한 번으로 MockExam stack 정리와 Home 탭 이동을 확인한다.

- [X] T010 [US3] Route retry POST rejection and second-attempt failure or timeout to the terminal phase in src/features/exam/use-grading-status.ts
- [X] T011 [US3] Keep terminal-only copy and Home CTA responsibility explicit in src/screens/mock-exam/components/GradingFailedNotice.tsx
- [X] T012 [US3] Render the terminal phase and clear the MockExam stack before selecting the parent Home tab in src/screens/mock-exam/GradingWaitScreen.tsx

**Checkpoint**: 두 번째 실패 이후에는 추가 Retry가 없고 사용자는 끝난 시험으로 돌아가지 않는다.

---

## Phase 6: User Story 4 - 임시 미리보기 진입점 제거 (Priority: P4)

**Goal**: 개발용 채점 대기 미리보기를 제품 마이페이지와 route/hook 계약에서 제거한다.

**Independent Test**: MyPage에 미리보기 CTA가 없고 `마이페이지` 기본 콘텐츠는 유지되며 실제 ExamSession handoff만 GradingWait를 열 수 있는지 확인한다.

- [X] T013 [P] [US4] Remove the preview CTA, comment, navigation hook, and unused imports from src/screens/my-page/MyPageScreen.tsx
- [X] T014 [US4] Remove the preview route parameter and preview-only timing branch from src/navigation/types.ts, src/screens/mock-exam/GradingWaitScreen.tsx, and src/features/exam/use-grading-status.ts

**Checkpoint**: 제품 화면과 타입에 preview 전용 경로가 남지 않는다.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: cleanup, accessibility, 정적 검사와 명세 일치 검증을 완료한다.

- [X] T015 Review timer/request cleanup, stale aborted callbacks, Retry accessibility state, safe areas, and navigation races against specs/003-grading-wait-retry/quickstart.md
- [X] T016 Run `pnpm lint` and resolve in-scope findings across src/features/exam/, src/screens/mock-exam/, src/screens/my-page/, src/navigation/, and src/types/
- [X] T017 Run `pnpm exec tsc --noEmit` and resolve in-scope strict TypeScript findings across src/features/exam/, src/screens/mock-exam/, src/screens/my-page/, src/navigation/, and src/types/
- [X] T018 Review the final diff against specs/003-grading-wait-retry/spec.md, specs/003-grading-wait-retry/plan.md, and specs/003-grading-wait-retry/tasks.md and complete the Developer Explain-Back in specs/003-grading-wait-retry/plan.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 시작점
- **Foundational (Phase 2)**: T001 뒤 실행, 모든 사용자 스토리를 차단
- **US1 (Phase 3)**: T002 뒤 실행
- **US2 (Phase 4)**: US1 controller 위에 retry lifecycle을 추가
- **US3 (Phase 5)**: US2의 second attempt와 terminal phase에 의존
- **US4 (Phase 6)**: 다른 파일은 병렬 가능하지만 hook/screen 정리는 US3 뒤 수행
- **Polish (Phase 7)**: 모든 스토리 완료 뒤 실행

### User Story Dependencies

- **US1**: foundation만 의존하며 정상 polling MVP를 독립 검증할 수 있다.
- **US2**: US1의 attempt lifecycle을 재시작한다.
- **US3**: US2의 retry 결과를 terminal policy로 확장한다.
- **US4**: 사용자 동작은 독립적이나 같은 hook/screen 파일 충돌 때문에 순차 적용한다.

### Parallel Opportunities

- T003은 T002와 다른 API 파일에서 병렬 가능하다.
- T007은 controller T008과 다른 UI 파일에서 병렬 가능하다.
- T013은 mock-exam 구현과 다른 MyPage 파일에서 병렬 가능하다.

---

## Parallel Example: User Story 2

```text
Task: "Create GradingRetryNotice in src/screens/mock-exam/components/GradingRetryNotice.tsx"
Task: "Implement retry lifecycle in src/features/exam/use-grading-status.ts"
```

---

## Implementation Strategy

### MVP First

1. T001~T003으로 typed API foundation을 만든다.
2. T004~T006으로 정상 polling/count/completion을 완성한다.
3. 정상 경로를 독립 검증한 뒤 retry와 terminal phase를 추가한다.

### Incremental Delivery

1. US1: 정상 polling과 완료 전환
2. US2: 최초 실패 복구
3. US3: 최종 실패 종료
4. US4: 개발용 진입점 제거
5. 전체 static/manual validation

## Notes

- polling/retry 로직에는 새 dependency를 추가하지 않는다. TMI-23 UI 영상은 Expo 57 호환
  `expo-video`를 사용한다.
- 완료한 task는 즉시 `[X]`로 표시한다.
- commit, push, Jira 변경은 별도 사용자 요청 전까지 수행하지 않는다.
