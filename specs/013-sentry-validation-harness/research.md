# Research: Sentry 오류 카탈로그 검증 도구

## Decision 1: 독립 개발 검증 루트를 사용한다

- **Decision**: `__DEV__`와 명시적 validation flag가 모두 참일 때 일반 auth/navigation 대신 독립
  진단 화면을 렌더링한다.
- **Rationale**: backend, consent, 사용자 계정과 실제 시험 상태 없이 emulator에서 동일한 15개
  fixture를 재현할 수 있고 합성 이벤트 외의 운영 이벤트를 최소화한다.
- **Alternatives considered**: 일반 Settings의 숨은 route는 auth bootstrap과 navigation에 의존한다.
  실제 feature별 fault injection은 변경 면적과 제품 오염 위험이 과도하다.

## Decision 2: fixture는 code-keyed exhaustive mapping으로 만든다

- **Decision**: `OperationalErrorCode`를 key로 하는 typed mapping에서 각 `OperationalErrorInput`을 만든다.
- **Rationale**: 15개 중 누락·중복을 compile time에 발견하고 현재 catalog가 바뀌면 검증 도구도 함께
  갱신하게 만든다.
- **Alternatives considered**: 자유 배열은 중복 key와 새 code 누락을 typecheck가 보장하지 못한다.

## Decision 3: preview와 capture가 같은 안전 payload builder를 공유한다

- **Decision**: reporter의 allowlist/classification 결과를 receipt로 반환하고, validation screen은 이
  결과를 로컬 표시한다. 전송 시에도 같은 payload를 capture한다.
- **Rationale**: 화면용 예상 payload를 별도 구현하면 실제 Sentry payload와 drift할 수 있다. 기존
  제품 caller는 반환값을 무시할 수 있어 호환된다.
- **Alternatives considered**: Sentry SDK scope를 화면에서 직접 구성하면 catalog와 privacy 경계를
  우회한다. SDK transport를 monkey patch하면 native SDK 동작과 결합도가 높다.

## Decision 4: 합성 이벤트를 고정 environment와 tag로 격리한다

- **Decision**: validation mode는 Sentry environment를 `synthetic-validation`로 설정하고 모든 manual
  event에 `synthetic_validation=true`를 붙인다.
- **Rationale**: 일반 production 오류 통계와 명확히 분리하고 low-cardinality query가 가능하다.
- **Alternatives considered**: 고유 run ID tag는 정확한 상관관계에는 유리하지만 cardinality를 늘린다.
  message/fingerprint 변경은 실제 grouping contract를 검증하지 못한다.

## Decision 5: event ID와 flush를 앱에서 확인한다

- **Decision**: capture가 반환한 event ID를 code별로 저장하고, 15개 capture 뒤 SDK flush 결과를
  표시한다.
- **Rationale**: event ID는 SDK가 각 이벤트를 수락했음을, flush는 pending queue 처리가 끝났음을
  emulator에서 즉시 보여준다. Sentry 서버 수신 조회와 직접 대조할 수 있다.
- **Alternatives considered**: 성공 toast만 표시하면 실제 capture 여부를 증명하지 못한다. 고정 대기
  시간만 사용하면 network 상태에 따라 불안정하다.

## Decision 6: 외부 수신은 time window와 read-only query로 검증한다

- **Decision**: 전체 전송 직전 UTC 시각 이후의 `synthetic-validation` environment/tag event를 조회해
  15개 stable code와 화면 event ID를 대조한다.
- **Rationale**: 고유 run tag 없이도 이번 실행을 분리하며 Sentry data를 수정하지 않는다.
- **Alternatives considered**: 합성 run ID tag는 cardinality가 높다. dashboard 육안 확인만으로는
  15개 code/event ID 비교가 누락되기 쉽다.

## Decision 7: emulator는 기존 Pixel_8 AVD를 사용한다

- **Decision**: 설치된 `Pixel_8` AVD에서 debug development build를 실행한다.
- **Rationale**: 사용자가 emulator 검증을 요청했고 저장소의 Android application id가 이미 구성돼 있다.
- **Alternatives considered**: iOS Simulator는 추가 검증으로 가능하지만 이번 승인 범위의 첫 대상은
  Android다. Expo web은 native Sentry 통합을 검증하지 못한다.

## Decision 8: 새 dependency나 자동 test runner를 추가하지 않는다

- **Decision**: 기존 SDK, shared UI, TypeScript와 device validation만 사용한다.
- **Rationale**: 기능은 작은 진단 surface이며 dependency 추가 없이 exhaustive types와 실제 emulator
  검증으로 핵심 요구를 증명할 수 있다.
- **Alternatives considered**: test framework 도입은 장기적으로 유용하지만 이번 진단 기능보다 큰
  저장소 수준 결정이다.
