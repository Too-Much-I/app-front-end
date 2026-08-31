# 의존성 경계 검사

`pnpm check:architecture`는 Dependency-Cruiser의 전체 모듈 그래프와 TypeScript import 이름을
함께 검사한다. 경로만으로 의미를 확정할 수 있는 침범은 실패시키고, 맥락이 필요한 변화는
PR Job Summary와 갱신형 댓글에 보고만 한다.

## 차단 규칙

| 규칙 | 차단하는 것 | 이유 |
|---|---|---|
| `no-circular` | 타입 의존성을 포함한 새 순환 | 구현 소유권이 뒤집히고 변경 파급을 숨긴다 |
| `no-cross-screen-import` | `screens/a`가 `screens/b` 구현을 직접 참조 | 화면은 조립 단위이며 공유 코드는 feature나 UI 계층이 소유한다 |
| `no-raw-type-in-ui` | screens/components가 내부 모듈의 `Raw*`를 import | nullable·snake_case 서버 모양이 UI로 새어 나온다 |
| `no-mapper-call-in-ui` | screens/components가 `map-*`의 `map*` 함수를 import | 응답 정규화는 API와 domain 경계에서 끝나야 한다 |

`map-*` 파일 경로 자체는 차단하지 않는다. 현재 mapper 파일은 정규화된 domain 타입과
`averageTotalScore`, `summarizeReanswerProgress` 같은 domain 계산도 소유한다. 경로 전체를 금지하면
정상 소비까지 실패하므로 실제 응답 매퍼 이름을 가져올 때만 차단한다.

## 정보성 보고

PR base와 head의 내부 의존성 간선을 비교해 다음을 경고한다.

- 다른 feature를 향하는 새 참조
- `components/ui`에서 feature를 향하는 새 참조
- feature 밖에서 그 feature의 `api/` 또는 `map-*`를 향하는 새 참조
- 추가·제거된 내부 의존성 간선
- 절댓값 변화가 큰 fan-in/fan-out 상위 5개

참조 수에는 실패 임계값을 두지 않는다. 공용 primitive와 타입 계약은 fan-in이 큰 것이 정상이고,
화면은 조립 지점이라 fan-out이 큰 것만으로 분해할 근거가 되지 않는다. 보고서는 리뷰할 지점을
좁히는 자료이며 merge 판정이 아니다.

## CI와 룰셋

`architecture-boundaries` job은 차단 규칙이 하나라도 있으면 실패한다. 경고만 있으면 성공한다.
PR 댓글 작성이 허용되지 않는 fork PR에서도 검사 결과와 Job Summary는 남는다.

workflow가 최초로 실행된 뒤 GitHub main 룰셋의 **Require status checks to pass**에
`architecture-boundaries`를 추가해야 실제 merge gate가 된다. job 이름은 룰셋 연결이 끊기지
않도록 검사 항목이 늘어도 바꾸지 않는다.

규칙을 바꿀 때는 이 문서와 `scripts/check-architecture.mjs`를 함께 수정한다. 의미가 모호한 경계를
차단 규칙으로 승격하기 전에는 정보성 보고에서 반복되는 사례와 예외를 먼저 확인한다.
