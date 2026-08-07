# Implementation Plan: Part 4 구조화 표 렌더링

**Branch**: `feat/responsive-scaling` (feature ID: `010-part4-table-context`) | **Date**:
2026-08-07 | **Spec**: [spec.md](./spec.md)

**Approval**: Approved 2026-08-07 — 사용자가 "어 구현해줘"라고 요청해 이 계획의 구현 진행을
승인했다.

**Input**: Feature specification from `/specs/010-part4-table-context/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Part 4가 원격 표 이미지 대신 `tableContext`를 받도록 raw API, mapper, 시험 session과 문제
상세 domain 경계를 전환한다. 의존성을 추가하지 않고 수동 runtime mapper가 snake_case wire
필드를 camelCase domain으로 정규화하며, Q8의 유효한 표를 canonical 객체로 만들어 읽기
단계와 Q8~Q10에 공유한다. 공용 React Native 표 컴포넌트는 제목과 모든 부가 정보를 일반
흐름에, 동적 컬럼 grid만 가로 ScrollView에 표시한다. 누락·추가 셀은 행을 제거하지 않고
대체 기호와 개발 진단으로 복구하며, 표 전체가 표시 불가능한 경우에만 기존 prelude 오류와
재답변 조회 실패 경로를 사용한다.

## Technical Context

**Language/Version**: strict TypeScript 6.0, React 19.2

**Primary Dependencies**: Expo 57, React Native 0.86, NativeWind 4.2; 새 dependency 없음

**Storage**: N/A — API 응답을 현재 시험 및 재답변 화면 수명 동안만 사용

**Testing**: `pnpm lint`, `pnpm exec tsc --noEmit`, 참조 JSON jq 검증, iOS/Android 수동 검증;
자동 test runner는 구성되어 있지 않음

**Target Platform**: Expo 기반 iOS 및 Android 휴대폰·태블릿

**Project Type**: React Native mobile application

**Performance Goals**: 참조 최대 크기인 6열·10행을 가상화나 추가 로딩 없이 한 번의 화면
렌더 흐름에서 표시하고, 스크롤 중 사용자 입력에 체감 지연이 없을 것

**Constraints**: 표시 문자열 재파싱 금지, 동적 키·종류·상태를 열린 문자열로 보존, 행 필터링
금지, 기존 세로 ScrollView 안에서 가로 표 스크롤 제공, Jua 단일 weight와 공유 Text 사용,
표 layout 전 45초 timer 시작 금지

**Scale/Scope**: 참조 표 20개, 표당 2~6열·5~10행; live reading, Q8~Q10 문제, 재답변의 세
표시 경로와 session/question-detail API 경계

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] The specification is approved and separates facts, assumptions, scope, out-of-scope behavior, and open questions.
- [x] Acceptance criteria describe observable behavior and include failure or interruption paths.
- [x] The design uses Expo/React Native APIs and preserves strict TypeScript and existing architectural boundaries.
- [x] Existing shared UI, theme, navigation, API, mapper, and domain layers are reused where applicable.
- [x] At least two viable approaches were considered, or the plan explains why only one approach is practical.
- [x] The validation plan includes `pnpm lint`, `pnpm exec tsc --noEmit`, and relevant manual or device checks.
- [x] No secret or unapproved Jira write, commit, push, dependency addition, or other external side effect is required.

**Pre-research gate**: PASS. **Post-design re-check**: PASS. Phase 1 adds no dependency, browser API,
navigation change, storage or external side effect. Raw → mapper → domain and shared UI boundaries remain
explicit.

## Current Flow

1. Sound test가 `createExamSession()`을 호출하고 `POST /api/v1/exams`의 `RawExamSession`을
   `mapExamSession()`으로 변환한 뒤 navigation param으로 `ExamSessionScreen`에 전달한다.
2. 현재 raw/domain question은 `tableImageUrl`을 가지며 `part-prelude.ts`가 Q8의 HTTP(S)
   URL을 canonical image로 선택한다. Q9/Q10은 URL을 생략하거나 같은 URL을 반복할 수 있고,
   뒤에만 있거나 다르면 invalid prelude가 된다.
3. `mapExamSession()`은 canonical URL을 모든 Part 4 domain question에 복사하고
   `ExamPartReadingPrelude`에도 넣는다.
4. Part 4 directions 종료 후 controller는 45초를 준비하고 `isReadingImageLoaded=false`인
   `part4-reading`으로 전환한다. `ExamInformationImage`의 native image `onLoad`가 true를
   만들 때만 active/focused 시간 동안 timer가 감소한다.
5. timer 만료와 준비 완료 버튼은 같은 guarded completion을 호출해 Q8 준비로 한 번만
   이동한다. Q8~Q10 문제 콘텐츠는 canonical 이미지를 다시 표시한다.
6. 재답변은 단일 문제 상세 API의 `questionInfo.tableImageUrl`을 직접 domain에 복사하고
   `ReanswerQuestionCard`가 같은 이미지 컴포넌트를 표시한다. 이 경로는 Q8 데이터를 별도로
   조회하거나 live canonicalization을 사용하지 않는다.
7. WebView data bridge의 문제 피드백 응답은 서버 raw result를 그대로 전달하므로 native
   table mapper와 결합되지 않는다.

## Design Options

### Option A - Native grid + shared runtime mapper

하나의 수동 `unknown → mapper → domain` 경계에서 wire 필드를 검증·정규화하고, 하나의 공용
Part 4 표 컴포넌트를 live reading, live question 및 reanswer에서 사용한다. 표의 제목·부제·
metadata·notes는 일반 폭에 두고, 동일 최소 너비의 header/cell View로 만든 grid만 내부 가로
ScrollView에 둔다. 바깥 화면은 기존 세로 ScrollView를 유지한다.

- 장점: dynamic columns 순서와 표 비교 구조를 그대로 보존하고 세 표시 경로가 포맷·fallback·
  접근성 규칙을 공유한다. Expo/RN API만 사용하며 새 dependency와 원격 load 실패가 없다.
- 비용: React Native에는 HTML table layout/semantics가 없어 열 너비와 음성 label을 직접
  정의해야 한다. 작은 화면은 가로 gesture가 필요하다.
- 실패 모드: mapper가 전체 표 구조 오류를 놓치면 renderer가 crash할 수 있으므로 모든 배열과
  scalar를 runtime 검사한다. 가로 overflow는 indicator와 안내로 발견 가능하게 한다.

### Option B - Screen-specific vertical row cards

각 화면이 행을 카드로 만들고 컬럼 label/value를 세로로 반복한다.

- 장점: 가로 scroll 없이 작은 화면과 긴 문자열을 표시하기 쉽다.
- 비용: live와 reanswer 규칙이 중복되고, 6열 표에서 label이 행마다 반복되어 세로 길이가 크게
  늘어난다. 사용자가 열과 행을 교차 비교하기 어렵고 서버가 제공한 표 구조가 약해진다.
- 실패 모드: 화면별 formatter와 status 처리 차이로 일부 정보가 한 경로에서 다시 누락될 수 있다.

### Option C - WebView HTML table

HTML table과 CSS를 WebView로 표시하면 표 layout과 일부 semantics를 사용할 수 있다.

- 장점: 브라우저 table layout이 column alignment와 overflow를 제공한다.
- 비용: 작은 로컬 표를 위해 bridge, document lifecycle과 load/error/ready 상태를 새로 만들며
  native app 원칙과 기존 화면 계층을 벗어난다.
- 실패 모드: WebView load 실패가 다시 Part 4 진행을 막고, 글자 scaling·theme·접근성이 native
  화면과 달라질 수 있다.

## Decision

Option A를 선택한다. public wire 계약은 `RawExamTable*` 타입으로 문서화하되 실제 네트워크
값은 수동 mapper가 `unknown`으로 검사한다. `table_type`, `value_type`, `status_note`,
`strike_through`는 camelCase domain으로 옮기고 값 자체와 열린 문자열은 그대로 보존한다.

Q8의 유효한 표를 canonical domain 객체로 삼아 prelude와 Q8~Q10이 같은 참조를 사용한다.
Q9/Q10의 반복 표는 배열 순서는 보존하고 cells key 순서만 무시하는 구조 비교로 충돌을
검사한다. 재답변은 단일 문제만 조회하므로 서버가 각 Part 4 문제 상세의
`questionInfo.tableContext`를 제공하는 현재 계약에 의존한다. 누락되면 문제 없이 녹음을
허용하지 않고 기존 question-failed 복구 화면으로 보낸다.

공용 renderer는 cells를 `columns.map`으로만 조회한다. 행이나 중복 컬럼을 제거하지 않고,
누락 scalar는 `—`, boolean은 `Yes`/`No`, 그 밖의 값은 `String(value)`로 표시한다. status
badge는 cell row의 sibling으로 두어 취소선과 분리하고 알려지지 않은 status도 원문을
보존한다. 기존 표 이미지 viewer는 참조가 모두 사라진 뒤 제거한다. Option B는 비교 가능성과
재사용성이 낮고 Option C는 불필요한 browser lifecycle을 추가하므로 기각한다.

## Failure and Recovery Paths

- Q8에 tableContext가 없고 후속에도 없으면 `missing-part4-table`, 후속에만 있으면
  `misplaced-part4-table`, Q8 또는 반복 표가 표시 불가능하면 `invalid-part4-table`, 반복 표가
  다르면 `conflicting-part4-table` invalid prelude를 만든다.
- invalid prelude는 기존처럼 directions 뒤 첫 문제, 45초 timer와 recorder를 시작하지 않고
  원인을 표 용어로 안내한 뒤 시험 이탈을 제공한다. 로컬 구조화 데이터에는 원격 이미지 재시도
  동작을 제공하지 않는다.
- 표 객체는 존재하지만 row cells가 없거나 선언 셀이 누락되면 행을 유지하고 해당 셀을 `—`로
  표시한다. extra cells는 column을 합성하지 않는다. 두 경우 모두 개발 환경에서 값 본문 없이
  question/row/key path를 한 번에 경고한다.
- 알 수 없는 table/value/status/key/scope 문자열은 오류가 아니며 기본 style과 원 문자열로
  표시한다. metadata/note/row의 복구 가능한 잘못된 항목도 배열 위치를 유지하고 대체값을 쓴다.
- Part 4 문제 상세에 유효한 tableContext가 없으면 mapper가 전용 계약 오류를 발생시키고
  `useReanswerQuestion`의 기존 failed 상태가 녹음을 막고 피드백 복귀를 제공한다.
- 공용 표 root의 최초 `onLayout`만 table-ready를 알린다. 방향 전환 등 재-layout은 timer를
  재설정하지 않으며 controller도 현재 phase를 확인한다. 준비 완료 버튼은 ready 전 비활성화한다.
- app background/blur 동안 기존처럼 잔여 읽기 시간을 보존한다. timer 만료와 준비 완료가
  동시에 발생해도 phase guard를 먼저 통과한 전환 하나만 적용한다.
- 부분 구현 중 rollback은 새 tableContext 필드, mapper와 renderer 변경을 한 논리 단위로
  되돌린다. 서버가 이미지 URL을 더 이상 제공하지 않으므로 이미지 fallback과 이중 계약은 두지
  않는다.

## Developer Explain-Back

- [x] The affected files and their responsibilities can be explained.
- [x] The changed data and state transitions can be described in order.
- [x] The selected tradeoffs and rejected alternatives can be explained.
- [x] The validation and rollback approach can be explained.

## Project Structure

### Documentation (this feature)

```text
specs/010-part4-table-context/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── components/
│   └── exam/
│       └── Part4Table.tsx                  # shared dynamic native table renderer
├── features/
│   └── exam/
│       ├── map-exam-table-context.ts       # runtime mapping, diagnostics, equality
│       ├── map-exam-session.ts             # canonical table propagation
│       ├── map-exam-question-info.ts       # question-detail table mapping
│       └── part-prelude.ts                  # Q8 table validation/conflict reasons
├── screens/
│   ├── mock-exam/
│   │   ├── ExamSessionScreen.tsx           # table-ready wiring and button guard
│   │   ├── hooks/
│   │   │   └── use-exam-session-controller.ts
│   │   └── components/
│   │       ├── ExamInformationReading.tsx  # prelude table presentation
│   │       ├── ExamQuestionContent.tsx     # Q8-Q10 table presentation
│   │       ├── ExamPreludeError.tsx         # table-specific invalid messages
│   │       └── ExamInformationImage.tsx     # remove after references reach zero
│   └── reanswer/
│       └── components/
│           └── ReanswerQuestionCard.tsx    # question-detail table presentation
└── types/
    └── exam.ts                             # raw/domain table and prelude contracts
```

**Structure Decision**: API/domain 타입은 기존 `src/types/exam.ts`, 변환과 session 규칙은
`src/features/exam/`, 화면 간 공유 renderer는 새 `src/components/exam/`에 둔다. 이 위치는
reanswer가 mock-exam screen 내부 컴포넌트에 의존하지 않게 하면서 일반 UI primitive와 exam
domain 사이 책임을 분리한다. navigation과 endpoint 파일은 계약 타입 갱신만으로 동작해 변경하지
않는다.

## Complexity Tracking

해당 없음. Constitution 예외나 새 dependency가 필요하지 않다.
