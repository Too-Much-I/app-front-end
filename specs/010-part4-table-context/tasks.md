---

description: "Part 4 구조화 표 렌더링 구현 작업"
---

# Tasks: Part 4 구조화 표 렌더링

**Input**: Design documents from `/specs/010-part4-table-context/`

**Prerequisites**: Approved spec.md and plan.md, research.md, data-model.md, contracts/, quickstart.md

**Validation**: 자동 test runner가 없으므로 lint, typecheck, reference JSON contract 검사와 가능한 수동 검증을 수행한다.

**Organization**: 공통 계약과 mapper를 먼저 만들고, 사용자 스토리별 표시·복구·반응형 요구를 순서대로 통합한다.

## Phase 1: Setup

**Purpose**: 기존 프로젝트 경계와 변경 범위를 준비한다.

- [x] T001 기존 Part 4 image field와 소비 지점을 다시 확인하고 새 공용 컴포넌트 경로 `src/components/exam/Part4Table.tsx`의 범위를 확정한다

---

## Phase 2: Foundational

**Purpose**: 모든 사용자 스토리가 사용하는 raw/domain 계약과 session 정규화를 구현한다.

- [x] T002 `src/types/exam.ts`에 raw snake_case 표 타입, camelCase domain 표 타입, `tableContext` question/prelude 계약과 table-specific invalid reason을 정의한다
- [x] T003 `src/features/exam/map-exam-table-context.ts`에 dependency 없는 runtime mapper, issue 수집, 열린 문자열 보존, scalar fallback과 구조 동등성 비교를 구현한다
- [x] T004 `src/features/exam/part-prelude.ts`, `src/features/exam/map-exam-session.ts`, `src/features/exam/map-exam-question-info.ts`를 Q8 canonical table 및 Part 4 detail validation 흐름으로 전환한다

**Checkpoint**: API 데이터가 안전한 domain table 또는 typed failure로 정규화된다.

---

## Phase 3: User Story 1 - 모든 Part 4 정보를 표에서 확인한다 (Priority: P1) 🎯 MVP

**Goal**: 모든 public 표 정보가 세 표시 경로에서 columns 순서대로 보인다.

**Independent Test**: reference table의 title, subtitles, metadata, columns, 모든 rows와 notes를 live reading/Q8~Q10/reanswer에서 원본과 대조한다.

- [x] T005 [US1] `src/components/exam/Part4Table.tsx`에 title, subtitles, metadata, columns 순서 cells, 모든 rows와 notes를 표시하는 공용 native grid를 구현한다
- [x] T006 [US1] `src/screens/mock-exam/components/ExamInformationReading.tsx`, `src/screens/mock-exam/components/ExamQuestionContent.tsx`, `src/screens/mock-exam/ExamSessionScreen.tsx`, `src/screens/mock-exam/hooks/use-exam-session-controller.ts`를 공용 표와 one-shot table-ready timer gate에 연결한다
- [x] T007 [US1] `src/screens/reanswer/components/ReanswerQuestionCard.tsx`와 `src/features/exam/map-exam-question-info.ts`를 Part 4 detail table 및 기존 question-failed 복구 경로에 연결한다

**Checkpoint**: 원격 표 이미지 없이 정상 Part 4 응시와 재답변이 가능한 MVP가 완성된다.

---

## Phase 4: User Story 2 - 상태와 빈 값을 오해 없이 읽는다 (Priority: P1)

**Goal**: null/empty와 0/false가 구분되고 status badge와 strike-through가 간섭하지 않는다.

**Independent Test**: null, empty, missing, 0, false, status note와 struck row 조합을 표시해 모든 cell과 badge를 대조한다.

- [x] T008 [US2] `src/components/exam/Part4Table.tsx`의 scalar formatter, 전체 cell 취소선과 별도 neutral status badge 및 값 없음 접근성 label을 완성한다
- [x] T009 [US2] `src/screens/mock-exam/components/ExamPreludeError.tsx`의 image-specific Part 4 오류를 missing/misplaced/invalid/conflicting table 안내로 교체한다

