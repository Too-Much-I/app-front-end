---

description: "Sentry 운영 오류 보고 구현 작업"
---

# Tasks: Sentry 운영 오류 보고 범위

**Input**: Design documents from `/specs/012-sentry-error-reporting/`

**Prerequisites**: Approved spec.md and plan.md, requirements.md, research.md, data-model.md, contracts/, quickstart.md

**Validation**: 자동 test runner가 없으므로 lint, typecheck, native bundle, source/privacy audit와 가능한 수동 failure-injection 검증을 수행한다.

**Organization**: typed catalog와 privacy 방어선을 먼저 만들고, 핵심 시험·피드백·개인정보·중복 제외 스토리 순서로 terminal owner에 연결한다.

## Phase 1: Setup

**Purpose**: 기존 Sentry 경계와 실제 terminal 상태 소유자를 확정한다.

- [x] T001 기존 `src/lib/sentry.ts`와 15개 오류의 terminal transition을 requirements.md 및 contracts/operational-error-contract.md와 대조한다

---

## Phase 2: Foundational

**Purpose**: 모든 사용자 스토리가 공유하는 typed catalog, 안전한 분류와 최종 privacy scrub을 구현한다.

- [x] T002 `src/lib/operational-error-reporting.ts`에 15개 stable code, code별 discriminated input, safe API failure 분류와 throw-free reporter를 구현한다
- [x] T003 `src/lib/sentry.ts`의 final scrub을 URL·URI·ID·token·audio key까지 강화하고 기존 summary 전용 helper를 공용 catalog로 통합한다

**Checkpoint**: raw exception을 전송하지 않는 typed operational reporting 경계가 준비된다.

---

## Phase 3: User Story 1 - 핵심 흐름의 확정 실패를 발견한다 (Priority: P1) 🎯 MVP

**Goal**: 인증, 시험 시작, 필수 자료·음성, 녹음, 답변 제출과 최종 채점 실패를 terminal 시점에만 보고한다.

**Independent Test**: 핵심 흐름별 성공, 자동 복구, 최종 실패를 실행해 최종 실패에만 해당 code가 시도당 한 번 생성되는지 확인한다.

- [x] T004 [US1] `src/features/auth/auth-controller.ts`에서 인증 attempt별 `RETRYABLE_ERROR` 확정 시 `AUTH_BOOTSTRAP_FAILED`를 한 번 보고한다
- [x] T005 [US1] `src/screens/mock-exam/SoundTestScreen.tsx`에서 session 생성 차단과 필수 sound-test audio 실패를 각각 안전한 code로 보고한다
- [x] T006 [US1] `src/screens/mock-exam/components/ExamPartDirectionsContent.tsx`, `ExamPartIntroContent.tsx`, `ExamPhaseCue.tsx`, `ExamQuestionCue.tsx`에서 필수 cue generation별 최종 재생 실패를 보고한다
- [x] T007 [US1] `src/screens/mock-exam/hooks/use-exam-session-controller.ts`에서 Part 3/4 invalid prelude가 error phase로 확정될 때 reason과 함께 보고한다
- [x] T008 [US1] `src/features/exam/use-answer-recorder.ts`와 `src/screens/mock-exam/hooks/use-exam-session-controller.ts`에서 permission/cancel/interruption을 제외한 녹음 terminal failure를 시도당 보고한다
- [x] T009 [US1] `src/features/exam/use-answer-submissions.ts`에서 answer job의 내장 retry 이후 terminal upload/notify failure를 user attempt별 보고한다
- [x] T010 [US1] `src/features/exam/use-grading-status.ts`에서 최초 retry-ready를 제외하고 retry request 또는 두 번째 attempt의 terminal grading failure만 보고한다

**Checkpoint**: 핵심 시험 흐름의 사용자 차단 오류가 중간 오류 없이 분류된다.

---

## Phase 4: User Story 2 - 피드백과 재답변 실패를 구분한다 (Priority: P1)

**Goal**: 피드백 page/data/history/summary와 재답변 question/submission/grading 실패를 독립 code와 stage로 구분한다.

**Independent Test**: 각 단계에 실패를 독립 주입해 실제 오류 UI 또는 failed response 전환에 한 번만 생성되는지 확인한다.

- [x] T011 [US2] `src/screens/feedback/FeedbackScreen.tsx`에서 reload generation별 WebView page load와 native data 전달 실패를 구분해 보고한다
- [x] T012 [US2] `src/screens/home/use-recent-feedback.ts`와 `src/screens/feedback/components/ExamHistoryScreen.tsx`에서 기존 data가 없는 visible history failure만 보고한다
- [x] T013 [US2] `src/screens/feedback/FeedbackScreen.tsx`의 summary feedback 공유 operation을 `SUMMARY_FEEDBACK_RETRY_FAILED`로 통합하고 requestId/examId 전송과 중복을 제거한다
- [x] T014 [US2] `src/features/exam/use-reanswer-question.ts`에서 abort를 제외한 question load terminal failure를 보고한다
- [x] T015 [US2] `src/features/exam/use-reanswer-submission.ts`에서 submit과 grading server/timeout terminal failure를 별도 code/reason으로 보고한다
- [x] T016 [US2] `src/screens/reanswer/ReanswerScreen.tsx`에서 permission/interruption을 제외한 reanswer recording terminal failure를 시도당 보고한다
- [x] T017 [US2] `src/screens/settings/use-delete-learning-records.ts`에서 사용자 삭제 요청의 terminal API failure를 보고한다

