# UI Contract: 실제 채점 연동 통합 피드백

## Feedback Navigation

- `Feedback: { examId: string } | undefined`
- GradingWait 완료: `navigate("Feedback", { examId })`
- direct tab: params 없음 → empty state

## Summary Request

- Input: non-empty `examId`
- API: `getExamGradingResult(examId, signal)`
- Output: `RemoteData<ExamGradingResult>`
- Retry: 동일 examId로 새 AbortController 요청

## Question Request

- Input: `examId`, valid part/question, `retryCount=0`
- API: `getExamQuestionFeedback(examId, questionNumber, 0, signal)`
- Output: `RemoteData<ExamQuestionDetail>`
- Selection change/back/unmount: 이전 요청 abort

## Empty State

- 보이는 제목: `완료된 시험이 없어요`
- 설명: 모의고사를 완료하면 실제 피드백을 확인할 수 있다는 안내
- CTA: `모의고사 시작하기` → MockExam tab
- API calls: 0

## Error States

- 요약 오류: 오류 안내, `다시 시도`, `모의고사로 이동`
- 문제 오류: 현재 Part/Q 안내, `다시 시도`, `결과로 돌아가기`
- 모든 버튼은 보이는 레이블과 accessibilityLabel 제공

## Existing Result Components

성공 데이터만 입력받는다. 점수/피드백 문자열은 실제 domain 객체에서 읽고 fixture fallback을 사용하지 않는다. 기존 마스코트는 장식 asset으로만 사용한다.
