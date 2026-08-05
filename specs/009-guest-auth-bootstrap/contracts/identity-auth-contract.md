# Contract: Identity Guest Authentication

## Service base URL

Identity 요청은 `EXPO_PUBLIC_IDENTITY_API_BASE_URL`을 사용한다. 설정되지 않은 전환 환경에서만
`EXPO_PUBLIC_API_BASE_URL`을 fallback으로 사용한다. 값이 둘 다 없으면 네트워크 요청 전에 구성
오류로 실패한다. 선택된 값은 유효한 HTTPS URL이어야 하며, 다른 scheme이나 잘못된 URL은
Authorization 또는 Refresh Token을 구성하기 전에 거부한다.

## Common success rule

HTTP 2xx와 JSON `isSuccess: true`를 모두 만족해야 성공이다. `code` 값은 Identity의 현재
`SUCCESS`를 보존하되 client 성공 판정에 사용하지 않는다.

```ts
type ApiSuccess<T> = {
  isSuccess: true;
  code: string;
  message: string;
  result: T;
};
```

`isSuccess: false`는 HTTP 2xx여도 실패다. 실패 `result`는 null, 생략 또는 validation 배열일 수
있으며 `unknown`으로 보존한다.

## POST `/api/v1/auth/guest`

Access Token 없이 호출하는 Guest 생성 또는 same-install 복구 API다.

### Headers

```http
Content-Type: application/json
```

### Request

```json
{
  "installationId": "550e8400-e29b-41d4-a716-446655440000",
  "isPrivacyConsented": true,
  "privacyConsentVersion": "privacy-v1",
  "isTermConsented": true,
  "termConsentVersion": "term-v1"
}
```

Required invariants:

- 두 boolean은 모두 `true`다.
- 두 version은 현재 앱 동의 문서 version과 각각 일치한다.
- installationId는 저장이 완료된 UUIDv4다.
- audio consent, userId, provider, guestUserId를 별도로 보내지 않는다.

### Success result

```json
{
  "isSuccess": true,
  "code": "SUCCESS",
  "message": "요청에 성공했습니다.",
  "result": {
    "accessToken": "access-token",
    "refreshToken": "opaque-refresh-token",
    "grantType": "Bearer",
    "accessTokenExpiresIn": 1800000,
    "refreshTokenExpiresIn": 1209600000
  }
}
```

두 `expiresIn`은 milliseconds다. 같은 installationId 요청은 중복 Guest를 만들지 않고 같은 Guest에
사용할 새 Token pair를 반환한다.

### Client failure classification

| Failure | Client behavior |
| --- | --- |
| network/timeout/5xx | 같은 installationId로 사용자 재시도 허용 |
| `isSuccess=false` | ApiError로 변환하며 확인되지 않은 code로 동의 gate 전환을 추측하지 않음 |
| malformed success result | retryable protocol error, 저장/홈 진입 금지 |
| SecureStore session write failure | API보다 받은 Token pair의 저장을 먼저 재시도 |

## POST `/api/v1/auth/reissue`

Access Token 없이 Refresh Token을 body로 보내며 Token pair를 Rotation한다.

### Request

```json
{
  "refreshToken": "opaque-refresh-token"
}
```

Refresh Token은 Authorization header로 보내거나 JWT로 해석하지 않는다.

### Success result

Guest 성공 result와 같은 다섯 필드를 반환한다. 성공 시 기존 Refresh Token은 즉시 폐기되므로
Access/Refresh Token과 만료 시각을 하나의 AuthSession으로 저장해야 한다.

### Definitive invalid responses

다음 code는 HTTP 401과 함께 현재 Refresh credential이 확정적으로 사용할 수 없음을 뜻한다.

```text
INVALID_REFRESH_TOKEN
REFRESH_TOKEN_EXPIRED
REFRESH_TOKEN_REUSE_DETECTED
```

유효한 local consent와 installationId가 있으면 same-install Guest 복구로 이동한다.

### Indeterminate failures

network disconnect, timeout, 5xx, malformed response는 서버 Rotation 완료 여부를 알 수 없다. 자동으로
새 Guest로 전환하거나 같은 Refresh Token을 background loop로 반복하지 않고 Reissue 작업을 보존한
retryable error를 표시한다.

## GET `/api/v1/users/me/consents`

저장·메모리 commit이 끝난 최신 Access Token으로 기존 사용자의 서버 동의 상태를 조회한다.

### Headers

```http
Authorization: Bearer <accessToken>
```

### Success result

```json
{
  "isSuccess": true,
  "code": "SUCCESS",
  "message": "요청에 성공했습니다.",
  "result": {
    "privacy": {
      "currentVersion": "privacy-v2",
      "consentedVersion": "privacy-v1",
      "consentedAt": "2026-08-05T07:00:00Z",
      "requiresConsent": true
    },
    "terms": {
      "currentVersion": "term-v1",
      "consentedVersion": "term-v1",
      "consentedAt": "2026-08-05T07:00:00Z",
      "requiresConsent": false
    }
  }
}
```

각 version은 비어 있지 않은 문자열, `consentedAt`은 유효한 ISO-8601 문자열,
`requiresConsent`는 boolean이어야 한다. raw shape는 endpoint mapper에서 검증해
`ServerConsentStatus`로 반환한다. 하나라도 `requiresConsent=true`이면 controller가 해당 항목만
동의 화면의 required item으로 전달한다.

## PUT `/api/v1/users/me/consents`

기존 사용자의 재동의를 Guest API와 분리해 반영한다.

### Headers

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

### Request

```json
{
  "isPrivacyConsented": true,
  "privacyConsentVersion": "privacy-v2",
  "isTermConsented": true,
  "termConsentVersion": "term-v1"
}
```

- 두 version은 직전 GET의 각 `currentVersion`을 사용한다.
- 화면은 `requiresConsent=true`인 항목만 새로 선택받지만 API에는 두 동의의 현재 상태와 버전을
  함께 전달한다.
- 성공 판정은 HTTP 2xx와 `isSuccess=true`이며 `result` payload에는 의존하지 않는다.
- 실패 시 local ConsentRecord를 최신으로 쓰거나 Guest API로 fallback하지 않는다.
- 성공 후 local record는 변경 항목에 제출 시각을 기록하고, 변경되지 않은 항목은 GET에서 받은
  `consentedVersion`과 `consentedAt`을 보존한다.

## Security and logging

- Request/response logging에서 Token과 installationId를 redact한다.
- Error message와 analytics property에 Token, UUID 또는 validation rejectedValue를 넣지 않는다.
- Public Expo environment variables에는 URL만 두며 secret을 넣지 않는다.
