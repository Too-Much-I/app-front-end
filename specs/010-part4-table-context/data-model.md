# Data Model: Part 4 구조화 표 렌더링

## Raw boundary

시험 session의 `questions[].tableContext`와 문제 상세의 `questionInfo.tableContext`가 같은 public
표 객체를 사용한다. 참조 JSON의 바깥 `mock_exam_id`, `title`, `table_context` 래퍼는 offline
자료 구조이며 endpoint payload에는 포함되지 않는다.

### RawExamTableContext

- `table_type: string`
- `title: string`
- `subtitles: string[]`
- `metadata: RawExamTableMetadata[]`
- `columns: RawExamTableColumn[]`
- `items: RawExamTableItem[]`
- `notes: RawExamTableNote[]`

하위 wire 필드는 metadata `{ key, label, value }`, column `{ key, label, value_type }`, item
`{ cells, status, status_note, strike_through }`, note `{ scope, text }`다. scalar는
`string | number | boolean | null`이다.

## Domain entities

### ExamTableContext

- `tableType: string` — dispatch에 사용하지 않는 열린 값
- `title: string`
- `subtitles: string[]`
- `metadata: ExamTableMetadata[]`
- `columns: ExamTableColumn[]`
- `items: ExamTableItem[]`
- `notes: ExamTableNote[]`

### ExamTableMetadata

- `key: string`
- `label: string`
- `value: ExamTableScalar`

### ExamTableColumn

- `key: string` — cells 조회의 유일한 기준
- `label: string`
- `valueType: string` — 표시값 변환에 사용하지 않는 열린 값

### ExamTableItem

- `cells: Record<string, ExamTableScalar>`
- `status: string`
- `statusNote: string | null`
- `strikeThrough: boolean`

### ExamTableNote

- `scope: string` — metadata 연결을 강제하지 않는 열린 값
- `text: string`

### TableContractIssue

- `code: string` — missing field/cell, extra cell, duplicate column 또는 invalid scalar 구분
- `path: string` — question/metadata/column/row/key 위치, 실제 표시값은 포함하지 않음

## Mapping result

- whole value가 객체가 아니거나 table type/title/columns/items의 핵심 구조가 유효하지 않거나,
  usable string key가 없는 column이 있거나 column이 0개면 non-displayable failure다.
- subtitles, metadata, rows와 notes의 복구 가능한 항목 오류는 배열 위치를 유지하고 빈 문자열,
  null, unknown status 또는 false를 안전한 기본값으로 사용한다.
- malformed/missing cells는 빈 record로 바꿔 선언된 모든 cell이 `—`로 표시되게 한다.
- invalid scalar는 null로 바꾸고 issue를 남긴다. scalar display 문자열은 trim하거나 재파싱하지 않는다.
- duplicate columns는 그대로 두며 같은 cells key를 선언 순서대로 두 번 표시한다.
- extra cells는 record에 보존하지만 renderer가 임의 column을 만들지 않는다.

## Session normalization rules

1. Part 4가 없으면 표 prelude도 요구하지 않는다.
2. Q8에 tableContext가 없고 Q9/Q10에도 없으면 `missing-part4-table`이다.
3. Q8에는 없고 후속 문제에만 있으면 `misplaced-part4-table`이다.
4. Q8 tableContext가 non-displayable이면 `invalid-part4-table`이다.
5. Q9/Q10은 tableContext를 생략할 수 있다.
6. 반복 tableContext가 non-displayable이면 `invalid-part4-table`, canonical 표와 구조적으로 다르면
   `conflicting-part4-table`이다.
7. 구조 비교는 array 순서와 scalar를 그대로 비교하되 cells record key 순서는 의미에서 제외한다.
8. valid이면 prelude와 모든 Part 4 ExamQuestion은 같은 canonical ExamTableContext를 참조한다.

## Question-detail rules

- non-Part 4 question은 tableContext가 없어도 유효하다.
- Part 4 question detail은 displayable tableContext가 필수다.
- Part 4 table이 없거나 non-displayable이면 mapper가 계약 오류를 발생시키며 재답변 조회는 failed로
  전환한다.

## State transitions

```text
directions
  -> valid Part 4 table -> part4-reading(tableReady=false, remaining=45s)
  -> invalid Part 4 table -> part-prelude-error -> exit

part4-reading
  -> first table layout -> tableReady=true -> active/focused countdown
  -> app inactive/blur -> preserve remaining -> active/focused countdown
  -> ready + user completes -> Q8 question cue/preparation
  -> countdown reaches zero -> Q8 question cue/preparation

Q8 -> Q9 -> Q10
  each renders the same canonical table; prelude does not repeat

reanswer detail
  -> valid Part 4 table -> question card + recording flow
  -> missing/invalid Part 4 table -> question-failed -> feedback return
```

`completePart4Reading`은 현재 phase와 table readiness를 확인한다. 최초 완료가 phase를 동기적으로
바꾸므로 timer와 button이 동시에 호출돼도 한 번만 다음 단계로 전환한다.
