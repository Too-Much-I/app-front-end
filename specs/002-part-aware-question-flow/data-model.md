# Data Model: 파트별 시험 흐름과 복구 접근성

## Raw boundary

`RawExamQuestion`의 `partIntroText`, `guideAudioUrl`, `tableContext`는 optional이다. 서버의 누락,
공백, 잘못된 위치, Part 4 반복 충돌은 mapper가 해석하며 UI로 직접 누출하지 않는다.

## Domain entities

### ExamPartIntroPrelude

- `kind: "part3-intro"`
- `partNumber: 3`
- `text: string` — trim 후 비어 있지 않은 상황 설명
- `guideAudioUrl: string` — 지원되는 번들 논리 경로 또는 HTTP(S) URL

### ExamPartReadingPrelude

- `kind: "part4-reading"`
- `partNumber: 4`
- `tableContext: ExamTableContext` — Q8에서 얻은 canonical shared table
- `durationSec: 45`

### InvalidExamPartPrelude

- `kind: "invalid"`
- `partNumber: 3 | 4`
- `reason` — `missing-part3-intro`, `missing-part3-guide-audio`,
  `misplaced-part3-content`, `unsupported-part3-guide-audio`, `missing-part4-table`,
  `misplaced-part4-table`, `conflicting-part4-table`, `invalid-part4-table` 중 하나

### ExamSession

- 기존 `examId`, `title`, `questions`
- `partPreludes: ExamPartPrelude[]`

Part 4 prelude가 valid이면 모든 Part 4 `ExamQuestion.tableContext`는 같은 canonical 객체를
참조한다. 따라서 준비 화면과 Q8~Q10 문제 화면은 같은 데이터를 별도 presentation 시점에
렌더링한다.

## Validation rules

1. 세션에 Part 3이 있을 때 첫 Part 3 문항에 text와 guide URL이 함께 있어야 한다.
2. 두 문자열은 trim 후 비어 있지 않아야 한다.
3. Part 3 데이터가 후속 문항에만 있으면 위치 오류다.
4. 세션에 Part 4가 있을 때 Q8에 구조적으로 유효한 표가 있어야 한다.
5. Q9/Q10 표는 생략하거나 canonical 표와 구조적으로 동일해야 한다.
6. 후속 문항에만 표가 있거나 서로 다른 표가 반복되면 invalid다.
7. Part 1/2/5만 있는 세션은 Part 3/4 prelude 없이 유효하다.

## State transitions

```text
new part -> directions
directions -- Part 1/2/5 --> preparation
directions -- valid Part 3 --> part3-intro -- audio finished --> preparation
directions -- valid Part 4 --> part4-reading -- visible 45s or user completes --> preparation
directions -- invalid Part 3/4 --> part-prelude-error -- exit --> ready screen
preparation -> starting-response -> response -> finalizing -> next question
last answer registered -> submission-barrier -> completed
```

Part prelude 완료 marker는 현재 mounted 시험 run에만 유지한다. 같은 파트 후속 문항과 녹음
재시도는 prelude로 되돌아가지 않는다.
