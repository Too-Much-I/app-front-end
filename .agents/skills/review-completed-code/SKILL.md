---
name: review-completed-code
description: Review this project's completed, verified code changes when its code-review hook requests a review, and record the user's explicit assessment of review findings. Preserve the user's skeleton-writing phase and return proposals without automatic refactoring.
---

# 구현 완료 코드 리뷰

훅이 제공한 실행 ID의 `packet`을 읽는다. `phase: awaiting-review`이고 필수 검사 4개가
모두 통과한 실행만 리뷰한다. 수동 요청이어도 초안·스켈레톤을 구현 완료로 추정하지 않는다.
현재 작업에 실행 ID가 없다면 `docs/code-review-cycle.md`의 시작·완료 조건부터 확인한다.

## 범위와 판단

- `changes`의 before/after가 이번 구현 범위다. 기존 dirty 변경을 포함하는 HEAD diff로
  대체하지 않는다. 필요한 호출자·관련 문서는 읽되 범위 밖 코드를 수정하지 않는다.
- `AGENTS.md`, `docs/architecture/05-declarative-code.md`와 변경 영역의 기존 기준 구현을
  비교한다. 관련될 때만 naming·dependency·디자인 시스템 문서를 추가로 읽는다.
- 상태와 유효 데이터가 결합되는지, 전체 분기가 누락을 드러내는지, 판단과 I/O의 책임이
  분명한지, 추상화가 읽는 맥락을 줄이면서 불필요한 결합을 만들지 않는지 검토한다.
- 이미 검사에서 다루는 포맷·타입·명백한 import 위반을 새로운 구조 지적으로 반복하지 않는다.
- 각 제안에는 위치, 프로젝트 기준 또는 재현 가능한 근거, 실제 영향, 최소 변경안을 적는다.
  막연한 취향·줄 수 감소·파일 분할 자체를 개선 근거로 삼지 않는다.
- 동작 보존을 주장할 때 유지해야 할 동작을 구체화한다. 코드 품질 기준이 충돌하면
  선택지와 부담을 제안에 적는다. 사용자 대신 결정하거나 리팩토링을 적용하지 않는다.
- 사용자 스켈레톤의 TODO·주석·누락 import를 리팩토링 제안으로 채우지 않는다.
- 지적 개수를 맞추지 않는다. 근거 있는 지적이 없으면 findings를 빈 배열로 제출한다.

## 시나리오 지도

`packet`의 `learning.path`가 있으면 리뷰를 제출한 뒤 그 학습 기록의 "시나리오 지도"에 깨질 수 있는
시나리오 3개를 쓴다. 각 시나리오는 시작 조건, 찾을 질문, 지나가는 함수(`파일:줄`)만 적는다.
답, 결과, 답을 암시하는 표현은 쓰지 않는다. 리뷰 지적과 같은 내용을 시나리오로 반복하지 않는다.
"구현 전 예상", "내가 찾은 것", "흐름 설명", "예상과 달라진 것"은 사람이 쓰며 AI가 채우거나 다듬지 않는다.
`submit` 응답의 `learning.missing`과 `predictionChanged`를 사용자에게 알린다. 비어 있으면 머지 전
CI가 막는다는 사실을 함께 알린다.

## 결과 기록

`output/code-review/<실행ID>-report.json`에 다음 모양으로 작성한다.
`line`은 변경 후 파일 줄 번호다. 삭제된 파일은 변경 전 줄 번호를 사용한다.

```json
{
  "summary": "검토한 범위와 결론",
  "findings": [
    {
      "file": "src/features/example/controller.ts",
      "line": 12,
      "title": "구체적인 문제",
      "rule": "관련 프로젝트 규칙이나 확인한 결함 근거",
      "impact": "어떤 동작 또는 유지보수 작업에 어떤 영향을 주는가",
      "suggestion": "동작 보존 조건과 최소 수정안; 기준 충돌 시 선택지"
    }
  ]
}
```

`node scripts/code-review/cli.mjs submit <실행ID> <결과파일>`로 기록한다.
코드가 바뀌어 stale로 거절되면 이전 검사 결과를 사용하지 않는다.
리뷰 완료 후 실행 ID, F1 같은 지적 ID, 제안과 근거를 사용자에게 전달한다.
지적이 없으면 그 사실을 기록하고, 이 리뷰가 동작 무결성을 증명한다고 표현하지 않는다.
지적이 있으면 `submit` 응답의 `evaluationQuestion`을 최종 완료 보고 마지막에 그대로 붙인다.
질문에는 실행 ID·지적 ID와 제목·평가 선택지가 들어 있다. 제안과 근거도 함께 전달한다.
질문을 중간 진행 보고에만 넣거나 “원하면 평가해 주세요”라는 선택적 안내로 대체하지 않는다.
Stop 훅은 최종 메시지에서 질문을 확인하고 누락 시 한 번 보완 요청한다.
보완 요청에는 검사나 리뷰를 반복하지 말고 완료 보고와 질문만 작성해 턴을 종료한다.
사용자 답변을 기다리는 추가 종료 차단은 만들지 않는다. 지적 0건이면 평가를 묻지 않는다.

## 사용자 평가

사용자가 직접 내린 평가만 `rate <실행ID> <F번호> <평가> [메모]`로 기록한다.
`useful`(타당·유용), `out-of-scope`(타당·범위 밖), `unsupported`(취향·근거 부족),
`incorrect`(사실과 다름), `deferred`(보류)를 구분한다.
“적용하지 않겠다”만으로 오탐이라고 판정하지 않는다. 평가가 모호하면 미평가로 둔다.
여러 실행의 F1을 혼동할 수 있으면 실행 ID를 확인한다.
`stats`의 비율에는 분모·미평가·보류 건수를 함께 전달한다. 지적 0건이나 미평가는
정확도 100%가 아니며, 개선 효과·놓친 결함은 별도 평가가 필요하다.
