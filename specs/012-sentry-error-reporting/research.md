# Research: Sentry 운영 오류 보고 범위

## Decision 1: terminal user state에서 보고한다

- **Decision**: API catch나 console이 아니라 기존 feature owner가 사용자 실패 상태를 확정하는
  분기에서 수동 이벤트를 생성한다.
- **Rationale**: owner만 자동 retry, background pause, user cancel과 terminal failure를 구분한다.
- **Alternatives considered**: transport 계층 자동 보고는 중간 오류와 abort를 과다 수집한다.
  error UI effect는 React 재렌더와 navigation lifecycle 때문에 중복·누락된다.

## Decision 2: raw exception 대신 stable message와 typed allowlist를 쓴다

- **Decision**: manual report는 안정된 error code를 message/fingerprint로 사용하고 code별 허용
  context만 받는다. raw error에서 HTTP status와 bounded server code 외에는 전송하지 않는다.
- **Rationale**: exception message, response와 URL은 ID, token 또는 학습 내용을 포함할 수 있다.
  stack보다 제품 단계 분류가 중요한 handled failure다.
- **Alternatives considered**: 모든 catch에서 `captureException(error)`를 쓰면 stack은 풍부하지만
  서버 원문과 URL이 전송될 수 있고 동일 장애 grouping이 불안정해진다.

## Decision 3: 전역 dedupe가 아니라 attempt owner guard를 쓴다

- **Decision**: 대부분은 terminal transition의 단일 호출로 보장하고, 중복 callback 가능 경로만
  owner의 ref/generation/set으로 막는다. user retry가 generation을 새로 시작한다.
- **Rationale**: answer job, WebView reload, cue playback과 auth retry의 attempt 경계가 서로 다르다.
- **Alternatives considered**: app-wide fingerprint cache는 별개의 새 시도를 억제하고 identifier를
  장기간 메모리에 보유한다. 시간 기반 debounce는 느린 중복과 빠른 정상 retry를 구분하지 못한다.

## Decision 4: final scrub은 방어선으로 강화한다

- **Decision**: manual event를 allowlist로 제한한 뒤에도 request URL/header/cookie/data와 user를
  제거하고 breadcrumb/context/extra의 ID, token, URL, URI와 audio key를 recursive scrub한다.
- **Rationale**: SDK integration과 breadcrumb가 caller가 전달하지 않은 값을 자동으로 붙일 수 있다.
- **Alternatives considered**: caller 규칙만 의존하면 새 integration이나 실수로 민감 데이터가
  통과한다. final scrub만 의존하면 이미 event 객체에 담긴 임의 body의 의미를 안전하게 판별하기
  어렵다.

## Decision 5: severity는 사용자 영향 기준으로 제한한다

- **Decision**: 15개 terminal handled failure는 error level로, 기존 crash는 SDK 기본 fatal/error로
  유지한다. 중간 warning은 이번 catalog에 넣지 않는다.
- **Rationale**: catalog 목적은 운영자가 조치할 사용자 차단 오류를 한 view에서 비교하는 것이다.
- **Alternatives considered**: retry-ready와 recoverable warning까지 보내면 장애 빈도와 quota를
  왜곡한다.

## Decision 6: summary feedback event를 catalog에 통합한다

- **Decision**: 기존 전용 helper와 `SUMMARY_FEEDBACK_RETRY_REQUEST_FAILED` fingerprint를 일반
  `SUMMARY_FEEDBACK_RETRY_FAILED` contract로 옮기고 requestId를 context에서 제거한다.
- **Rationale**: polling/timeout도 같은 operation이며 requestId는 운영 원인 분류에 필요 없는
  고유값이다.
- **Alternatives considered**: 기존 helper를 병행하면 privacy와 naming 규칙이 두 군데로 갈라진다.

## Decision 7: 검증을 생성·bundle·delivery 세 층으로 분리한다

- **Decision**: workspace에서는 type/static과 가능한 failure injection을 수행하고, native bundle을
  검증한다. 실제 Sentry 수신은 승인된 enabled build와 project access로 별도 확인한다.
- **Rationale**: production SDK가 꺼진 로컬에서 외부 event를 보내지 않고도 코드 계약 대부분을
  검증할 수 있지만, network ingestion과 server-side grouping은 실제 서비스 없이는 증명할 수 없다.
- **Alternatives considered**: 로컬 검증 중 production project로 합성 오류를 보내면 명시적 승인
  없는 외부 write이며 운영 데이터와 quota를 오염시킨다.
