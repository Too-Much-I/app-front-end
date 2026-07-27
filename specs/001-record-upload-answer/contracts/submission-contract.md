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
- 동일 URL이 유효한 동안 retry-safe PUT에 재사용하고, 만료 뒤 새 URL을 요청한다.

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
- network timeout, 408, 429, 5xx는 bounded retry 대상이다.
- 대부분의 다른 4xx는 terminal upload failure다.
- local file은 PUT 전에 존재하고 size가 0보다 커야 한다.
- job cancellation과 PUT timeout signal을 합성한다.

## Step 3 — Submit for Grading

```http
POST /api/v1/exams/{examId}/questions/{questionNumber}/submit?retryCount={retryCount}
Content-Type: application/json

{"fileKey":"answer/path/file.m4a"}
```

Accepted result status:

- `PENDING`
- `PROCESSING`
- `COMPLETED`

`FAILED`는 접수 성공이 아니라 처리 실패로 표시하며 자동 파일 재업로드를 시작하지 않는다.

## Ambiguous Submit Reconciliation

submit timeout 또는 connection loss는 서버 접수 여부를 알 수 없는 `submission-unknown`이다.

```http
GET /api/v1/exams/{examId}/questions/status?questionNumber={questionNumber}&retryCount={retryCount}
```

Rules:

1. `PENDING/PROCESSING/COMPLETED`이면 기존 submit이 접수된 것으로 확정한다.
2. `FAILED`이면 처리 실패로 표시하고 자동 재-submit하지 않는다.
3. status 조회 자체가 실패하면 `fileKey`와 local URI를 유지하고 조회를 재시도한다.
4. 현재 client type의 status union에는 미접수 값이 없으므로 일반 4xx/5xx 또는 network
   error를 미접수로 간주하지 않는다.
5. 서버가 명확한 미접수 결과를 반환하고 아래 멱등성 검증을 통과한 경우에만 같은
   `fileKey`로 submit을 다시 보낸다.
6. 서버는 같은 `(examId, questionNumber, retryCount, fileKey)`의 반복 submit을 하나로
   처리하고 기존 상태를 반환해야 한다. 같은 Answer Key에 다른 `fileKey`가 오면 conflict로
   거부해야 한다. 이 조건을 확인하지 못하면 자동 재-POST를 활성화하지 않는다.

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
- `retry(key)`: fileKey가 있으면 submit/reconcile, 없으면 upload부터 재개
- `resumePending()`: AppState active 복귀 시 retry-wait/paused job 재개
- `dispose()`: 요청과 wait 취소, runner settlement 뒤 남은 owned file 정리

Registry rules:

- FIFO 순서를 보장하거나 요구하지 않는다.
- key별 runner는 single-flight이며 한 job의 retry wait가 다른 key의 runner를 막지 않는다.
- finalized 파일 등록 성공이 다음 문항 전환 조건이다.
- registry에 등록되지 않은 문항은 완료 집계에서 성공으로 추정하지 않는다.

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
