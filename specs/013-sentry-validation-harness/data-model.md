# Data Model: Sentry 오류 카탈로그 검증 도구

## ValidationCatalogItem

- `code`: 기존 `OperationalErrorCode`; 15개 key가 모두 존재해야 한다.
- `title`: 개발자가 화면에서 구분하는 짧은 설명.
- `input`: 해당 code의 기존 `OperationalErrorInput` fixture.
- `expectedFeature`: code에서 정적으로 결정되는 feature.
- `expectedDimensions`: 로컬 preview에서 확인할 제한된 primitive map.

### Validation rules

- code와 input.code는 같아야 한다.
- fixture는 실제 ID, URL, URI, path, token, header, cookie, body, result, message와 학습 본문을 갖지
  않는다.
- API 분류 검증용 cause가 필요하면 status `503`, server code `SYNTHETIC_VALIDATION`만 사용하고 cause
  message/result는 receipt에 포함되지 않아야 한다.
- mapping key 집합은 `OperationalErrorCode` 집합과 정확히 같아야 한다.

## OperationalReportPreview

- `code`: stable code.
- `feature`: code별 fixed feature.
- `tags`: 전송 가능한 low-cardinality string map.
- `context`: 전송 가능한 string/number/boolean map.
- `syntheticValidation`: validation mode에서만 true.

preview는 raw input의 `cause`를 보유하지 않는다.

## OperationalReportReceipt

- `preview`: 실제 capture에 사용된 `OperationalReportPreview`.
- `eventId`: SDK가 capture를 수락하면 string, 비활성 또는 capture 실패면 null.
- `captureStatus`: `preview-only | captured | capture-failed | disabled`.

## ValidationRun

- `state`: `idle | previewed | sending | flushing | completed | failed | interrupted`.
- `startedAt`: 화면 표시와 Sentry time-window 조회용 UTC timestamp; event payload/tag에는 보내지 않는다.
- `results`: code별 `ValidationResult` map.
- `flushSucceeded`: boolean 또는 아직 미실행인 null.
- `completedCount`: code별 terminal result 수.
- `capturedCount`: event ID가 있는 result 수.

### State transitions

```text
idle -> previewed
idle|previewed -> sending
sending -> flushing (15 fixtures processed)
flushing -> completed (15 event IDs + flush true)
sending|flushing -> failed (one or more capture/flush failures)
sending|flushing -> interrupted (unmount/background; no success claim)
completed|failed|interrupted -> idle (explicit reset starts a new run)
```

## ValidationResult

- `code`: expected stable code.
- `preview`: safe payload shown locally.
- `eventId`: string 또는 null.
- `status`: `pending | previewed | captured | failed`.
- `failureReason`: fixed local classification only; raw SDK error message 없음.

## SentryValidationClassification

- `environment`: `synthetic-validation`.
- `synthetic_validation`: fixed boolean/string true tag.
- `message`: unchanged stable operational code.
- `fingerprint`: unchanged `operational-error + code`.

시간과 event ID는 조회/대조에 사용하지만 payload의 grouping/tag에는 넣지 않는다.
