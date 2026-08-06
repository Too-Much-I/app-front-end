# Integration Contract: Answer Submission

## Identity

모든 endpoint와 client registry는 다음 tuple을 하나의 답변 회차로 취급한다.

```text
(examId, questionNumber, retryCount)
```

- `questionNumber`는 `ExamSession.questions[].questionNumber`다.
- 최초 응시와 interruption 후 재녹음은 `retryCount=0`이다.
- network attempt는 별도 값이며 retryCount를 바꾸지 않는다.

## Step 1 — Upload URL

```http
GET /api/v1/exams/{examId}/questions/{questionNumber}/upload-url?retryCount={retryCount}
```

Success result:

```json
{
  "uploadUrl": "https://presigned.example/...",
  "fileKey": "answer/path/file.m4a",
  "expiresIn": 300
}
```

Client rules:

- shared `ApiEnvelope<ExamAnswerUploadUrl>`에서 `result`를 unwrap한다.
- URL 만료 deadline을 응답 시점에 계산한다.
- `uploadUrl`, `fileKey`, deadline을 PUT 전에 client job에 함께 보존한다.
- 동일 URL이 유효한 동안 retry-safe PUT에 재사용하고, 만료·거부 뒤 새 URL을 요청하지 않는다.

## Step 2 — Binary Upload

```http
PUT {uploadUrl}
Content-Type: audio/mp4

<binary m4a body>
```

Client rules:

- Expo FileSystem foreground upload를 사용한다.
- 2xx만 성공이며 non-2xx 응답도 명시적으로 오류 처리한다.
- 한 PUT은 15초 timeout을 가진다.
- network timeout, 408, 429, 5xx는 최초 요청 이후 최대 5회의 bounded retry 대상이다.
- base delay `1s, 2s, 4s, 8s, 16s`마다 50~100% equal jitter를 적용한다.
- 대부분의 다른 4xx는 terminal upload failure다.
- local file은 PUT 전에 존재하고 size가 0보다 커야 한다.
- job cancellation과 PUT timeout signal을 합성한다.
- 다음 delay와 PUT timeout을 더한 시점이 deadline을 넘으면 시도하지 않는다.
- PUT 2xx 뒤 local file을 삭제하고 이후 고지 재시도에서는 Answer Key만 사용한다.

## Step 3 — Notify Upload Completion

```http
POST /api/v1/exams/{examId}/questions/{questionNumber}/submit?retryCount={retryCount}
```

Accepted result status:

- `PENDING`
- `PROCESSING`
- `COMPLETED`

`FAILED`는 고지 성공이 아니라 처리 실패로 표시하며 자동 파일 재업로드를 시작하지 않는다.

Notification retry rules:

1. network error, timeout, 408, 429, 5xx는 동일 Answer Key로 최대 3회 추가 재시도한다.
2. base delay `1s, 2s, 4s`마다 50~100% equal jitter를 적용한다.
3. 일반 4xx와 `FAILED`는 자동 재시도하지 않는다.
4. 고지 실패나 응답 유실 때 S3 PUT을 반복하지 않는다.
5. 존재하지 않는 question status endpoint를 조회하지 않는다.
6. 서버는 같은 `(examId, questionNumber, retryCount)`의 반복 고지를 하나의 채점
   작업으로 처리하고 이미 접수된 요청에 성공으로 해석 가능한 응답을 반환해야 한다.

## Client Registry Contract

```ts
interface RegisterAnswerInput {
  key: AnswerKey;
  audioFileUri: string;
}

interface AnswerSubmissionSummary {
  registeredCount: number;
  pendingCount: number;
  failedCount: number;
  succeededCount: number;
  isComplete: boolean;
}
```

Commands:

- `register(input)`: 새 key면 runner 시작, 기존 동일 key/URI면 기존 job 반환
- `retry(key)`: 유효한 upload target이 있으면 같은 PUT, PUT이 끝났으면 같은 고지부터 재개
- `resumePending()`: AppState active 복귀 시 retry-wait/paused job 재개
- `dispose()`: 요청과 wait 취소, runner settlement 뒤 남은 owned file 정리

Registry rules:

- FIFO 순서를 보장하거나 요구하지 않는다.
- key별 runner는 single-flight이며 한 job의 retry wait가 다른 key의 runner를 막지 않는다.
- finalized 파일 등록 성공이 다음 문항 전환 조건이다.
- registry에 등록되지 않은 문항은 완료 집계에서 성공으로 추정하지 않는다.
- 만료된 upload target과 일반 4xx failure는 수동 재시도 대상으로 노출하지 않는다.

Completion barrier:

```text
registeredCount == expectedAnswerCount
AND succeededCount == expectedAnswerCount
AND pendingCount == 0
AND failedCount == 0
```

## Cancellation Contract

- `apiFetch`는 caller signal과 내부 timeout signal을 함께 존중한다.
- 취소는 upload failure로 사용자에게 표시하지 않고 `cancelled`로 정규화한다.
- 파일을 읽는 native upload가 끝나기 전에는 해당 파일을 삭제하지 않는다.
- process kill 이후 작업 복원은 보장하지 않는다. 이 contract의 background는 다음 문항 중
  비차단 실행과 foreground 복귀 재개를 뜻한다.

## Final Failure UI Contract

- 모든 pending job이 끝났고 하나 이상의 failed job이 있으면 완료로 표시하지 않는다.
- `public/mascots/error.png`, 실패 안내와 `홈으로 돌아가기` 버튼을 표시한다.
- retryable failed job이 있으면 `다시 시도` 버튼도 표시한다.
- 일반 4xx 또는 만료된 upload target만 남으면 재시도를 노출하지 않는다.
- 홈 이동은 submission registry를 dispose하고 MockExam stack을 초기화한 뒤 `Home` tab으로 이동한다.
