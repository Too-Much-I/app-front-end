# Tasks: 답변 제출 재시도 계약 수정 및 실패 UX

**Input**: Design documents from `/specs/001-record-upload-answer/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Validation**: 자동 테스트 러너가 없으므로 `pnpm lint`, `pnpm exec tsc --noEmit`,
`git diff --check`와 quickstart의 재시도·오류 UI 시나리오를 포함한다.

**Organization**: 현재 승인된 S3/서버 고지 재시도 계약과 최종 실패 UX를 User Story
우선순위(P1 → P2 → P3)로 구현한다.

## Phase 1: Setup (Submission Contract Cleanup)

**Purpose**: 실제 서버에 없는 상태 조회 계약을 제거하고 새 제출 상태 모델의 기반을 만든다.

- [X] T001 [P] Remove the nonexistent question-status endpoint in src/features/exam/api/exam-question-status.ts
- [X] T002 [P] Remove the obsolete polling result and replace reconcile/submission-unknown stages with upload-target and notification state fields in src/types/exam.ts

---

## Phase 2: Foundational (Retry Primitives)

**Purpose**: S3 PUT과 서버 고지가 공유할 bounded jitter 및 오류 분류 기준을 준비한다.

**⚠️ CRITICAL**: 이 단계가 끝나기 전에는 submission runner와 실패 UI를 변경하지 않는다.

- [X] T003 Implement equal-jitter bounded backoff, same-URL S3 PUT retry, expiry cutoff, and terminal 4xx classification in src/features/exam/upload-answer-audio.ts
- [X] T004 Clarify the upload-complete notification contract and optional cancellation boundary in src/features/exam/api/exam-answer-submit.ts

**Checkpoint**: S3 PUT은 새 URL을 요청하지 않고 기존 target 안에서만 재시도할 수 있다.

---

## Phase 3: User Story 1 - 답변을 녹음해 제출한다 (Priority: P1) 🎯 MVP

**Goal**: 한 답변이 최초 upload target → 같은 URL의 S3 PUT → 서버 고지 순서로 처리된다.

**Independent Test**: 정상 응답에서 upload URL 요청, S3 PUT, 서버 고지가 각각 한 번 발생하고
PUT 성공 뒤 같은 fileKey로 고지되는지 확인한다.

### Implementation for User Story 1

- [X] T005 [US1] Persist uploadUrl, upload expiry, and fileKey before PUT; delete the local file after PUT success; and notify with the preserved fileKey in src/features/exam/use-answer-submissions.ts

**Checkpoint**: 정상 제출은 status 조회 없이 완료되고 로컬 파일은 S3 저장 뒤 정리된다.

---

## Phase 4: User Story 2 - 답변을 안전하게 연속 진행한다 (Priority: P2)

**Goal**: 이전 답변의 재시도가 다음 문항과 독립적이며 동일한 답변 키와 target을 유지한다.

**Independent Test**: 이전 문항의 PUT 또는 고지 재시도 중 다음 문항을 진행해도 key별 runner가
하나이고 `retryCount`, upload URL, fileKey가 변경되지 않는지 확인한다.

### Implementation for User Story 2

- [X] T006 [US2] Preserve keyed single-flight, cancellation, foreground resume, and stage-specific manual retry while removing URL reissue and status reconciliation from src/features/exam/use-answer-submissions.ts

**Checkpoint**: PUT 실패는 PUT만, 고지 실패는 고지만 다시 실행한다.

---

## Phase 5: User Story 3 - 문제 상황을 이해하고 복구한다 (Priority: P3)

**Goal**: 서버 고지를 최대 3회 jitter 재시도하고 최종 실패에서 error 토끼와 올바른 행동을 표시한다.

**Independent Test**: 고지 network/timeout/408/429/5xx, 일반 4xx, 재시도 소진을 각각 유도해
자동 재시도 횟수, S3 재업로드 0회, 수동 재시도 노출 조건과 홈 이동을 확인한다.

### Implementation for User Story 3

- [X] T007 [US3] Add three-additional-attempt equal-jitter notification retry, retryable error preservation, and terminal client-error handling in src/features/exam/use-answer-submissions.ts
- [X] T008 [P] [US3] Render public/mascots/error.png with accessible terminal-failure messaging, conditional manual retry, and a Home button in src/screens/mock-exam/components/ExamAnswerStatus.tsx
- [X] T009 [US3] Wire submission disposal, MockExam stack reset, and typed parent-tab Home navigation through src/screens/mock-exam/ExamSessionScreen.tsx

**Checkpoint**: 일시 오류는 다시 시도하거나 홈으로 갈 수 있고, 일반 4xx는 홈으로만 나갈 수 있다.

---

## Phase 6: Polish & Cross-Cutting Validation

**Purpose**: 구현과 승인된 계약을 수렴시키고 정적·수동 검증 결과를 남긴다.

- [X] T010 [P] Update retry, no-status, no-reissue, file-lifecycle, and failure-UI notes in docs/answer-audio-recording-format.md
- [X] T011 Review the unchanged recording/session baseline and changed submission source against FR-001–FR-024 in specs/001-record-upload-answer/spec.md plus plan.md, data-model.md, and contracts/submission-contract.md, correcting ownership or state mismatches
- [X] T012 Run pnpm lint and fix all in-scope findings
- [X] T013 Run pnpm exec tsc --noEmit and fix all in-scope strict TypeScript findings
- [X] T014 Run git diff --check and verify no dependency, lockfile, generated-file, or unrelated source changes were introduced
- [X] T015 Execute feasible scenarios 5–8 from specs/001-record-upload-answer/quickstart.md and record unavailable device/backend checks

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: 시작 가능
- **Phase 2**: Phase 1 이후, 모든 runner 변경을 차단
- **US1 (Phase 3)**: Phase 2 이후
- **US2 (Phase 4)**: US1의 upload target 보존 이후
- **US3 (Phase 5)**: US2의 stage-specific retry 이후
- **Polish (Phase 6)**: 모든 구현 단계 이후

### User Story Dependency Graph

```text
Status contract cleanup
  → jitter retry primitives
    → US1 upload target + happy path
      → US2 stage-specific single-flight recovery
        → US3 terminal error UX + Home navigation
          → validation
```

### Parallel Opportunities

- T001과 T002는 삭제 대상 API와 domain type 정리를 나눠 검토할 수 있지만 type 변경은 함께 완료해야 한다.
- T008은 T007의 최종 prop 계약이 확정된 뒤 UI 파일에서 독립적으로 수행할 수 있다.
- T010은 source 구현과 다른 문서 파일에서 진행할 수 있다.

## Parallel Example: User Story 3

```text
Task T007: notification retry and failure metadata
Task T008: error mascot and failure actions after prop contract is known
```

## Implementation Strategy

### MVP First

1. Phase 1의 존재하지 않는 API·상태 제거
2. Phase 2의 S3 jitter primitive 구현
3. Phase 3의 정상 upload target → PUT → notification 흐름 검증

### Incremental Delivery

1. US1로 정상 제출 계약 수정
2. US2로 같은 target과 Answer Key를 유지하는 복구 추가
3. US3로 서버 고지 재시도와 실패 UX 추가
4. 정적 검사와 가능한 quickstart 검증 완료

## Notes

- 새 dependency 또는 lockfile 변경은 허용하지 않는다.
- 네트워크 재시도는 `retryCount`를 변경하지 않는다.
- 동일 tuple 고지를 서버가 멱등 처리한다는 통합 계약이 필요하다.
- commit, push, Jira write는 별도 명시적 요청 전에는 수행하지 않는다.
