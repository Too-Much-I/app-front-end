# Tasks: 모의고사 답변 녹음 및 업로드

**Input**: Design documents from `/specs/001-record-upload-answer/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Validation**: 자동 테스트 러너가 없으므로 `pnpm lint`, `pnpm exec tsc --noEmit`,
`git diff --check`와 iOS/Android 실기기 시나리오를 포함한다.

**Organization**: 태스크는 공유 기반과 User Story 우선순위(P1 → P2 → P3)로 구성한다.

## Phase 1: Setup (Shared Audio Presentation)

**Purpose**: 기존 마이크 테스트 동작을 보존하면서 답변 화면과 공유할 오디오·파형 기반을 만든다.

- [X] T001 [P] Extract shared recording options, audio modes, metering constants, and pure dB normalization into src/features/exam/answer-audio.ts
- [X] T002 [P] Implement configurable 100ms-smoothed metering bars with text-independent presentation in src/screens/mock-exam/components/AudioWaveform.tsx
- [X] T003 Refactor src/screens/mock-exam/hooks/use-microphone-test.ts and src/screens/mock-exam/MicrophoneTestScreen.tsx to consume shared audio primitives and AudioWaveform without changing pause/resume or playback behavior

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 녹음과 모든 사용자 스토리가 공유하는 타입·취소·API 전송 경계를 준비한다.

**⚠️ CRITICAL**: 이 단계가 끝나기 전에는 사용자 스토리 구현을 시작하지 않는다.

- [X] T004 Define AnswerKey, finalized recording, submission job/stage/failure, and summary domain types in src/types/exam.ts
- [X] T005 [P] Compose caller cancellation with internal timeout and preserve ApiError semantics in src/lib/api/client.ts
- [X] T006 [P] Extract the upload URL request, optional caller signal, and ApiEnvelope unwrapping into src/features/exam/api/exam-answer-upload-url.ts
- [X] T007 [P] Extract the grading submit request into src/features/exam/api/exam-answer-submit.ts and add the same optional caller-signal contract to src/features/exam/api/exam-question-status.ts
- [X] T008 Implement file validation, presigned URL expiry handling, 15-second PUT cancellation, and bounded retry in src/features/exam/upload-answer-audio.ts, then retire src/features/exam/api/exam-answer-upload.ts after callers migrate

**Checkpoint**: 공통 파형, strict domain types, cancellable API와 단계별 upload/submit 함수가 준비된다.

---

## Phase 3: User Story 1 - 답변을 녹음해 제출한다 (Priority: P1) 🎯 MVP

**Goal**: 실제 시험 세션의 한 문항을 녹음하고, 움직이는 파형을 표시하며, 유효 파일을 서버에 제출한다.

**Independent Test**: 정상 권한·네트워크에서 한 문항을 완료해 정확히 하나의 m4a 파일이 해당 Answer Key로 upload URL → S3 PUT → submit 순서로 처리되는지 확인한다.

### Implementation for User Story 1

- [X] T009 [US1] Implement answer recording prepare/start/duration/metering/finalize/file-validation lifecycle in src/features/exam/use-answer-recorder.ts
- [X] T010 [US1] Implement keyed submission registration, happy-path upload/submit runner, and aggregate summary reducer in src/features/exam/use-answer-submissions.ts
- [X] T011 [US1] Implement directions/preparation/starting-response/response/finalizing phases and wall-clock/native-duration timing in src/screens/mock-exam/hooks/use-exam-session-controller.ts
- [ ] T012 [P] [US1] Replace mock session creation with createExamSession loading, failure, and retry states in src/screens/mock-exam/SoundTestScreen.tsx
  - Temporary local-test override (2026-07-27): API base URL이 준비될 때까지 `createMockExamSession()`으로 시험 화면에 진입한다.
- [X] T013 [US1] Connect the controller, live AudioWaveform, timer, valid-file registration, and answer controls in src/screens/mock-exam/ExamSessionScreen.tsx

**Checkpoint**: 한 문항의 실제 녹음·파형·제출 happy path가 독립적으로 동작한다.

---

## Phase 4: User Story 2 - 답변을 안전하게 연속 진행한다 (Priority: P2)

**Goal**: 종료 이벤트와 비동기 작업이 겹쳐도 답변이 섞이거나 중복 제출되지 않고 다음 문항을 계속한다.

**Independent Test**: 사용자 완료, native 제한 시간, fallback timeout을 연속 발생시키고 이전 문항 제출 중 다음 문항을 녹음해도 Answer Key별 stop, 파일 등록, runner가 각각 하나인지 확인한다.

### Implementation for User Story 2

- [X] T014 [US2] Add generation guards, terminal Promise single-flight, first-intent AppState ordering, and ownership-safe stop/restore behavior in src/features/exam/use-answer-recorder.ts
- [X] T015 [US2] Add idempotent keyed registration, URI invariant checks, one runner per key, and non-FIFO independent job progression in src/features/exam/use-answer-submissions.ts
- [X] T016 [US2] Gate next-question transitions on successful registry ownership transfer and derive the final registered/succeeded/pending/failed barrier in src/screens/mock-exam/hooks/use-exam-session-controller.ts
- [X] T017 [US2] Integrate next-part directions, no-backtracking controls, submission barrier, and completed presentation in src/screens/mock-exam/ExamSessionScreen.tsx

**Checkpoint**: 여러 문항이 동시에 녹음·제출 상태를 가져도 문항 식별자와 파일 소유권이 섞이지 않는다.

---

## Phase 5: User Story 3 - 문제 상황을 이해하고 복구한다 (Priority: P3)

**Goal**: 권한, interruption, 파일, upload 및 submit 실패를 성공으로 오인하지 않고 같은 문항 또는 실패 단계에서 복구한다.

**Independent Test**: 권한 거부, background/interruption, missing/zero-byte 파일, upload 실패, submit 응답 유실 및 terminal failed를 각각 유도해 올바른 상태와 복구 행동이 제공되는지 확인한다.

### Implementation for User Story 3

- [X] T018 [US3] Add permission-denied, can-ask-again, interruption discard, invalid-file recovery, same-question full-duration retry, and dispose cleanup in src/features/exam/use-answer-recorder.ts
- [X] T019 [US3] Add stage-aware upload retry, fileKey-preserving submit recovery, status reconciliation, submission-unknown safety, manual retry, cancellation, and file cleanup in src/features/exam/use-answer-submissions.ts
- [X] T020 [P] [US3] Implement accessible recording/submission pending, interrupted, permission, failure, retry, and completed UI in src/screens/mock-exam/components/ExamAnswerStatus.tsx
- [X] T021 [US3] Wire settings, same-question re-record, registration retry, stage retry, foreground resume, and final failure recovery into src/screens/mock-exam/hooks/use-exam-session-controller.ts and src/screens/mock-exam/ExamSessionScreen.tsx
- [X] T022 [P] [US3] Document shared recording format, first terminal intent, in-app background limits, and server idempotency prerequisite in docs/answer-audio-recording-format.md

**Checkpoint**: 모든 명세된 오류·중단 경로가 명시적 상태와 사용자 복구 행동을 가진다.

---

## Phase 6: Polish & Cross-Cutting Validation

**Purpose**: 명세·계획과 구현을 수렴시키고 정적·기기 검증 증거를 남긴다.

- [X] T023 Review all changed source files against specs/001-record-upload-answer/spec.md, plan.md, data-model.md, and contracts/ and correct scope or ownership mismatches
- [X] T024 Run pnpm lint and fix all in-scope findings
- [X] T025 Run pnpm exec tsc --noEmit and fix all in-scope strict TypeScript findings
- [X] T026 Run git diff --check and verify no dependency or pnpm-lock.yaml changes were introduced
- [X] T027 Execute and record the feasible quickstart scenarios from specs/001-record-upload-answer/quickstart.md, explicitly reporting unavailable iOS/Android device or backend contract checks
- [X] T028 Complete the Developer Explain-Back items in specs/001-record-upload-answer/plan.md and summarize affected files, state/data flow, tradeoffs, rollback, and validation evidence

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: 시작 가능
- **Phase 2**: Phase 1 이후, 모든 사용자 스토리를 차단
- **US1 (Phase 3)**: Phase 2 이후
- **US2 (Phase 4)**: US1 recorder/registry/controller 기반 이후
- **US3 (Phase 5)**: US1/US2 상태 머신과 ownership 규칙 이후
- **Polish (Phase 6)**: 모든 구현 단계 이후

### User Story Dependency Graph

```text
Shared audio + API foundation
  → US1 single-answer happy path
    → US2 multi-question concurrency and final barrier
      → US3 failure and recovery paths
        → Static and device validation
