# Contract: Exam Prelude and Recovery Presentation

## Direction presentation

- directions phase는 별도 rounded card 없이 화면 전체에 `surface-subtle`을 사용한다.
- 시험 root, 문제, 참고 지문, Part 3 상황, Part 4 표, 제출 실패 카드는 white/neutral이다.

## Part 3 presentation

- 첫 문제를 렌더링하지 않고 제공된 text와 guide audio 상태를 표시하며 별도 "상황 안내"
  제목은 표시하지 않는다.
- 정상 terminal playback event만 `onComplete`를 한 번 호출한다.
- playback failure 또는 media reset은 완료가 아니며 재생 재시도와 시험 이탈을 제공한다.
- 화면 blur/inactive 시 pause하고, 다시 active가 되면 처음부터 재생한다.

## Part 4 presentation

- 첫 문제 전에 질문 문구 없이 canonical 표와 `READING TIME` 45초만 표시한다.
- table layout 전에는 timer를 시작하지 않는다.
- blur/inactive 동안 countdown을 멈추고 visible/focused 시간 합계가 45초일 때 완료한다.
- 사용자가 준비 완료를 누르면 남은 읽기 시간을 생략하고 Q8의 개별 preparation으로 전환한다.
- 같은 canonical 표를 Q8, Q9, Q10 문제 콘텐츠에도 계속 렌더링한다.

## Invalid prelude presentation

- 첫 문제, preparation timer, recorder를 렌더링하거나 시작하지 않는다.
- 어떤 필수 정보에 문제가 있는지 설명하고 ready screen으로 이탈할 수 있게 한다.

## Submission recovery presentation

- `submission-barrier` 전체는 safe-area 내부 vertical ScrollView다.
- 긴 목록은 상단부터 자연스럽게 흐르고 마지막 버튼 아래에 bottom content padding을 둔다.
- 실패 카드/버튼은 자연 높이를 사용하며 `maxHeight`, 고정 높이, `numberOfLines`로 자르지 않는다.
- registry는 전체 `(examId, questionNumber, retryCount)` identity를 유지하고, 단일 시험 화면의
  rendering key에만 `questionNumber:retryCount`를 사용한다.
