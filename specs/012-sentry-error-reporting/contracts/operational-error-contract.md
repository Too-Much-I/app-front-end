# Contract: Operational Sentry Error Reporting

## Report boundary

`reportOperationalError(input)`은 fire-and-forget side effect이며 사용자 상태나 return value를
결정하지 않는다. Sentry가 꺼졌거나 capture가 실패하면 조용히 return한다.

## Catalog contract

| Code | Feature | Required safe dimensions | Terminal trigger |
|---|---|---|---|
| `AUTH_BOOTSTRAP_FAILED` | auth | source, operation, attempt | retryable auth UI state |
| `EXAM_SESSION_CREATE_FAILED` | mock-exam | stage, attempt, safe API class | start blocked |
| `EXAM_REQUIRED_AUDIO_FAILED` | mock-exam | cue kind, part/question if applicable | required cue unavailable |
| `EXAM_PRELUDE_FAILED` | mock-exam | part, prelude reason | prelude error phase |
| `ANSWER_RECORDING_FAILED` | exam-answer | stage, question, attempt | recording recovery phase |
| `ANSWER_SUBMISSION_FAILED` | exam-answer | stage, reason, retryable, question, attempt | job failed after built-in retry |
| `EXAM_GRADING_FAILED` | grading | stage, reason, retry attempt | terminal-error after retry |
| `FEEDBACK_PAGE_LOAD_FAILED` | feedback | reason, reload attempt | WebView error UI |
| `FEEDBACK_DATA_LOAD_FAILED` | feedback | resource, safe API class | failed bridge response |
| `FEEDBACK_HISTORY_LOAD_FAILED` | feedback | surface, attempt | visible empty error state |
| `SUMMARY_FEEDBACK_RETRY_FAILED` | feedback | stage, reason | shared retry operation failed |
| `REANSWER_QUESTION_LOAD_FAILED` | reanswer | question, safe failure class | question-failed UI state |
| `REANSWER_SUBMISSION_FAILED` | reanswer | stage/reason, question, retry count | submit-failed UI state |
| `REANSWER_GRADING_FAILED` | reanswer | reason, question, retry count | grading-failed UI state |
| `LEARNING_RECORD_DELETE_FAILED` | settings | operation, safe API class | delete error UI state |

## Timing contract

- Call in the same owner branch that commits terminal state.
- Do not call from shared transport, general catch logging or error UI render.
- Do not call for an intermediate retry, pending poll, abort, cancel, permission denial or unmount.
- Repeated callback/render for the same attempt must not call again.
- Explicit user retry creates a new attempt eligible for one new report.

## Privacy contract

### Allowed

- catalog code and bounded feature/operation/stage/reason values
- booleans and small bounded attempt/location numbers
- HTTP status and sanitized stable server code
- app release, environment and platform supplied by the SDK

### Forbidden

- user, account, installation, exam or request identifiers
- auth token, cookie, headers, request/response body
- URL/query, audio URI/path/content
- question/table/answer/feedback content
- raw Error, message, stack as manual event context

## Grouping contract

Message and fingerprint use the stable catalog code. Stage may be appended only where one code intentionally
represents independently actionable owners. Unique IDs, retry numbers and HTTP status do not enter fingerprint.

## Existing behavior contract

Reporting must not change UI copy, navigation, timeout, retry counts, API requests, recorder lifecycle or
cleanup. It must never throw into the caller.