```

### Parallel Opportunities

- T001과 T002는 서로 다른 파일이지만 T003 전에 모두 완료해야 한다.
- T005, T006, T007은 서로 다른 API 파일에서 병렬 수행 가능하다.
- T012는 T009–T011과 다른 화면/API 경계를 사용해 병렬 수행 가능하다.
- T020과 T022는 서로 다른 UI·문서 파일에서 병렬 수행 가능하다.

## Parallel Examples

### Foundation

```text
Task T005: apiFetch signal composition
Task T006: upload URL endpoint
Task T007: submit endpoint
```

### User Story 3

```text
Task T020: recovery/status component
Task T022: recording and idempotency documentation
```

## Implementation Strategy

### MVP First

1. Phase 1 공통 파형 기반
2. Phase 2 strict type/API 기반
3. Phase 3 단일 문항 happy path
4. 한 문항의 녹음·파형·제출을 독립 검증

### Incremental Delivery

1. US1로 정상 한 문항 제출 성립
2. US2로 다문항과 race 안전성 추가
3. US3로 실패·중단 복구 추가
4. 최종 barrier와 양 플랫폼 검증 완료

## Notes

- 새 dependency 또는 lockfile 변경은 허용하지 않는다.
- 자동 재-submit은 서버 멱등성과 명확한 미접수 contract 검증 전에는 활성화하지 않는다.
- commit, push, Jira write는 별도 명시적 요청 전에는 수행하지 않는다.
