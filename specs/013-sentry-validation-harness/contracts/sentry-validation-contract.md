# Contract: Sentry 오류 카탈로그 검증

## Availability contract

검증 화면은 아래 조건을 모두 만족할 때만 일반 앱 root를 대체한다.

- development build (`__DEV__`)
- explicit validation mode enabled

한 조건이라도 거짓이면 기존 app root/auth/navigation이 변함없이 실행된다. production build에는
검증 route나 사용자 진입점이 없다.

## Catalog contract

- 기존 15개 `OperationalErrorCode` 각각에 fixture가 정확히 하나 존재한다.
- fixture는 기존 discriminated input type을 만족한다.
- catalog code가 추가/제거됐는데 fixture가 동기화되지 않으면 typecheck가 실패해야 한다.
- fixture는 네트워크, recorder, audio player, auth, deletion 또는 navigation을 실행하지 않는다.

## Preview contract

preview는 실제 report와 같은 builder를 사용하고 다음만 반환한다.

- stable code와 fixed feature
- code별 허용된 stage/reason/operation/attempt/resource/surface/cue 분류
- 필요한 제한 숫자와 boolean
- 유효 HTTP status와 제한된 server code

raw cause, message, stack, result, ID, URL/URI/path와 사용자·학습 본문은 반환하지 않는다.

## Capture contract

- validation 전체 전송은 preview된 fixture 15개를 기존 Sentry capture 경계로 각각 한 번 전달한다.
- message와 fingerprint는 기존 stable code grouping을 유지한다.
- environment는 `synthetic-validation`, tag는 `synthetic_validation=true`로 고정한다.
- capture는 code별 event ID 또는 안전한 실패 상태를 반환하고 caller에 throw하지 않는다.
- 15개 처리 뒤 flush를 한 번 수행한다.
- 같은 active/completed run에서 전체 전송 callback이 반복돼도 추가 이벤트를 만들지 않는다.

## UI contract

- 화면은 validation mode, Sentry enable 상태, 15개 catalog 항목과 전체 집계를 표시한다.
- 로컬 preview는 외부 전송 없이 실행할 수 있다.
- 개별 capture와 전체 전송은 각각 명시적 버튼 동작으로만 시작한다.
- 전송 중 버튼은 비활성이고 code별 pending/captured/failed 상태를 표시한다.
- completed는 event ID 15개와 flush success가 모두 확인된 경우에만 표시한다.
- reset은 화면 결과를 새 run으로 전환하지만 이미 전송된 외부 이벤트를 삭제하지 않는다.

## External verification contract

Sentry query는 아래 고정 분류와 전송 직전 UTC time window를 사용한다.

```text
environment:synthetic-validation synthetic_validation:true
```

성공 조건:

- 조회된 이번 run 이벤트가 정확히 15건
- stable code 15종이 각각 한 건
- emulator receipt의 15개 event ID와 수신 event ID가 일치
- request URL/query/header/cookie/data와 user가 없음
- synthetic fixture의 금지 원문이 tags/context/extra/breadcrumb/exception에 없음

read 권한이 없으면 event 수신은 완료로 단정하지 않고 dashboard 수동 확인 대기로 기록한다.
