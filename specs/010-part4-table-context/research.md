# Research: Part 4 구조화 표 렌더링

## Decision 1: wire 계약을 수동 runtime mapper로 정규화한다

- **Decision**: public snake_case 표 타입을 문서화하고, 하나의 mapper가 네트워크 값을
  `unknown`에서 검사해 camelCase domain 객체와 진단 issue로 재구성한다.
- **Rationale**: `apiFetch<T>`의 generic은 runtime validation이 아니므로 TypeScript interface만
  추가하면 malformed 배열이 renderer crash로 이어질 수 있다. 수동 mapper는 새 dependency
  없이 fatal 구조 오류와 셀 단위 복구를 구분하고 열린 문자열을 보존한다.
- **Alternatives considered**: compile-time Raw interface만 사용하는 방식은 runtime 안전성이
  없어서 기각했다. Zod/Valibot은 설치되어 있지 않고 bundle/dependency 및 custom recovery가
  추가돼 기각했다.

## Decision 2: Q8 표를 Part 4 canonical 객체로 사용한다

- **Decision**: Q8의 유효한 표를 읽기 단계와 Q8~Q10의 공통 domain 객체로 사용한다. Q9/Q10은
  생략하거나 같은 표를 반복할 수 있으며, 반복값은 cells key insertion order만 무시한 구조
  비교를 통과해야 한다.
- **Rationale**: 현재 image 흐름의 canonical 규칙과 사용자 경험을 유지하고 문제마다 다른 표가
  노출되는 것을 막는다. 단순 `JSON.stringify`는 cells 속성 순서만 다른 동일 표를 충돌로 오인한다.
- **Alternatives considered**: 각 문제 표를 독립 사용하면 충돌을 숨긴다. 여러 표를 merge하면
  서버 원문의 의미와 순서를 변경하므로 기각했다.

## Decision 3: 공용 native grid와 내부 가로 ScrollView를 사용한다

- **Decision**: 제목, 부제, metadata와 notes는 일반 흐름으로 표시하고 header/data grid만
  horizontal ScrollView로 감싼다. 각 column은 같은 최소 너비와 flex growth를 가지며 cell은
  자연 높이로 줄바꿈한다. 부모 화면이 기존 vertical scroll을 계속 담당한다.
- **Rationale**: 표의 행·열 비교와 columns 순서를 보존하며, 2~3열은 viewport를 채우고 4~6열은
  찌그러지지 않은 채 가로로 접근할 수 있다. 참조 최대 6열·10행에는 가상화가 필요 없다.
- **Alternatives considered**: vertical row card는 비교성이 낮고 label 반복으로 지나치게 길어진다.
  FlatList는 작은 데이터에 이득이 없고 nested vertical scroll을 복잡하게 한다. WebView HTML
  table은 native 화면에 불필요한 load/bridge 실패 경로를 추가한다.

## Decision 4: 최초 native layout을 table-ready 신호로 사용한다

- **Decision**: 공용 표 root의 최초 `onLayout`을 one-shot callback으로 전달하고 controller의
  image-loaded 상태를 table-ready 상태로 바꾼다. 준비 완료 action도 ready 전에는 막는다.
- **Rationale**: 원격 asset load가 없어도 실제 화면 배치 전에 45초가 소모되지 않아야 한다.
  layout은 render commit 이후 발생하고, 기존 focus/AppState 및 phase guard를 그대로 재사용할
  수 있다.
- **Alternatives considered**: phase 진입 즉시 ready로 두면 화면 배치보다 timer가 먼저 시작될 수
  있다. useEffect만 사용하면 native layout 완료를 보장하지 않으므로 기각했다.

## Decision 5: 표시값과 확장 문자열을 보존하고 구조 문제만 분류한다

- **Decision**: null/undefined/빈 문자열만 `—`, boolean은 `Yes`/`No`, 나머지는 원 값을 문자열로
  표시한다. table type, value type, status, key와 scope는 enum으로 제한하지 않는다. 누락·추가
  셀과 중복 column은 개발 issue로 기록하지만 행/열을 filter하지 않는다.
- **Rationale**: 서버가 이미 생성한 시간·통화 문자열의 timezone/localization 변형을 막고 0과
  false를 보존한다. 새 계약 값이 앱 배포보다 먼저 나와도 읽을 수 있다.
- **Alternatives considered**: value type별 formatter는 표시값을 바꿀 위험이 있다. 알려진 enum
  switch는 새 값을 전체 오류나 빈 값으로 만들 수 있어 기각했다.

## Decision 6: status badge는 cell row의 sibling으로 렌더링한다

- **Decision**: 모든 cell Text에만 strike-through를 적용하고 status와 status note는 행 아래의
  별도 neutral badge에 표시한다. cell은 column label과 display value를 함께 읽는 접근성 label을
  가진다.
- **Rationale**: badge가 text decoration을 상속하지 않으며 available부터 canceled까지 서로 다른
  상태를 모두 위험색으로 오해시키지 않는다. React Native에 table/cell role이 없어 header role과
  명시적 음성 label로 관계를 보완한다.
- **Alternatives considered**: 첫 cell 안에 badge를 중첩하면 취소선/style 상속과 column 폭에
  결합된다. 모든 status를 빨강으로 표시하면 정상·가용 상태까지 오류처럼 보이므로 기각했다.

## Decision 7: 재답변은 단일 문제 상세의 tableContext를 필수로 사용한다

- **Decision**: 공용 mapper를 `RawExamQuestionInfo`에도 적용하고 Part 4 detail에 유효한 표가
  없으면 기존 question-failed 복구 경로로 보낸다.
- **Rationale**: 재답변 endpoint는 선택한 문제 하나만 반환하므로 Q9/Q10에서 Q8 표를 로컬로
  복원할 수 없다. 문제를 보지 못한 채 녹음을 허용하는 것보다 기존 안전한 실패 화면이 맞다.
- **Alternatives considered**: Q8 상세를 추가 조회하면 endpoint 호출과 상태가 늘고 현재 확정된
  `questionInfo.tableContext` 계약을 불필요하게 우회한다. 표 없이 녹음을 허용하면 명세를 위반한다.

## Integration dependency

시험 session의 각 Part 4 question은 Q8에 tableContext를 제공하고 Q9/Q10은 생략 또는 동일 반복할
수 있다. 단일 문제 상세 응답은 어느 Part 4 문제를 조회해도 `questionInfo.tableContext`를 제공해야
한다. 실제 backend가 후자와 다르면 Q9/Q10 재답변은 frontend만으로 공통 표를 복구할 수 없으므로
API 계약 변경 또는 Q8 추가 조회를 별도 승인받아야 한다.
