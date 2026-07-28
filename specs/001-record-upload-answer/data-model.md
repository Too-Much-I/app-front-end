# Data Model: 모의고사 답변 녹음 및 업로드

## 1. Answer Key

문항 답변과 모든 비동기 작업을 식별하는 불변 키다.

| Field | Type | Rule |
|---|---|---|
| `examId` | string | 서버가 생성한 실제 시험 세션 ID, 빈 문자열 불가 |
| `questionNumber` | number | 현재 `ExamSession.questions`의 양의 정수 문항 번호 |
| `retryCount` | number | 서버 답변 회차의 0-base index, 최초 응시는 0 |

관계와 규칙:

- 한 Answer Key는 최대 하나의 Recording Generation을 finalized 결과로 채택한다.
- 한 Answer Key는 최대 하나의 Submission Job을 가진다.
- 네트워크 재시도와 interruption 후 로컬 재녹음은 `retryCount`를 증가시키지 않는다.
- key 직렬화는 세 필드를 모두 포함하며 question index나 현재 화면 closure를 사용하지 않는다.

## 2. Exam Run

현재 mounted 시험 화면이 소유하는 진행 상태다.

| Field | Type | Description |
|---|---|---|
| `session` | ExamSession | examId와 순서가 고정된 문항 목록 |
| `currentIndex` | number | 현재 문항의 0-base index |
| `phase` | Exam Phase | 현재 사용자 흐름 |
| `expectedAnswerCount` | number | 완료 barrier가 기대하는 전체 문항 수 |
| `activeAnswerKey` | Answer Key or null | 현재 녹음과 연결된 불변 key |

### Exam Phase

```text
directions
  → preparation
  → starting-response
  → response
  → finalizing
  → preparation(next question) | directions(next part)

finalizing file validation failure
  → recording-recovery
  → starting-response(same question)

response/start interruption before finalize intent
  → discarding
  → interrupted
  → starting-response(same question)

last finalizing
  → submission-barrier
  → completed
```

Validation rules:

- `currentIndex`는 session questions 범위를 벗어나지 않는다.
- `response`는 recorder 상태가 `recording`인 동안만 유효하다.
- 다음 문항 전환은 현재 finalized URI가 registry에 성공적으로 등록된 뒤에만 가능하다.
- URI 없음, missing file, 0 byte면 `currentIndex`를 유지하고 전체 제한 시간으로 재녹음한다.
- `completed`는 registry의 registered/succeeded 수가 expected answer count와 같고 failed/pending이 0일 때만 가능하다.

## 3. Recording Generation

한 번의 native prepare/record/terminal cycle이다. interruption 후 재녹음은 같은 Answer Key의
새 generation이다.

| Field | Type | Description |
|---|---|---|
| `generationId` | monotonically increasing number | 늦게 끝난 async 작업을 무효화하는 token |
| `answerKey` | Answer Key | 시작 시 복사해 고정 |
| `maxDurationMs` | positive number | 문항의 답변 제한 시간 |
| `status` | Recording Status | recorder lifecycle 상태 |
| `elapsedMs` | non-negative number | native recorder가 보고한 실제 녹음 시간 |
| `meteringDb` | number or null | 표시 전용 입력 레벨 |
| `canAskPermissionAgain` | boolean | 권한 복구 UI 결정 |
| `terminalIntent` | finalize or discard or null | 경쟁하는 종료 event의 최종 정책 |

### Recording Status

```text
idle
  → preparing
  → recording
  → finalizing
  → finalized

preparing | recording
  → discarding
  → interrupted

finalizing
  → finalized | error

preparing
  → permission-denied | error
```

Terminal result:

- `FinalizedAnswer`: Answer Key, generation ID, non-empty local file URI, duration
- `InterruptedAnswer`: 제출 가능한 URI 없음, 부분 파일 삭제 완료 또는 best-effort 삭제 기록
- `RecordingFailure`: 권한/prepare/stop/file-validation 단계와 복구 가능 여부

Validation rules:

- native stop과 audio mode restore는 generation별 terminal Promise 하나만 수행한다.
- URI는 stop 완료 후 읽고 `File.exists && size > 0`을 만족해야 finalized가 된다.
- AppState interruption이 finalize보다 먼저면 discard, finalize가 먼저면 뒤이은 AppState
  event가 intent를 덮지 않는다.
- media reset/stop/file validation 실패는 finalize intent 뒤에도 finalized 결과를 만들지 않는다.
- recorder가 만든 파일의 소유권은 finalized event 직전까지 recorder에, registration 성공 뒤 registry에 있다.

## 4. Submission Job

FinalizedAnswer 하나의 upload/submit/retry 상태다.

