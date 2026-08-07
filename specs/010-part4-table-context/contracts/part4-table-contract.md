# Contract: Part 4 Table Data and Presentation

## Transport placement

- 시험 생성: `result.questions[].tableContext`
- 문제 상세: `result.question.questionInfo.tableContext`
- 바깥 property는 camelCase `tableContext`, 내부 public field는 snake_case다.
- `docs/part4_tables (1).json`의 `table_context` wrapper는 reference fixture이며 endpoint 계층이 아니다.

Q8 session question은 tableContext를 반드시 제공한다. Q9/Q10 session question은 생략하거나 같은
객체를 반복할 수 있다. 단일 Part 4 question detail은 문제 번호와 관계없이 tableContext를
제공한다.

## Public object shape

```text
table_context
├── table_type: string
├── title: string
├── subtitles: string[]
├── metadata[]: { key, label, value: scalar }
├── columns[]: { key, label, value_type: string }
├── items[]
│   ├── cells: Record<column key, scalar>
│   ├── status: string
│   ├── status_note: string | null
│   └── strike_through: boolean
└── notes[]: { scope, text }

scalar = string | number | boolean | null
```

`table_type`, `value_type`, column key, status와 scope는 closed enum이 아니다. 새 문자열은 기존
클라이언트에서도 유효하다.

## Mapping contract

- wire snake_case는 domain camelCase로 한 번만 정규화한다.
- display string과 array 순서는 보존한다.
- 값 종류를 근거로 날짜, 시간, 통화 또는 숫자를 다시 parsing하지 않는다.
- fatal 구조 오류는 valid domain 객체로 가장하지 않는다.
- recoverable row/cell 오류는 row를 제거하지 않고 issue와 표시 fallback을 함께 만든다.
- 진단 log에는 exam/question/row/key path만 포함하고 cell/metadata 본문은 포함하지 않는다.

## Presentation contract

- title, subtitles, metadata, columns/items, notes를 각각 표시한다.
- row cell은 `columns` 순서로 `cells[column.key]`를 조회한다.
- `Object.values(cells)`와 status 기반 filtering을 사용하지 않는다.
- null, undefined와 빈 문자열은 `—`; boolean은 `Yes`/`No`; 나머지는 `String(value)`다.
- `status_note`가 있으면 status 원 문자열과 함께 cell row 밖의 badge로 표시한다.
- `strike_through`는 모든 cell display Text에만 적용하고 badge에는 적용하지 않는다.
- extra cells는 표시 column을 만들지 않는다.
- title/metadata/notes와 전체 table은 부모의 vertical scroll에 포함된다. header/cell grid만
  horizontal scroll하고 column은 읽을 수 있는 최소 너비와 자연 높이를 가진다.
- column header는 header semantics를, cell은 column label과 표시값을 함께 읽는 음성 label을 가진다.

## Ready and failure contract

- Part 4 읽기 timer는 table root의 최초 layout과 app active/focused를 모두 만족한 뒤에만 감소한다.
- 준비 완료 action은 table ready 전에는 비활성화한다.
- missing/misplaced/invalid/conflicting session table은 첫 문제와 recorder를 차단한다.
- missing/invalid question-detail table은 재답변 recorder를 차단하고 기존 question load failure
  recovery를 사용한다.
- missing cell과 unknown extension string은 전체 table failure가 아니다.
