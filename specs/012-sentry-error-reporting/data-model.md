# Data Model: Sentry 운영 오류 보고 범위

## OperationalErrorCode

15개 안정 문자열 union이다. UI message나 서버 문구가 바뀌어도 code는 유지한다.

- `AUTH_BOOTSTRAP_FAILED`
- `EXAM_SESSION_CREATE_FAILED`
- `EXAM_REQUIRED_AUDIO_FAILED`
- `EXAM_PRELUDE_FAILED`
- `ANSWER_RECORDING_FAILED`
- `ANSWER_SUBMISSION_FAILED`
- `EXAM_GRADING_FAILED`
- `FEEDBACK_PAGE_LOAD_FAILED`
- `FEEDBACK_DATA_LOAD_FAILED`
- `FEEDBACK_HISTORY_LOAD_FAILED`
- `SUMMARY_FEEDBACK_RETRY_FAILED`
- `REANSWER_QUESTION_LOAD_FAILED`
- `REANSWER_SUBMISSION_FAILED`
- `REANSWER_GRADING_FAILED`
- `LEARNING_RECORD_DELETE_FAILED`

## OperationalErrorInput

Discriminated union으로 `code`에 따라 허용 context가 달라진다.

### 공통 전송 필드

- `code`: OperationalErrorCode
- `feature`: catalog가 code에서 정적으로 결정
- `operation`: 제한 문자열
- `stage`: 제한 문자열 또는 생략
- `reason`: 제한 문자열 또는 생략
- `retryable`: boolean 또는 생략
- `attempt`: `initial | retry` 또는 제한된 작은 정수
- `httpStatus`: 100~599 정수 또는 생략
- `serverCode`: 길이·문자 집합을 제한한 서버 분류 code 또는 생략
- `questionNumber`: 유효한 시험 문제 번호 또는 생략
- `partNumber`: 1~5 또는 생략
- `retryCount`: 0 이상의 제한된 정수 또는 생략
- `cueKind`: 정의된 cue 종류 또는 `unknown`

### 내부 전용 필드

- `cause`: safe HTTP 분류를 추출한 뒤 event에 보관하지 않는 unknown 값
- `dedupeKey`: owner가 중복 판단에만 쓰며 event에 전송하지 않는 값. 가능한 경우 별도 key 없이
  owner generation/ref로 처리한다.

### 금지 필드

exam/user/installation/request ID, token, URL, header, body, response/result/message, audio URI/path,
question/table/answer/feedback content는 input type에 존재하지 않는다.

## SafeFailureClassification

raw cause에서 다음만 추출한다.

- API error이면 유효 범위의 `httpStatus`
- 서버 code가 제한된 대문자·숫자·underscore/hyphen 문자열이면 `serverCode`
- 알려진 local domain error이면 미리 정한 `reason`
- 그 밖의 값은 `unknown` 분류이며 stringification하지 않는다.

Abort/cancelled는 classification 이전에 caller가 제외한다.

## ReportingAttempt

- `generation`: owner-local number/ref; 전송하지 않음
- `reportedCodes`: 현재 generation에서 보낸 code/set; 전송하지 않음
- `status`: `active | succeeded | failed | cancelled`

### State transitions

```text
new attempt -> active
active -> automatic retry -> active (no report)
active -> succeeded -> succeeded (no report)
active -> user/background cancel -> cancelled (no report)
active -> terminal failure -> failed + one report
failed -> user retry -> new attempt generation
```

WebView reload, answer user retry, auth retry와 cue replay는 각 owner가 새 generation을 정의한다.

## ScrubbedErrorEvent

- stable message: Operational error code
- level: error
- fingerprint: operational + error code + 필요한 제한 stage
- tags: feature, error_code, operation, stage/reason 중 cardinality가 제한된 값
- context: boolean/number/제한 문자열만 포함한 safe context
- request: URL/header/cookie/data 제거
- user: 제거
- breadcrumb/context/extra: 민감 key recursive filtering 적용

수동 event에는 exception 객체를 붙이지 않는다.