| Field | Type | Description |
|---|---|---|
| `key` | Answer Key | registry의 불변 key |
| `audioFileUri` | string | S3 PUT 성공 전까지 유지할 cache 파일 |
| `uploadUrl` | string or null | 최초 발급 뒤 PUT 재시도 전체에서 고정할 presigned URL |
| `uploadExpiresAt` | timestamp or null | upload URL 응답 시점에 계산한 만료 시각 |
| `fileKey` | string or null | upload URL과 함께 발급되어 서버 고지에 사용하는 객체 key |
| `uploadCompleted` | boolean | S3 PUT 2xx가 확인되어 이후 실행이 고지 단계에서만 재개되는지 여부 |
| `stage` | Submission Stage | 현재 작업 단계 |
| `stageAttempt` | non-negative number | 현재 network stage 재시도 횟수 |
| `nextRetryAt` | timestamp or null | abort 가능한 retry wait 종료 시점 |
| `lastError` | Submission Failure or null | 사용자 안내용 정규화 오류 |
| `acceptedStatus` | PENDING/PROCESSING/COMPLETED or null | 서버 고지 성공 증거 |

### Submission Stage

```text
queued-upload
  → uploading
  → queued-notify
  → notifying
  → succeeded

uploading | notifying
  → retry-wait
  → uploading | notifying

uploading | notifying | retry-wait
  → failed
  → uploading | queued-notify  (retryable manual retry only)

any non-terminal state
  → cancelled  (session dispose)
```

Stage rules:

- `uploadUrl === null`이면 최초 upload target 요청부터 시작한다. target을 받으면
  `uploadUrl`, `uploadExpiresAt`, `fileKey`를 한 번에 저장하고 이후 PUT 재시도에서 바꾸지 않는다.
- `uploadCompleted === true`이면 로컬 파일이나 upload URL의 존재 여부와 관계없이 S3 PUT을
  다시 실행하지 않고 같은 `fileKey`의 서버 고지만 실행한다.
- S3 PUT의 network/timeout/408/429/5xx는 같은 target으로 최대 5회 추가 재시도한다.
- PUT 2xx 뒤에는 로컬 파일을 삭제하고 `queued-notify`로 전환한다.
- 서버 고지의 network/timeout/408/429/5xx는 같은 fileKey로 최대 3회 추가 재시도한다.
- 모든 자동 retry wait는 equal jitter를 사용하며 S3는 다음 시도가 만료 예산을 넘으면 중단한다.
- 같은 key가 이미 registry에 있으면 두 번째 registration은 새 runner를 만들지 않는다.
- 같은 key에 다른 URI가 들어오면 invariant violation으로 처리한다.
- 서버 고지 응답 유실은 `submission-unknown`이나 status 조회로 분기하지 않고 동일 고지를
  재시도한다. 이 동작은 서버가 tuple/fileKey를 멱등 처리한다는 계약에 의존한다.
- `PENDING`, `PROCESSING`, `COMPLETED`는 고지 성공이다. `FAILED`와 일반 4xx는 terminal failure다.
- PUT 전 `failed`에서는 파일을 유지한다. PUT 뒤 notify failure에는 로컬 파일이 필요하지 않다.

## 5. Aggregate Submission State

화면의 다음 문항 진행과 마지막 barrier를 위한 파생 상태다.

| Field | Derivation |
|---|---|
| `registeredCount` | registry entry 수 |
| `pendingCount` | queued-upload/uploading/queued-notify/notifying/retry-wait 수 |
| `failedCount` | failed 수 |
| `succeededCount` | succeeded 수 |
| `isComplete` | registeredCount = expectedAnswerCount AND succeededCount = expectedAnswerCount |

`Promise.all` snapshot을 저장하지 않고 registry reducer에서 매 render 파생한다. 마지막 문항
등록 뒤 새 retry 상태가 생겨도 barrier가 최신 상태를 관찰해야 하기 때문이다.

## 6. Data Lifecycle

1. 실제 server ExamSession을 생성한다.
2. response 시작 시 Answer Key를 Recording Generation에 고정한다.
3. 정상 종료는 cache URI를 검증하고 Submission Job으로 소유권을 넘긴다.
4. key별 runner는 최초 upload URL → 같은 target의 S3 PUT → 서버 고지를 수행한다.
5. S3 PUT 성공 뒤 로컬 파일을 삭제하고, 고지 성공 뒤 job을 succeeded로 만든다.
6. finalize보다 먼저 발생한 interruption은 registry entry를 만들지 않고 부분 파일을 삭제한다.
7. session dispose는 runner/request/retry timer를 cancel하고 파일 read가 끝난 뒤 남은 owned 파일을 정리한다.