**Checkpoint**: 피드백·재답변·설정의 사용자 차단 오류가 책임 단계별로 분리된다.

---

## Phase 5: User Story 3 - 개인정보 없이 원인을 분류한다 (Priority: P1)

**Goal**: 모든 manual event가 allowlist metadata만 사용하고 자동 context에도 최종 scrub이 적용된다.

**Independent Test**: source/privacy audit와 합성 민감값 검토로 ID, token, URL, body, message, URI 및 학습 본문 전달이 없는지 확인한다.

- [x] T018 [US3] `src/lib/operational-error-reporting.ts`, `src/lib/sentry.ts`와 모든 report call site를 감사해 forbidden raw field가 전달되지 않고 stable code fingerprint만 사용하는지 확인한다

**Checkpoint**: 15개 경로가 동일한 privacy contract를 만족한다.

---

## Phase 6: User Story 4 - 정상 중단과 중복을 오류에서 제외한다 (Priority: P2)

**Goal**: retry/cancel/background/permission 경로를 제외하고 같은 attempt의 callback·render 중복을 막는다.

**Independent Test**: 자동 복구, 권한 거부, 화면 이탈, abort, callback 중복과 명시적 user retry를 실행해 0/1/new-attempt 규칙을 확인한다.

- [x] T019 [US4] `src/features/auth/auth-controller.ts`, `src/features/exam/use-answer-submissions.ts`, `src/features/exam/use-grading-status.ts`, `src/screens/feedback/FeedbackScreen.tsx`의 owner-local generation/ref/set을 대조해 같은 attempt 중복과 새 user retry 허용을 완성한다

**Checkpoint**: 정상 중단과 중복이 운영 장애 빈도를 왜곡하지 않는다.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 전체 catalog, privacy, 기존 동작과 품질 게이트를 검증하고 가능한 결과를 기록한다.

- [x] T020 `specs/012-sentry-error-reporting/quickstart.md`의 15-code source mapping, forbidden-field scan과 exclusion matrix를 수행하고 결과를 기록한다
- [x] T021 `pnpm lint`를 실행하고 결과를 기록한다
- [x] T022 `pnpm exec tsc --noEmit`을 실행하고 결과를 기록한다
- [x] T023 `pnpm exec expo export --platform all --output-dir /tmp/app-front-end-sentry-reporting-dist`를 실행해 native bundle을 검증한다
- [x] T024 `git diff --check`와 최종 diff를 requirements.md, spec.md, plan.md, tasks.md에 대조하고 Sentry delivery 미실행 범위를 기록한다

---

## Dependencies & Execution Order

- Phase 1 → Phase 2가 모든 story를 차단한다.
- US1과 US2는 foundational 뒤 독립적으로 검토할 수 있으나 공용 reporter 변경은 순차 반영한다.
- US3 privacy audit는 모든 report call site가 연결된 뒤 수행한다.
- US4 dedupe audit는 US1/US2의 owner 연결 뒤 수행한다.
- Polish는 모든 story 완료 뒤 수행한다.

## Parallel Opportunities

- T004–T010은 공용 reporter가 완성된 뒤 서로 다른 owner 파일을 중심으로 병렬 검토할 수 있다.
- T012, T014, T015, T017은 서로 다른 파일이라 병렬 검토할 수 있다.
- T021–T023은 구현 완료 후 서로 독립적인 검사지만 출력과 resource 사용을 위해 순차 실행한다.

## Implementation Strategy

1. T001–T003으로 typed reporting/privacy foundation을 만든다.
2. T004–T010으로 핵심 시험 흐름 MVP를 연결한다.
3. T011–T017로 피드백·재답변·설정 흐름을 연결한다.
4. T018–T019로 privacy와 attempt semantics를 감사한다.
5. T020–T024로 15-code mapping과 정적·bundle 검증을 마친다.

## Notes

- 자동 test runner가 없어 별도 test file task는 만들지 않는다.
- 실제 Sentry ingestion은 외부 event write이므로 이번 구현 검증에서 실행하지 않는다.
- commit, push 또는 Jira write는 포함하지 않는다.

## Phase 8: Convergence

- [x] T025 `src/screens/feedback/FeedbackScreen.tsx`에서 실패한 summary feedback operation을 Map이 같은 operation을 가리킬 때만 제거해 동시 요청 공유는 유지하고 새 사용자 재시도는 새 API·polling을 시작하게 한다 per FR-005, FR-016, plan: summary feedback shared operation (contradicts)
- [x] T026 `src/features/exam/use-answer-submissions.ts`에서 첫 answer submission attempt를 1로 시작하고 사용자 retry마다 증가시켜 Sentry metadata를 일관된 1-based 시도로 기록한다 per FR-007, SC-004, plan: answer attempt generation (partial)
- [x] T027 `src/features/auth/auth-controller.ts`의 catch 경로에서 원인을 `setRetry`로 전달해 raw 원문 없이 `ApiError`의 안전한 HTTP status와 server code를 분류한다 per US3/AC1, plan: safe API failure classification (partial)
