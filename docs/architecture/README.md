# 구조 문서 — 멘토링 준비 자료

조사 시점: 2026-08-31 (`feat/ten-second-challenge`, e80699d)
범위: `src/` 236개 파일 · 약 24,000줄 + 루트 설정 · CI · 문서

출시하면서 신규 기능을 계속 만들려면 구조가 버텨야 한다. 이 폴더는 **지금 구조가 어떤 모양이고,
어디가 이미 좋고, 어디가 다음 기능에서 아플지**를 그림 4장과 문서 3편으로 정리한 것이다.

---

## 그림 (draw.io)

| 파일 | 무엇을 답하나 |
|---|---|
| [`diagrams/01-concept-map.drawio`](diagrams/01-concept-map.drawio) | 이 앱이 다루는 **개념**과 개념 사이 관계 (코드가 아니라 도메인) |
| [`diagrams/02-architecture.drawio`](diagrams/02-architecture.drawio) | **계층**과 계층 사이를 무엇이 지나가는가 |
| [`diagrams/03-feature-map.drawio`](diagrams/03-feature-map.drawio) | 기능이 무엇을 **소유**하고 어디에 **기대는가** |
| [`diagrams/04-ia.drawio`](diagrams/04-ia.drawio) | 화면이 어떻게 **이어지는가** |

**여는 법** — `.drawio`는 그냥 XML이라 손으로 그린 게 아니고, 열면 편집 가능한 도형으로 뜬다.

