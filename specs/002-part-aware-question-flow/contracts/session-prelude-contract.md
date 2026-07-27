# Contract: Session Prelude Normalization

## Input

`mapExamSession(raw: RawExamSession)`은 기존 raw 문항 필드를 입력으로 받는다. raw 계약은 서버
호환성을 위해 optional을 유지한다.

## Output

mapper는 `ExamSession.partPreludes`에 세션에 존재하는 Part 3/4별 항목을 하나씩 추가한다.

```ts
type ExamPartPrelude =
  | { kind: "part3-intro"; partNumber: 3; text: string; guideAudioUrl: string }
  | {
      kind: "part4-reading";
      partNumber: 4;
      tableContext: ExamTableContext;
      durationSec: 45;
    }
  | { kind: "invalid"; partNumber: 3 | 4; reason: ExamPartPreludeInvalidReason };
```

## Part 3

- 첫 Part 3 문항의 non-empty `partIntroText`와 `guideAudioUrl`만 유효하다.
- `/assets/audio/part3_intro.wav`와 HTTP(S) URL을 지원한다.
- 지원하지 않는 local path와 후속 문항에만 위치한 값은 invalid다.

## Part 4

- Q8의 유효한 `tableContext`가 canonical이다.
- Q9/Q10은 표를 생략하거나 canonical과 동일하게 반복할 수 있다.
- mapper는 valid Part 4의 Q8~Q10 domain question에 canonical 객체를 할당한다.
- 표는 45초 사전 읽기와 각 문제 화면에 모두 표시된다.
- later-only/conflicting 표는 합치지 않고 invalid로 반환한다.

## Failure behavior

정규화 실패는 throw하지 않는다. 해당 part의 `invalid` 항목을 반환해 controller가 문제 준비와
recorder를 차단하고 사용 가능한 이탈 행동을 표시하게 한다.
