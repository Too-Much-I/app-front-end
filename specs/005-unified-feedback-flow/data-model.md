# Data Model: 실제 채점 연동 통합 피드백

## Route Input

### FeedbackRouteParams

- `examId: string`
- route 전체는 optional이며 없으면 empty state

## Existing Domain Entities

### ExamGradingResult

요약 API raw 응답을 mapper로 정규화한 실제 결과. 총점, 레벨, 푼 문제 수, 요약, 종합/파트 피드백, 강약점과 partScores를 제공한다.

### ExamQuestionDetail

문제 상세 API raw 응답을 mapper로 정규화한 실제 최초 회차 결과. `retryCount=0`, `totalRetryCount`, 답변, 평가, 첨삭과 추천 답변을 제공한다.

## RemoteData<T>

```text
idle
loading
success(data: T)
error(message: string)
```

요약은 `examId`가 없으면 idle을 유지한다. 문항은 선택이 없으면 idle이다. retry는 같은 key로 loading을 다시 시작한다.

## FeedbackView

```text
{ mode: "result" }
{ mode: "question", partNumber, questionNumber }
```

문항 remote data와 별개로 화면 선택만 소유한다. result 복귀 시 저장된 scroll offset을 복원한다.

## FeedbackPartViewModel

- `partNumber: 1 | 2 | 3 | 4 | 5`
- `titleKo: string`
- `score: number | null`
- `maxScore: 6 | 9 | 5`
- `status: positive | caution | improvement | unavailable`
- `statusLabel: string`
- `feedback: string`
- `questionNumbers: number[]`
- `mascot: ImageSource`

생성 규칙:

1. Part max는 `1:6, 2:6, 3:9, 4:9, 5:5`.
2. 점수는 실제 `partScores`; 누락/범위 밖 값은 null.
3. 상태는 유효 비율에서 파생하고 null은 unavailable.
4. Q 목록은 정규 파트 구성 중 `questionNumber ≤ totalSolvedQuestions`만 포함.
5. 피드백이 없는 파트는 실제 결과에 존재하지 않는 것으로 처리한다.

## Retry Count Contract

- 최초 답변 key: `retryCount=0`
- 다음 사용자 재답변 key: 현재 상세의 `totalRetryCount`
- 동일 답변 upload/notify 재시도: 기존 key 유지
- 취소된 녹음: 증가 없음

## Validation

- 빈/공백 examId는 없는 값으로 처리한다.
- API raw는 반드시 mapper를 통과한다.
- 요청 key가 변경되거나 unmount되면 이전 요청을 abort한다.
- 늦은 응답은 현재 key와 일치할 때만 반영한다.
- radar polygon은 다섯 파트 점수가 모두 유효할 때만 표시한다.
