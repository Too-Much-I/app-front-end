# Quickstart: 실제 채점 연동 통합 피드백 검증

## Static Validation

```sh
pnpm lint
pnpm exec tsc --noEmit
pnpm exec expo export --platform ios --clear --output-dir /tmp/app-feedback-export
```

## Empty State

1. 앱을 새로 열고 직접 피드백 탭을 선택한다.
2. `완료된 시험이 없어요`와 `모의고사 시작하기`가 보이는지 확인한다.
3. 네트워크에 summary 요청이 없는지 확인한다.
4. CTA가 MockExam 탭으로 이동하는지 확인한다.

## Actual Summary

1. 모의고사를 완료해 채점 완료까지 기다린다.
2. Feedback route에 동일 examId가 전달되는지 확인한다.
3. summary 요청 1회와 실제 총점/레벨/강약점/피드백을 확인한다.
4. fixture의 143점이나 고정 문구가 나타나지 않는지 확인한다.
5. Part max가 `6/6/9/9/5`이고 실제 partScores와 일치하는지 확인한다.

## Actual Question Detail

1. 각 파트의 문항별 피드백 버튼을 누른다.
2. query에 `questionNumber`와 `retryCount=0`이 전달되는지 확인한다.
3. 로딩 뒤 실제 transcript, score/maxScore, 첨삭과 추천 답변을 확인한다.
4. 빠르게 다른 Q를 선택해 이전 응답이 새 Q를 덮지 않는지 확인한다.
5. 실패를 재현해 다시 시도와 결과 복귀를 확인한다.

## State and Regression

1. 상세에서 돌아와 결과 scroll offset이 복원되는지 확인한다.
2. 칠판 앞뒤 boolean이 상세 왕복 뒤 유지되는지 확인한다.
3. 부분 응시에서 풀지 않은 Q 버튼과 누락 score polygon이 없는지 확인한다.
4. 마이페이지 목 피드백 카드가 제거됐는지 확인한다.
5. 홈 최근 피드백 목카드는 이번 범위대로 유지되는지 확인한다.

## Intentional Limitations

- 최근 결과 목록/저장 API가 없어 direct tab은 항상 param 없는 빈 상태다.
- 다시 답변 녹음 UI는 이번 범위가 아니며 retry-count 계약만 보존한다.
- 앱 재시작 뒤 마지막 examId를 복원하지 않는다.
