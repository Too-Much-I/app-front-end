# Quickstart: Sentry 운영 오류 보고 검증

## Verification levels

1. **Workspace**: type, lint, source contract, privacy scan and bundle checks.
2. **Native failure injection**: iOS/Android development build에서 15개 terminal 상태와 제외 경로 확인.
3. **Sentry delivery**: 승인된 Sentry-enabled validation build에서 최종 payload와 event count 확인.

3단계는 외부 event write다. production project에 합성 event를 전송하기 전에 사용자 승인과 project
access가 필요하다. 로컬 기본값은 계속 disabled로 둔다.

## Static checks

```sh
pnpm lint
pnpm exec tsc --noEmit
git diff --check
pnpm exec expo export --platform all --output-dir /tmp/app-front-end-sentry-reporting-dist
```

추가 source audit:

- catalog에 15개 code가 정확히 한 번 정의됐는지 확인한다.
- 각 code가 contract의 terminal owner에서 호출되는지 확인한다.
- manual report input에 ID, URL, body, message, audio URI 또는 raw exception 전달이 없는지 확인한다.
- `captureException`을 handled failure에 사용하지 않는지 확인한다.
- 기존 timeout/retry 상수와 사용자 문구가 diff에서 바뀌지 않았는지 확인한다.

## Manual catalog matrix

| Code | Failure injection | Expected |
|---|---|---|
| `AUTH_BOOTSTRAP_FAILED` | local read/reissue/guest/consent operation을 실패시킴 | retry UI가 뜰 때 1건; retry 성공 시 추가 0건 |
| `EXAM_SESSION_CREATE_FAILED` | session create를 최종 실패시킴 | start block과 함께 1건 |
| `EXAM_REQUIRED_AUDIO_FAILED` | sound test/cue asset load 또는 playback 실패 | 해당 cue generation에 1건 |
| `EXAM_PRELUDE_FAILED` | Part 3/4 필수 context 누락·충돌 fixture | error phase에 1건 |
| `ANSWER_RECORDING_FAILED` | prepare/stop/file validation 실패 | recording recovery에 시도당 1건 |
| `ANSWER_SUBMISSION_FAILED` | upload target/upload/notify 최종 실패 | 내장 retry 전 0건, job failed 뒤 1건 |
| `EXAM_GRADING_FAILED` | first poll timeout 뒤 retry도 실패 | retry-ready에서 0건, terminal-error에서 1건 |
| `FEEDBACK_PAGE_LOAD_FAILED` | WebView network/HTTP load failure | 여러 WebView callback에도 reload당 1건 |
| `FEEDBACK_DATA_LOAD_FAILED` | initial native data request 실패 | failed bridge response당 1건 |
| `FEEDBACK_HISTORY_LOAD_FAILED` | 캐시 없는 home/history 조회 실패 | visible error state에 1건; 기존 data 유지 시 0건 |
| `SUMMARY_FEEDBACK_RETRY_FAILED` | request/poll/timeout 각각 실패 | 공유 operation당 1건, requestId 없음 |
| `REANSWER_QUESTION_LOAD_FAILED` | question endpoint/mapper 실패 | question-failed에 1건 |
| `REANSWER_SUBMISSION_FAILED` | upload/notify 최종 실패 | submit-failed에 1건 |
| `REANSWER_GRADING_FAILED` | server FAILED와 timeout fixture | grading-failed에 시도당 1건 |
| `LEARNING_RECORD_DELETE_FAILED` | withdraw 요청 실패 | delete error UI에 request당 1건 |

## Exclusion matrix

- 자동 retry 뒤 성공: 0건
- polling 중 일시 GET 실패 뒤 완료: 0건
- microphone permission denied: 0건
- user cancel/close/retake: 0건
- background/unmount/new-request abort: 0건
- successful work 뒤 audio cleanup 실패: 0건
- cached/previous history가 유지되는 refetch 실패: 0건
- malformed unrelated WebView message: 0건

## Privacy fixture

각 manual 경로의 cause/breadcrumb/context에 합성 exam UUID, access/refresh token, Authorization,
cookie, URL query, audio file URI, server message와 answer text를 넣는다. Sentry `beforeSend` 직후
event에서 다음을 확인한다.

- `user`, request URL/header/cookie/data가 없다.
- tags/context에는 contract allowlist만 있다.
- exception/message/extra/breadcrumb에 fixture 원문이 없다.
- fingerprint에 unique value가 없다.

## Delivery confirmation

승인된 validation release와 environment tag로 15종을 한 번씩 발생시킨다. Sentry에서 code별 1건,
expected stage/reason, release/environment를 대조하고 forbidden-field search가 0건인지 확인한다.
자동 retry/cancel fixture는 event가 없음을 시간 window로 확인한다.

## Limitations

- 현재 저장소에는 자동 test runner가 없어 failure injection과 exact SDK payload assertion은 수동이다.
- workspace만으로 Sentry ingestion, symbolication과 server-side grouping은 검증할 수 없다.
- 실제 native crash/symbolication 확인에는 source map/debug symbol을 업로드한 native build가 필요하다.

## Implementation verification record (2026-08-12)

### Workspace verification

- Catalog/source mapping: 15개 code가 discriminated union에 각각 한 번 정의됐고, 15개 모두 terminal
  owner의 `reportOperationalError` 호출 지점이 있음을 확인했다.
- Privacy scan: manual SDK payload에 exam/request/installation ID, URL/URI/path, token/header/cookie,
  request/response/body/result/message와 raw exception이 전달되지 않음을 확인했다. `ApiError`는 범위가
  제한된 HTTP status와 대문자·숫자·underscore 형식의 server code로만 분류된다.
- Final scrub: request URL/query/header/cookie/data와 user context를 제거하고, event/tag/context/extra/
  breadcrumb/exception의 ID·URL·URI·token·오디오 경로를 전송 직전에 필터링함을 확인했다.
- Exclusions/dedupe source audit: 자동 retry·polling의 중간 실패, permission denial, interruption,
  unmount/abort/background와 기존 data 유지 경로가 report branch 전에 제외된다. auth, submission,
  grading, WebView와 audio owner의 attempt/ref/set이 같은 시도의 중복을 막고 명시적 재시도를 새
  시도로 처리한다.
- `CI=true pnpm lint`: 통과.
- `CI=true pnpm exec tsc --noEmit`: 통과.
- `git diff --check`: 통과.
- `CI=true pnpm exec expo export --platform all --output-dir
  /tmp/app-front-end-sentry-reporting-dist`: iOS/Android bundle 생성 통과.

### Not executed

- 자동 test runner와 준비된 backend/audio failure fixture가 없어 iOS/Android 기기에서 15개 실패를
  실제 주입하는 검증은 실행하지 않았다.
- Sentry delivery는 외부 project에 event를 쓰는 작업이므로 별도 사용자 승인 없이 실행하지 않았다.
  따라서 ingestion, 실제 event count/payload, grouping, symbolication은 아직 확인되지 않았다.
