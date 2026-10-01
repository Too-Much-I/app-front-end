# 구현 후 리뷰와 사용자 평가

사용자 스켈레톤 작성과 AI 구현을 구분한다. 컴파일 통과는 리뷰의 필요조건이며
구현 완료를 증명하지 않는다. 훅은 제안을 기록하며 코드를 자동 수정하지 않는다.

## 동작

1. `SessionStart`가 현재 대화의 세션 키와 사용법을 AI에 전달한다.
2. 승인된 코드 구현 직전에 AI가 `begin`으로 현재 소스를 기준 상태로 저장한다. 이때 학습 기록
   (`docs/learning/YYYY-MM-DD-<작업>.md`) 경로를 받아, 사용자가 쓴 "구현 전 예상"이 비어 있으면
   시작하지 않고 예상을 스냅샷으로 남긴다. 설명할 동작 변화가 없다고 사용자가 선언한 작업만
   경로 대신 `동작 변화 없음`을 넘긴다. AI는 예상을 대신 쓰지 않는다.
3. 구현 완료 후 AI가 직접 구현한 파일을 명시해 `ready`를 호출한다.
4. `Stop`이 TypeScript·lint·architecture·naming을 실행한다. 모두 통과할 때만
   같은 AI에게 리뷰 스킬을 읽고 계속하라는 피드백을 한 번 보낸다.
5. AI는 변경 전후를 검토하고 지적 또는 지적 0건을 `submit`으로 기록한다.
6. 지적이 있으면 AI가 완료 보고 마지막에 `submit`이 반환한 평가 질문을 그대로 붙인다.
   Stop은 마지막 답변을 확인하고 질문이 빠졌으면 한 번 보완 요청한다.
7. 사용자가 지적별 평가를 알려주면 `rate`로 기록하고 `stats`로 집계한다.

질문에는 실행 ID·지적 ID와 제목·평가 선택지가 포함된다. 질문을 전달한 뒤에는
미평가 상태여도 턴을 정상 종료하고 다음 작업을 허용한다. 지적 0건이면 질문하지 않는다.
보완 요청 뒤에도 질문이 없으면 `evaluationRequest.status: missed`로 기록하고 종료한다.
이는 누락을 감지하고 한 번 보완하는 장치이며, 모델의 문장 출력을 무한히 강제하지 않는다.
`status`에서 pending/reminded/asked/resolved/missed를 확인할 수 있다.

상담·문서 작성·사용자 스켈레톤에는 `begin`/`ready`를 실행하지 않는다.
`*.skeleton.*`는 리뷰 범위에서 제외한다. 일반 파일에 작성하는 초안도 완성됐다고
임의 추정하지 않는다. 주석 비중·import 유무로 작업 단계를 추측하지 않는다.
전체 타입 검사는 그대로 실행하므로, 미완성 스켈레톤 때문에 실패해도 리뷰는 생략한다.

시작 시 이미 수정돼 있던 파일은 그 내용을 기준으로 비교한다. Git HEAD와의 diff로
사용자의 기존 변경을 AI 변경으로 간주하지 않는다. 이후 다른 사람이 같은 파일을
수정한 경우까지 작성자를 자동 판별하지는 못하므로 `ready` 범위를 직접 확인한다.

## 학습 기록과의 연결

`submit` 응답의 `learning`은 학습 기록 경로, 비어 있는 사람 섹션(`missing`), 시작 후 예상이 바뀌었는지
(`predictionChanged`)를 담는다. AI는 리뷰 후 학습 기록의 "시나리오 지도"를 쓰고 이 상태를 사용자에게
알린다. 머지 조건은 훅이 아니라 CI(`pnpm check:learning`)가 판단한다. 규칙: [학습 기록](learning/README.md).

## 최초 활성화

설정은 `.codex/hooks.json`, 지시문은 `.agents/skills/review-completed-code/SKILL.md`다.
지원되는 Codex 클라이언트에서 프로젝트를 신뢰하고 새 세션을 시작한다.
CLI의 `/hooks`에서 두 command hook의 정의를 확인하고 신뢰해야 실행된다.
설정을 작성하는 것만으로 신뢰가 부여되지는 않는다. 변경된 훅도 재검토 대상이다.
기존 대화에서는 SessionStart가 다시 실행되지 않았다면 키 안내가 없을 수 있다.

공식 계약: https://developers.openai.com/codex/hooks
설정은 `SessionStart`와 `Stop`만 사용하며 별도 모델/API 호출·외부 전송은 없다.
훅은 명령을 실행하고, 의미에 대한 리뷰는 현재 AI가 스킬에 따라 수행한다.
훅을 꺼도 기존 필수 검사는 유지된다.