- 브라우저: [app.diagrams.net](https://app.diagrams.net) → File → Open from → Device
- VS Code: `hediet.vscode-drawio` 확장 설치 후 파일 클릭
- 데스크톱 draw.io 앱: 그냥 열면 된다
- 손으로 옮겨 그릴 때: 각 그림의 색 범례를 먼저 보고, **박스보다 화살표 라벨을 먼저** 옮기면
  구조가 더 빨리 붙는다. 빨간 요소는 전부 "지금은 안 아프지만 다음 기능에서 아픈 것"이다.

**다른 형식** — [`alt-formats/diagrams.mmd.md`](alt-formats/diagrams.mmd.md) (Mermaid, GitHub에서 바로 렌더),
[`alt-formats/diagrams.d2`](alt-formats/diagrams.d2) (D2). 같은 4장을 형식만 바꿔 옮긴 것으로,
좌표를 잡을 수 없어 draw.io판보다 정보가 덜 들어간다. 정본은 draw.io다.

---

## 문서

| 파일 | 무엇을 답하나 |
|---|---|
| [`01-naming-dictionary.md`](01-naming-dictionary.md) | 쓰이는 이름 7축 MECE 분류 · 각 이름의 정의 · 어디서 깨지는가 |
| [`02-conventions.md`](02-conventions.md) | 지키려는 컨벤션 60개(문서 20 + 코드에서만 읽히는 40) · code smell 15개 |
| [`03-convergent-evolution.md`](03-convergent-evolution.md) | 기술·컨셉 15개 분류 · 각각의 수렴 방향 · 우리와의 거리와 이유 |

## 자동 분석 스냅샷

| 파일 | 내용 |
|---|---|
| [`generated/dependency-graph.mmd`](generated/dependency-graph.mmd) | Dependency-Cruiser로 생성한 현재 모듈 의존성 그래프 |
| [`dependency-analysis-2026-08-31.md`](dependency-analysis-2026-08-31.md) | 기존 그림과의 차이, 순환 참조, 단일 소비 공용 모듈 분석 |
| [`04-dependency-boundaries.md`](04-dependency-boundaries.md) | CI가 차단하는 의존성 경계와 PR에 보고만 하는 변화 |

그래프는 `pnpm deps:graph`로 다시 만든다. `pnpm check:architecture`는 같은 분석 결과에서 명확한
경계 침범만 차단하고, 해석이 필요한 변화는 PR 보고서로 남긴다.

---

## 세 문서를 관통하는 결론

### 이미 좋은 것 — 건드리지 말 것

| | 무엇 |
|---|---|
| 타입 규율 | `any` · `@ts-ignore` · `eslint-disable` **저장소 전체 0건** |
| `Raw* → 매퍼 → 도메인` 경계 | 예외 없이 지켜진다 |
| 상태 리터럴의 출처 표기 | kebab(앱) / snake(서버) / SCREAMING(코드) — 값만 봐도 출처를 안다 |
| 관측 정책 | 코드 + 허용 목록 + 스크러빙 + **그걸 검증하는 장치**까지. 업계 평균 이상 |
| 인증 부트스트랩 | 상태 8종 × 실패 작업 8종. "처음부터 다시"로 뭉개지 않는다 |
| rem 런타임 스케일링 | 관용구가 아닌 자체 해법인데, 실측·상한·웹뷰 동기화까지 끝까지 밀었다 |
| 웹뷰 브리지 | 토큰 미노출 · 임의 경로 프록시 없음 · 버전 협상 |
| 주석 문화 | "왜"만 쓰고, 반례와 측정치와 **하지 않은 선택**을 남긴다 |

### 비어 있는 칸 두 개 — "잘못 만든 것"이 아니라 "아직 안 만든 것"

1. **서버 상태 계층** — `@tanstack/react-query`가 설치돼 있는데 **사용처 0**.
   조회·폴링·취소·백오프가 36개 훅에 각자 있고, 폴링만 세 벌이다.
   → 챌린지 스테이지 화면을 만들면 네 번째가 생긴다.
2. **테스트 층** — CI는 lint + typecheck만. 그런데 입력→출력만 있는 순수 함수가 40개 이상이고,
   그중 `previewOperationalError`는 **테스트를 위해 만든 함수인데 테스트가 없다.**

### 지금 아프진 않지만 다음 기능에서 아픈 것

| | 무엇 | 언제 아픈가 |
|---|---|---|
| ① | `screens/` 아래에 도메인 상태 (store 296줄, `challenge-status` + `challenge-corrections` 261줄) | 챌린지 스테이지 화면을 만들 때 |
| ② | `challenge` → `features/exam/upload-answer-audio` 직접 참조 | 세 번째 녹음 도메인이 생길 때 |
| ~~③~~ | ~~동명 함수 3쌍 · 한 사실 두 상수 · 껍데기 재수출~~ | **2026-08-31 해소 + `pnpm check:naming`으로 재발 차단** |
| ④ | 챌린지가 **운영 오류 코드 표에 없다** (16개 중 0개) | 출시 직후 |
| ⑤ | `__DEV__` 목이 프로덕션 경로 안에 4곳 | 백엔드가 붙는 날 |
| ⑥ | `specs/` 14폴더 + `docs/superpowers/` 죽은 문서 | 새 참여자가 올 때 |

### 손대는 순서

같은 시간을 쓴다면 이 순서가 신규 기능 속도를 가장 많이 올린다.

| 순서 | 무엇 | 크기 | 왜 먼저 |
|---|---|---|---|
| ~~0~~ | ~~이름 11건 + `pnpm check:naming` 도입~~ | — | **완료 (2026-08-31)** |
| 1 | 순수 함수 테스트 배선 (Jest + 매퍼부터) | 반나절 + 점진 | 아래 전부의 안전망 |
| 2 | 챌린지를 운영 오류 코드 표에 추가 | 1시간 | 출시하면 안 보이는 구간이 생긴다 |
| 3 | react-query — 쓰거나 지우거나 **결정** | 회의 하나 | "쓰기로 했는데 안 쓰는" 상태가 가장 나쁘다 |
| 4 | `screens/*/`의 도메인 로직을 `features/`로 | 반나절 | 스테이지 화면 직전에 |
| 5 | 업로드 모듈을 `features/exam` 밖으로 | 1~2시간 | 세 번째 녹음 도메인이 생길 때 |
| 6 | `__DEV__` 목 제거 | 백엔드 일정 종속 | |
| ~~7~~ | ~~`ExamHistoryScreen` 983줄 분해~~ — 완료(2026-09-01). `ExamHistoryTabView` 외 9개 파일로 분해, 최대 187줄 | | |

이름 정리를 0번으로 앞당긴 이유는 우선순위 판단이 아니라 **의존 관계가 없어서**다.
전부 삭제·개명이라 typecheck가 잡아주고, 검사 스크립트를 지금 붙여야 1~7을 하는 동안
새 위반이 쌓이지 않는다.

### 멘토링에서 이야기 나눠 볼 만한 것

1. **중복 허용과 이름 겹침은 다른 결정인가?** — `formatCountdown`/`formatDuration`, `isStatusOnly` 3쌍은
   결합도 기준으로 중복을 *의도적으로* 허용한 것이고 주석에 근거도 있다. 그런데 예측 가능성 기준은
   "이름 겹치지 않게 관리"다. 두 기준이 부딪히는 자리인데, 지금은 한 번에 결정된 것처럼 보인다.
2. **`screens`와 `features`의 경계는 무엇으로 긋나?** — 지금은 "화면이 하나뿐이면 screens"에 가깝다.
   그러면 두 번째 화면이 생길 때마다 옮겨야 한다.
3. **웹뷰 피드백을 언제까지 유지하나?** — 브리지 모듈이 이미 6개다. 유지 비용이 계약 유지로 나타나기
   시작했다.
4. **10초 챌린지의 스테이지 화면** — 타입·API·라우트 파라미터·오류 처리는 전부 스테이지를 전제로
   쓰여 있는데 화면만 없다. IA에 실제로 뚫려 있는 구멍이다.