**Checkpoint**: falsy 값과 행 상태가 손실되거나 시각적으로 오해되지 않는다.

---

## Phase 5: User Story 3 - 새 표 변형도 안전하게 확인한다 (Priority: P2)

**Goal**: unknown 문자열과 부분 계약 위반이 전체 표 손실이나 행 filtering으로 이어지지 않는다.

**Independent Test**: unknown table/value/status/key/scope와 missing/extra cell, duplicate column fixture에서 선언 순서와 fallback 및 진단을 확인한다.

- [x] T010 [US3] `src/features/exam/map-exam-table-context.ts`와 `src/features/exam/map-exam-session.ts`에서 recoverable item 위치 보존, missing/extra/duplicate 진단과 값 본문 없는 개발 경고를 완성한다

**Checkpoint**: 확장 계약과 부분 오류가 안전한 기본 표시로 수렴한다.

---

## Phase 6: User Story 4 - 다양한 화면에서 표 전체에 접근한다 (Priority: P2)

**Goal**: 작은 휴대폰, 태블릿과 큰 글자에서도 전체 행·열과 상태에 접근한다.

**Independent Test**: 6열·10행, 긴 값과 큰 글자에서 가로/세로 scroll, header/value 음성 label과 준비 완료 action 접근성을 확인한다.

- [x] T011 [US4] `src/components/exam/Part4Table.tsx`에 동일 최소 column width, horizontal overflow 안내·indicator, 자연 row height와 header/cell 접근성 semantics를 완성한다

**Checkpoint**: 최대 reference 크기와 큰 글자에서도 콘텐츠가 잘리지 않는다.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 기존 image 경로를 정리하고 전체 계약과 품질 게이트를 검증한다.

- [x] T012 Part 4 참조가 0건인지 확인한 뒤 `src/screens/mock-exam/components/ExamInformationImage.tsx`를 제거하고 `tableImageUrl` 잔여 사용을 정리한다
- [x] T013 `docs/part4_tables (1).json`에 quickstart jq contract 검사를 실행하고 동적 컬럼·행 정합성 결과를 기록한다
- [x] T014 `pnpm lint`를 실행하고 결과를 기록한다
- [x] T015 `pnpm exec tsc --noEmit`을 실행하고 결과를 기록한다
- [x] T016 `specs/010-part4-table-context/quickstart.md`의 가능한 수동/접근성 검증을 수행하고 기기나 backend 부재로 실행할 수 없는 항목을 명시한다
- [x] T017 최종 diff를 `specs/010-part4-table-context/spec.md`, `plan.md`, `tasks.md`와 대조하고 `plan.md` Developer Explain-Back 항목을 완료한다

---

## Dependencies & Execution Order

- Phase 1 → Phase 2가 모든 story를 차단한다.
- US1은 foundational 뒤 시작하며 US2, US3, US4가 공유하는 renderer와 흐름을 제공한다.
- US2와 US3은 US1 뒤 서로 독립적으로 검토할 수 있다.
- US4는 US1 renderer 뒤 수행한다.
- Polish는 모든 story 완료 뒤 수행한다.

## Parallel Opportunities

- T008과 T010은 US1 완료 뒤 서로 다른 파일 책임을 중심으로 병렬 검토할 수 있다.
- T009는 T008과 다른 파일이므로 함께 진행할 수 있다.
- T013은 소스 구현 완료 후 T014/T015와 독립적으로 실행할 수 있다.

## Implementation Strategy

1. T002–T004로 strict contract와 canonical table을 먼저 완성한다.
2. T005–T007로 live/reanswer MVP를 연결한다.
3. T008–T011로 상태, fallback, 진단, 반응형과 접근성을 강화한다.
4. T012–T017로 obsolete image 경로 제거, 정적 검사, 수동 검증과 artifact 대조를 마친다.

## Notes

- 모든 task는 실제 file path를 포함하며 story task는 `[US#]` label을 사용한다.
- 자동 test task는 test runner가 없어 추가하지 않는다.
- commit, push 또는 Jira write는 포함하지 않는다.