## 명령

저장소 루트에서 실행한다. `<세션키>`는 SessionStart가 전달한 16자리 값이며
`<실행ID>`는 begin/ready/리뷰 결과에 표시되는 UUID다.

```sh
node scripts/code-review/cli.mjs begin <세션키> '인증 재시도 구현' docs/learning/2026-10-01-auth-retry.md
# 실제 구현 후, 직접 변경한 파일만 지정
node scripts/code-review/cli.mjs ready <세션키> src/features/auth/example.ts
node scripts/code-review/cli.mjs status <세션키>
node scripts/code-review/cli.mjs packet <실행ID>
node scripts/code-review/cli.mjs submit <실행ID> output/code-review/report.json
node scripts/code-review/cli.mjs rate <실행ID> F1 useful '수정 책임이 명확해졌다'
node scripts/code-review/cli.mjs stats
```

자연어로 “이번 리뷰 F1은 사실과 다르고 F2는 유용해”라고 알려줘도 된다.
AI는 그 평가만 대신 기록하며 사용자를 대신해 타당성을 확정하지 않는다.
평가 수정 이력은 보존하고 통계에는 마지막 평가를 반영한다.

| 값 | 의미 |
| --- | --- |
| `useful` | 타당하고 유용함 |
| `out-of-scope` | 타당하지만 이번 범위 밖 |
| `unsupported` | 취향 차이·근거 부족 |
| `incorrect` | 사실과 다름 |
| `deferred` | 판단 보류 |

## 실패·재개

- 검사 실패: 결과를 저장하고 리뷰하지 않는다. 자동 수정 루프를 만들지 않는다.
  AI는 미완료/실패를 보고하고, 수정했으면 같은 실행에서 다시 `ready` 한다.
- ready 이후 또는 검사·리뷰 중 소스 변경: `stale`. 현재 구현 확인 후 다시 `ready` 한다.
- 리뷰 도구/스킬 변경: 이전 실행과 버전을 혼용하지 않는다. `cancel <세션키>` 후
  새 `begin`으로 비교 구간을 시작한다.
- 중단으로 `checking`/`awaiting-review`에 남음: `status`로 확인한다. 리뷰는 `packet`부터
  수동 재개할 수 있고, 검사를 재시작하려면 cancel 후 begin 한다. 자동 반복하지 않는다.
- 진행 중인 실행은 새 begin으로 덮어쓰지 않는다. 필요하면 cancel로 명시적으로 종료한다.
- 다른 Stop 훅이 이미 재개한 턴에서는 새 구조 리뷰를 다음 일반 턴으로 미룬다.
  완료 보고의 평가 질문 보완은 별도로 실행당 한 번만 허용한다.

## 기록과 지표

기록은 Git·EAS에서 이미 제외된 `output/code-review/`에 로컬 저장한다.
시작 소스·변경 전후·검사 결과·지적·평가 이력이 포함된다. 토큰 사용량과 모델 비용은
현재 훅 입력으로 측정하지 않는다. reviewDurationMs는 사람 대기까지 포함할 수 있는
요청부터 제출까지의 경과 시간이며 순수 모델 실행 시간이 아니다.

`stats`는 도구/스킬 내용의 해시와 실행 모드별로 집계한다.
분모 `decided`는 평가한 지적에서 판단 보류를 뺀 수다.

- `incorrectRate`: 사실과 다름 / decided
- `lowValueRate`: (사실과 다름 + 취향·근거 부족) / decided
- `usefulRate`: 타당하고 유용함 / decided
- 미평가·판단 보류·범위 밖·지적 총수·완료 실행 수·검사 실패/재시도·소요 시간을 함께 제공한다.
- 분모가 0이면 비율은 `null`이다. 미평가나 지적 0건을 정확도 100%로 간주하지 않는다.

비교군은 `begin <세션키> '작업' checks-only`로 기록한다. 이 모드는 같은 검사를 실행하되
AI 구조 리뷰를 요청하지 않는다. 작업 난이도·모델·요청을 맞춘 별도 비교가 필요하며,
이 통계만으로 품질 향상을 입증하지 않는다. 리뷰가 놓친 결함, 수동 검토 시간, 이해도는
후속 실기기 확인·사용자 평가로 따로 측정해야 한다.

검증: `node scripts/check-code-review-hooks.mjs`. 앱 테스트 러너나 새 의존성을 추가하지 않는다.
