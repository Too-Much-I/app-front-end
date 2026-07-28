# Research: 채점 대기 폴링과 재요청

## Decision 1 — 체크 진행은 단일 count로 표현한다

**Decision**: `gradedPartCount` 숫자 하나를 10초마다 최대 4까지 올리고, `COMPLETED`에서만
5까지 순차 증가시킨다.

**Rationale**: `GradingSheet`가 이미 이 값 하나로 체크, 펜, 완료 수치를 모두 파생한다.
서버는 파트별 상태를 주지 않으므로 파트별 모델은 사실을 더 정확히 표현하지 않는다.

**Alternatives considered**:

- 파트별 boolean 배열: count에서 파생 가능해 중복 상태가 된다.
- 서버 `progressPercent`: 값이 단계적으로 온다는 보장이 없고 마지막 파트 보류 규칙을
  별도로 구현해야 한다.

## Decision 2 — status polling은 순차 timeout loop를 유지한다

**Decision**: 첫 조회는 즉시 보내고, 각 요청이 끝난 뒤 3초 `setTimeout`으로 다음 조회를
예약한다.

**Rationale**: `apiFetch` timeout은 10초라 literal 3초 `setInterval`은 같은 시험의 status
요청을 겹치게 할 수 있다. 현재 hook도 이미 순차 loop를 사용하므로 변경 범위가 작다.

**Alternatives considered**:

- `setInterval(3000)`: 느린 요청에서 중첩, 오래된 응답 경쟁이 생긴다.
- TanStack Query `refetchInterval`: deadline, completion animation, request 정리를 위한 별도
  controller가 여전히 필요해 책임이 줄지 않는다.

## Decision 3 — 최소 phase와 ref guard만 추가한다

**Decision**: 화면 분기용 `polling | retry-ready | retry-requesting | completing |
terminal-error`와 attempt 0/1만 state로 드러낸다. 시도별 local `settled`와
`AbortController`가 요청 lifetime을 정리하고, retry lock과 didNavigate만 ref로 관리한다.

**Rationale**: 첫 실패와 두 번째 실패는 UI가 다르지만 체크 자체는 count 하나면 충분하다.
polling은 같은 exam의 단조로운 lifecycle을 읽으므로 별도 generation 번호 없이 abort된 시도의
응답을 적용하지 않는 것으로 충분하다.

**Alternatives considered**:

- 모든 event를 reducer action으로 모델링: 명시적이지만 현재 크기에는 boilerplate가 크다.
- 여러 독립 boolean: 불가능한 조합과 cleanup 누락 가능성이 커진다.

## Decision 4 — wall-clock deadline과 abort 가능한 정리를 사용한다

**Decision**: 시도 시작 시 `Date.now() + 180_000` deadline을 기록하고 deadline callback과
각 poll 전후에 local `settled` 및 `signal.aborted`를 검사한다. GET과 재요청 POST는 caller
`AbortSignal`을 받는다.

**Rationale**: React Native timer는 background에서 늦게 실행될 수 있다. 절대 시각은 복귀
후에도 실제 경과를 판정할 수 있고, abort는 화면 해제 뒤 state/navigation을 막는다.

**Alternatives considered**:

- 1초씩 remaining time 차감: background timer 지연만큼 최대 대기 시간이 늘어난다.
- boolean cleanup만 사용: 네트워크 요청 자체는 계속 살아 있어 불필요한 작업이 남는다.

## Decision 5 — 재요청은 시험 단위 endpoint로 격리한다

**Decision**: `POST /api/v1/exams/{examId}/grading/retry`를 별도 API 함수로 만들고
GradingWait는 `examId`만 전달한다.

**Rationale**: 재요청은 문항/답변 transport가 아니라 시험 단위 채점 lifecycle 동작이다.
따라서 question number, answer retry count, file key 또는 submission registry를 화면으로
옮길 필요가 없다.

**Alternatives considered**:

- 문항 submit 재호출: 확정된 retry contract와 다르고 불필요한 식별 정보가 필요하다.
- callback을 route param으로 전달: navigation state가 비직렬화된다.
- endpoint 호출을 screen에 inline: API parsing과 화면 분기 책임이 섞인다.

## Decision 6 — 재요청 접수와 전체 완료를 분리한다

**Decision**: retry POST의 HTTP 2xx는 두 번째 polling 시작 근거이며, 결과 화면 이동은
exam summary polling의 overall `COMPLETED`만 결정한다.

**Rationale**: 재요청 접수는 채점 완료가 아니다. 새 작업이 `PENDING` 또는 `PROCESSING`일 수
있으므로 같은 3분/3초 polling lifecycle을 다시 시작해야 한다.

**Alternatives considered**:

- retry POST 성공 즉시 이동: 실제 결과 준비를 보장하지 않는다.
- retry POST 실패에도 polling: 사용자가 요청한 재요청 접수 실패의 최종 오류 경로가
  불명확해진다.

## Decision 7 — retry UI와 terminal UI를 분리한다

**Decision**: 첫 실패/timeout 전용 `GradingRetryNotice`를 추가하고 기존
`GradingFailedNotice`는 두 번째 최종 실패와 Home만 담당한다.

**Rationale**: 서로 다른 허용 행동을 separate props로 강제해 Retry와 Home이 잘못 함께
나오는 조합을 막고, 완성된 waiting UI는 그대로 유지한다.

**Alternatives considered**:

- 하나의 notice에 optional callback 여러 개: invalid prop 조합이 가능하다.
- screen에 button만 inline 추가: 오류 카드 레이아웃과 접근성 책임이 screen에 섞인다.

## Decision 8 — phase는 같은 route 안에서 조건부 렌더링한다

**Decision**: waiting, retry-ready, retry-requesting, terminal-error는 모두
`GradingWaitScreen` 안에서 분기하고, `COMPLETED` 결과와 Home만 navigation한다.

**Rationale**: count, attempt, timer, active request를 한 controller lifetime에 유지할 수 있고
일시적인 phase를 navigation history에 남기지 않는다. JSX는 전용 notice child component로
분리해 screen 비대화를 막는다.

**Alternatives considered**:

- retry/error 별도 route: 각 route는 단순하지만 상태 전달, timer 재생성, back stack과 중복
  polling 위험이 커진다.
- 모든 notice JSX를 screen inline: route는 하나지만 표현 책임이 과도하게 커진다.

## Decision 9 — summary endpoint 책임을 하나의 API module로 모은다

**Decision**: polling은 확정된 `GET /api/v1/exams/{examId}/summary`를 사용하며, 같은 summary
endpoint의 lifecycle 조회와 완료 결과 mapping은 하나의 API module에서 관리한다.

**Rationale**: 현재 status hook은 `/status`, result 함수는 `/summary`를 호출한다. 확정된
backend contract에 맞추면서 저장소의 한 endpoint 한 파일 원칙을 지키려면 summary 책임을
통합해야 한다.

**Alternatives considered**:

- 기존 status 파일의 path만 summary로 변경: result 파일과 같은 endpoint가 두 API 파일에
  중복된다.
- screen에서 raw summary fetch: Raw-to-domain과 API 계층 경계를 깨뜨린다.
