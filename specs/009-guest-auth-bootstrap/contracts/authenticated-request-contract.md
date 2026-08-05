# Contract: Authenticated Learning Core Request

## Scope

기존 `apiFetch()`를 사용하는 Learning Core 사용자 API에 적용한다. S3 Presigned PUT과 Identity
Guest/Reissue에는 적용하지 않는다.

## Service and header

- Base URL: `EXPO_PUBLIC_LEARNING_API_BASE_URL`, 없을 때만 legacy
  `EXPO_PUBLIC_API_BASE_URL` fallback
- Every attempt: `Authorization: Bearer {currentAccessToken}`
- Content type: JSON body가 있을 때 `application/json`
- userId, installationId, provider, guestUserId를 body/path/query에 자동 추가하지 않음

## Replayable request input

인증 client가 자동 재시도할 수 있는 body는 다음으로 제한한다.

```text
undefined
JSON string
```

각 attempt는 새로운 headers와 AbortController/timeout을 만든다. stream, FormData, Blob 또는 파일
body는 별도 client/request factory 없이는 허용하지 않는다.

현재 시험 API의 submit body 계약 자체는 이 인증 기능에서 변경하지 않는다.

## Request algorithm

```text
1. Authenticated session 요구
2. accessTokenExpiresAt - Date.now() <= 60,000이면 shared Reissue
3. current { accessToken, generation } snapshot 캡처
4. snapshot Token으로 원 요청 attempt
5. success면 Envelope 반환
6. 403 또는 401 이외 오류면 ApiError 반환
7. 401이면:
   a. 이미 한 번 retry했으면 종료
   b. current generation != used generation이면 Reissue하지 않음
   c. 같으면 shared Reissue 수행
   d. 최신 snapshot으로 원 요청을 정확히 한 번 retry
```

## Refresh concurrency

- 동시에 시작된 Reissue는 하나의 shared Promise를 기다린다.
- shared Promise는 새 AuthSession의 SecureStore write와 memory commit까지 포함한다.
- Promise가 완료된 뒤 늦게 온 old-generation 401은 generation 비교로 두 번째 Rotation을 막는다.
- 새 세션 저장 성공 전에는 waiter에게 새 Access Token을 공개하지 않는다.
- Reissue 성공 후 generation은 단조 증가한다.

## Cancellation

- caller AbortSignal은 그 caller의 원 요청, refresh 대기와 retry만 중단한다.
- caller signal을 shared Reissue fetch 또는 SecureStore commit에 전달하지 않는다.
- 모든 caller가 취소돼도 이미 시작한 shared Reissue는 timeout 범위 안에서 완료하고 저장한다.
- App/provider unmount는 controller 실행 generation을 바꿔 늦은 UI 전환만 막으며 Rotation commit을
  중간에 버리지 않는다.

## Response and errors

### Success

HTTP 2xx이며 body가 다음 구조를 만족해야 한다.

```ts
type ApiEnvelope<T> = {
  isSuccess: true;
  code: string;
  message: string;
  result: T;
};
```

`code`는 `COMMON_200`, `SUCCESS` 또는 미래의 다른 값일 수 있으며 성공 판정에 사용하지 않는다.

### ApiError

```ts
type ApiErrorShape = {
  status: number;
  code?: string;
  message: string;
  result?: unknown;
};
```

- HTTP error도 JSON error envelope가 있으면 code/message/result를 보존한다.
- HTTP 200 + `isSuccess=false`도 ApiError다.
- non-JSON error는 HTTP status text 또는 안전한 fallback message를 사용한다.
- error `result`는 UI가 unsafe cast하지 않도록 `unknown`이다.

## Non-retry rules

| Condition | Automatic auth action |
| --- | --- |
| 401 first attempt | generation check, refresh if needed, one retry |
| 401 retry attempt | none; fail |
| 403 | none; fail |
| network/timeout | none; fail |
| 5xx | none; fail |
| caller abort | caller only stops |
| `isSuccess=false` with HTTP 2xx | none unless endpoint/auth controller explicitly classifies it |

## Regression boundary

- 시험 endpoint별 파일과 `Raw* → mapper → domain` 경계를 유지한다.
- S3 upload는 Presigned URL에 Authorization을 붙이지 않는다.
- 자동 재시도가 endpoint의 non-auth business retry나 grading retry를 대신하지 않는다.
- terminate/trial/submit의 backend 계약 변경은 별도 기능이다.
