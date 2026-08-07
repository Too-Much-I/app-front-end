# Quickstart: Part 4 구조화 표 수동 검증

## Prerequisites

- backend 시험 생성 응답이 Q8에 `tableContext`를 제공한다.
- Q9/Q10 session context는 생략하거나 Q8과 동일하다.
- 문제 상세 응답은 Q8~Q10 어느 문제를 조회해도 `questionInfo.tableContext`를 제공한다.
- `docs/part4_tables (1).json`을 reference data로 사용한다.

## Static and contract checks

```sh
pnpm lint
pnpm exec tsc --noEmit
git diff --check
jq '{tables:length, rows:([.[].table_context.items[]]|length), max_columns:([.[].table_context.columns|length]|max), max_rows:([.[].table_context.items|length]|max)}' 'docs/part4_tables (1).json'
```

마지막 명령의 기대값은 tables 20, rows 130, max_columns 6, max_rows 10이다. 자동 test runner가
없으므로 formatter, mapper와 화면의 경계값은 아래 통합·기기 절차로 확인한다.

## Validation record — 2026-08-07

- `pnpm lint`: exit 0, warning 0.
- `pnpm exec tsc --noEmit`: exit 0.
- `pnpm exec expo export --platform all --output-dir /tmp/app-front-end-part4-table-dist`: exit 0,
  Android/iOS bundle 생성 성공.
- `git diff --check`: exit 0.
- reference JSON: tables 20, rows 130, max columns 6, max rows 10, null cells 24, empty
  cells 30, number cells 6, struck rows 3, status-note rows 5.
- reference JSON의 missing cell, extra cell, duplicate column 검사: 모두 0건.
- source scan에서 `tableImageUrl`, `ExamInformationImage`, Part 4 image error reason,
  `Object.values(cells)` 사용: 0건.
- runtime mapper의 missing/extra/duplicate/invalid issue는 사용자 표시값 없이 path만 개발 log에
  남기도록 코드 검토했다.
- 실제 backend tableContext session/question-detail 응답, iOS/Android 기기 가로·세로 gesture,
  큰 글자, VoiceOver/TalkBack 검증은 이 workspace에 연결된 backend test session과 기기가 없어
  실행하지 못했다. 아래 수동 절차는 통합 환경에서 확인해야 한다.

## Reference contract coverage

1. 20개 reference table을 backend test session 또는 개발 fixture로 차례로 제공한다.
2. 각 title, subtitle, metadata label/value, column label, 모든 row와 notes를 원본과 대조한다.
3. 130개 row가 원래 순서로 모두 있고 scheduled가 아닌 row도 사라지지 않는지 확인한다.
4. 빈 문자열 30개와 null 24개가 `—`, 숫자 6개가 원래 숫자 문자열로 표시되는지 확인한다.
5. 합성 fixture에 0, false, unknown table/value/status/key/scope, missing cell, extra cell과 duplicate
   column을 추가한다. 0과 No가 표시되고, missing cell은 `—`, unknown 문자열과 모든 row/column
   선언은 유지되며 extra cell이 새 열이 되지 않는지 확인한다.
6. 개발 log는 계약 issue path를 보여주되 email, phone, 사람 이름과 cell 본문을 출력하지 않는지
   확인한다.

## Live exam happy path

1. Part 4 directions를 완료한다.
2. 구조화 표의 최초 layout 전에는 45초 timer가 감소하지 않고 준비 완료 action이 비활성인지
   확인한다.
3. table ready 뒤 45초가 active/focused 동안만 감소하는지 확인한다.
4. app을 background로 보낸 시간은 남은 시간에서 빠지지 않는지 확인한다.
5. 준비 완료와 timer 만료 각각으로 Q8 준비에 정확히 한 번 이동하는지 확인한다.
6. Q8, Q9, Q10에서 같은 title, columns와 rows가 계속 표시되는지 확인한다.

## Status and strike presentation

1. mock_exam_005의 available/unavailable status note가 cell과 별도 badge로 표시되는지 확인한다.
2. mock_exam_007, 008, 018의 struck row 전체 cell 값에 취소선이 있고 badge에는 없는지 확인한다.
3. mock_exam_005/010 notes가 scope 연결 성공 여부와 무관하게 모두 표시되는지 확인한다.

## Responsive and accessibility

1. 6-column mock_exam_004를 작은 iOS/Android 휴대폰에서 열고 grid의 첫 열부터 마지막 열까지
   horizontal scroll되는지 확인한다.
2. 긴 표의 title부터 마지막 note와 하단 준비 완료 action까지 vertical scroll되는지 확인한다.
3. 태블릿에서 2~3열 표가 불필요하게 좁지 않고 available width를 채우는지 확인한다.
4. 큰 글자 설정에서 cell을 자르는 fixed height/line limit와 badge 겹침이 없는지 확인한다.
5. VoiceOver/TalkBack으로 column header, 각 cell의 header/value 관계, 값 없음과 status 설명을
   색이나 취소선 없이 이해할 수 있는지 확인한다.

## Invalid and recovery paths

1. Q8 context를 제거하고 later context도 제거해 missing table 오류가 Part 4 timer/Q8/recorder를
   차단하는지 확인한다.
2. context를 Q9에만 두어 misplaced 오류를 확인한다.
3. Q9에 의미가 다른 반복 context를 두어 conflicting 오류를 확인하고, cells property 순서만
   바꾼 동일 context는 충돌하지 않는지 확인한다.
4. columns를 제거하거나 유효한 key가 없는 column을 주어 invalid 오류를 확인한다.
5. Part 4 question detail의 context를 제거해 재답변이 question-failed 안내를 표시하고 recorder를
   열지 않는지 확인한다.
6. 일반 `imageUrl`을 사용하는 다른 Part 문제 사진이 기존처럼 표시되는지 회귀 확인한다.
