# Research: 실제 채점 연동 통합 피드백

## Decision 1: 기존 API와 mapper 재사용

**Decision**: `getExamGradingResult`와 `getExamQuestionFeedback`을 호출하고 기존 mapper가 반환하는 domain type만 UI에 전달한다.

**Rationale**: Raw 응답 nullable/snake-case 차이를 UI에 누출하지 않고 이미 검증된 경계를 보존한다.

**Alternatives considered**: 화면 직접 fetch는 중복과 raw 계약 누출 때문에 제외했다.

## Decision 2: optional route examId

**Decision**: 채점 완료는 `{ examId }`를 전달하고 param 없는 직접 탭 진입은 빈 상태로 처리한다.

**Rationale**: 최신 이력 API가 없으므로 임의 ID 보존보다 정직한 빈 상태가 안전하다.

**Alternatives considered**: 메모리/로컬 저장은 오래된 결과와 계정 변경 문제로 제외했다.

## Decision 3: effect 기반 remote-data hooks

**Decision**: 요약과 문항 각각의 hook에서 discriminated union 상태, AbortController와 수동 retry를 관리한다.

**Rationale**: 기존 native hook 패턴과 맞고 전역 Query Provider/캐시 정책을 범위에 추가하지 않는다.

**Alternatives considered**: TanStack Query는 설치되어 있으나 Provider가 없어 이번 범위보다 큰 전역 결정을 요구한다.

## Decision 4: 문제 상세 지연 조회

**Decision**: 요약 성공 시 문제 상세를 일괄 조회하지 않고 Q 선택 시 `retryCount=0`으로 조회한다.

**Rationale**: 첫 결과에 최대 11개 요청을 추가하지 않으며 서버가 제공하는 문항 만점 없이도 승인된 표준 파트 만점으로 그래프를 만들 수 있다.

**Alternatives considered**: 모든 상세 병렬 조회는 N+1 비용과 불필요한 오디오/첨삭 payload 때문에 제외했다.

## Decision 5: 파트 만점과 상태

**Decision**: Part 1~5 max를 `6/6/9/9/5`로 두고 실제 `partScores/max` 비율로 상태를 파생한다.

**Rationale**: 사용자가 확정한 TOEIC Speaking 시험 형식 상수이며 fixture 점수 40을 제거한다.

**Alternatives considered**: 관측 최댓값과 100점 가정은 실제 값을 왜곡한다.

## Decision 6: fixture와 asset 분리

**Decision**: `mocks/feedback-result.ts`는 삭제하고 실제 UI에서 렌더링되는 마스코트 require만 `feedback-assets.ts`에 남긴다.

**Rationale**: 장식 asset은 실제 데이터와 독립적이며 fixture와 한 파일에 있으면 목데이터 제거 시 함께 사라지거나 오해된다.

**Alternatives considered**: 모든 마스코트 제거는 기존 승인 UI와 사용자 요청에 맞지 않는다.
