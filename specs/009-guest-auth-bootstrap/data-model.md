# Data Model: Guest 인증 부트스트랩

## 1. InstallationIdentity

설치 계보와 Guest 사용자를 연결하는 로컬 인증 식별자다.

| Field | Type | Persisted | Validation |
| --- | --- | --- | --- |
| `installationId` | `string` | SecureStore `installation-id:v1` | lowercase/uppercase를 허용하는 표준 UUIDv4 형식 |

### Invariants

- 값이 없을 때만 새 UUID를 생성한다.
- SecureStore 저장 성공 전에는 Guest API에 전달하지 않는다.
- AuthSession 삭제·Rotation과 함께 삭제하지 않는다.
- 값이 존재하지만 형식이 손상됐거나 읽기 I/O가 실패하면 조용히 새 값으로 교체하지 않는다.
- 원문을 log, analytics, error message에 포함하지 않는다.

## 2. ConsentRecordV2

로컬 진입 gate와 Guest 요청을 위한 비밀이 아닌 동의 보조 기록이다. 서버가 최종 동의 원장이다.

```ts
type ConsentItemRecord = {
  consented: true;
  version: string;
  agreedAt: string;
};

type ConsentRecordV2 = {
  schemaVersion: 2;
  privacy: ConsentItemRecord;
  term: ConsentItemRecord;
};
```

| Field | Rule |
| --- | --- |
| `schemaVersion` | literal `2` |
| `privacy.consented` | Guest 인증 시 반드시 `true` |
| `privacy.version` | 현재 `PRIVACY_CONSENT_VERSION`과 정확히 일치, 현재값 `"privacy-v2"` |
| `privacy.agreedAt` | 유효한 ISO-8601 timestamp |
| `term.consented` | Guest 인증 시 반드시 `true` |
| `term.version` | 현재 `TERM_CONSENT_VERSION`과 정확히 일치, 현재값 `"term-v1"` |
| `term.agreedAt` | 유효한 ISO-8601 timestamp |

### Validity

다음 조건을 모두 만족해야 현재 동의로 본다.

```text
privacy.consented = true
privacy.version = current privacy version
term.consented = true
term.version = current term version
```

JSON 손상 또는 schema 불일치는 재동의 대상으로 본다. 저장소 I/O 오류는 미동의와 구분해
재시도 오류로 올린다.

## 3. LegacyConsentRecord

현재 앱이 저장하는 이전 형식이다.

```ts
type LegacyConsentRecord = {
  version: string;
  agreedAt: string;
};
```

### Migration table

| Legacy | V2 result |
| --- | --- |
| `version === "1"` + valid `agreedAt` | `privacy-v1`, `term-v1`에 같은 `agreedAt` 저장 |
| 다른 version | migration하지 않고 재동의 |
| JSON/schema 손상 | migration하지 않고 재동의 |
| AsyncStorage I/O 오류 | 재동의로 오판하지 않고 retryable error |

새 V2 write가 성공한 뒤에만 migration을 완료한 것으로 본다. 현재 legacy key를 재사용해 overwrite할
경우 별도 delete 단계는 없다.

## 4. ServerConsentStatus

인증된 기존 사용자의 서버 원장 상태를 client domain 값으로 정규화한다.

```ts
type ServerConsentItemStatus = {
  currentVersion: string;
  consentedVersion: string;
  consentedAt: string;
  requiresConsent: boolean;
};

type ServerConsentStatus = {
  privacy: ServerConsentItemStatus;
  terms: ServerConsentItemStatus;
};
```

- 두 version은 비어 있지 않은 문자열이어야 한다.
- `consentedAt`은 유효한 ISO-8601 문자열이어야 한다.
- `requiresConsent`가 기존 사용자 동의 화면의 required item을 결정한다.
- 저장된 AuthSession이 있으면 로컬 ConsentRecord보다 이 snapshot의 판단이 우선한다.
- snapshot은 PUT 성공 또는 bootstrap 종료 전까지 controller 메모리에만 유지한다.

## 5. UpdateConsentsRequest

```ts
type UpdateConsentsRequest = {
  isPrivacyConsented: true;
  privacyConsentVersion: string;
  isTermConsented: true;
  termConsentVersion: string;
};
```

두 version은 직전 `ServerConsentStatus`의 `currentVersion`이다. 화면에서 새 동의를 받지 않은
항목도 현재 유효한 서버 상태와 버전을 함께 전달한다.

## 6. GuestAuthRequest

Identity Guest 생성/복구 요청 raw model이다.

```ts
type GuestAuthRequest = {
  installationId: string;
  isPrivacyConsented: true;
  privacyConsentVersion: string;
  isTermConsented: true;
  termConsentVersion: string;
};
```

동의 시각, userId, provider, guestUserId, audio consent 별도 필드는 보내지 않는다. 음성 데이터
수집·처리는 현재 개인정보 수집·이용 동의에 포함된다.

## 7. ReissueRequest

```ts
type ReissueRequest = {
  refreshToken: string;
};
```

Refresh Token은 opaque string이며 JWT로 decode하지 않는다.

## 8. RawTokenPair

Guest와 Reissue의 성공 `result` raw model이다.

```ts
type RawTokenPair = {
  accessToken: string;
  refreshToken: string;
  grantType: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
};
```

### Validation

- Token과 `grantType`은 비어 있지 않은 string이다.
- `accessTokenExpiresIn`과 `refreshTokenExpiresIn`은 0보다 큰 유한한 millisecond 정수다.
- 응답 수신 시각 하나를 기준으로 두 절대 만료 시각을 계산한다.
- raw model은 SecureStore에 직접 저장하지 않고 AuthSession으로 변환한다.

## 9. AuthSession

SecureStore의 하나의 JSON 값으로 교체하는 인증 세션이다.

```ts
type AuthSession = {
  schemaVersion: 1;
  accessToken: string;
  refreshToken: string;
  grantType: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
};
```

### Invariants

- 모든 필드가 유효할 때만 전체 세션을 사용한다.
- Access와 Refresh Token을 별도 write하지 않는다.
- 새 세션 SecureStore write 성공 후 메모리 session과 generation을 함께 commit한다.
- 이전 세션을 먼저 delete하지 않는다.
- 만료 시각은 epoch milliseconds다.
- Token 원문을 log, error, analytics 또는 사용자 UI에 포함하지 않는다.

### Derived values

```text
accessRemainingMs = accessTokenExpiresAt - Date.now()
refreshRemainingMs = refreshTokenExpiresAt - Date.now()
shouldProactivelyRefresh = accessRemainingMs <= 60_000
```

이 값은 client 최적화다. 서버 401이 최종 유효성 판단이다.

## 10. AuthBootstrapState

```ts
type AuthBootstrapState =
  | { status: "CHECKING_LOCAL" }
  | {
      status: "CONSENT_REQUIRED";
      mode: "new" | "existing";
      requiredItems: { privacy: boolean; terms: boolean };
    }
  | { status: "REISSUING" }
  | { status: "CHECKING_SERVER_CONSENT" }
  | { status: "GUEST_RECOVERING"; source: "startup" | "consent-submit" }
  | { status: "CONSENT_UPDATING"; source: "consent-submit" }
  | { status: "AUTHENTICATED" }
  | {
      status: "RETRYABLE_ERROR";
      source: "startup" | "consent-submit";
      retry: BootstrapRetry;
      message: string;
    };
```

`message`에는 Token, installationId 또는 backend 원문 validation 값이 포함되지 않는다.
`source="consent-submit"`이면 Consent 화면과 선택 상태를 유지하며 busy/error UI를 표시하고,
`source="startup"`이면 bootstrap loading 또는 별도 recovery 화면을 사용한다.

## 11. BootstrapRetry

오류 화면의 버튼이 새 작업을 추측하지 않고 실패한 작업을 이어가도록 보존하는 descriptor다.

```ts
type BootstrapRetry =
  | { operation: "read-local" }
  | {
      operation: "persist-consent";
      consent: ConsentRecordV2;
      continuation: "guest" | "authenticated";
    }
  | { operation: "persist-installation"; installationId: string }
  | { operation: "reissue" }
  | { operation: "guest" }
  | {
      operation: "persist-session";
      session: AuthSession;
      continuation: "authenticated" | "check-consent";
    }
  | { operation: "check-consent" }
  | { operation: "update-consent"; request: UpdateConsentsRequest };
```

민감한 `session`은 사용자 UI나 serializable navigation params에 넣지 않고 controller 메모리 안에서만
참조한다.

## 12. RequestAuthSnapshot

보호 요청이 어떤 Token 세대를 사용했는지 나타내는 메모리 전용 값이다.

```ts
type RequestAuthSnapshot = {
  accessToken: string;
  generation: number;
};
```

- `generation`은 AuthSession commit마다 단조 증가한다.
- 401 response가 돌아오면 snapshot generation과 현재 generation을 비교한다.
- 다르면 이미 다른 요청이 Rotation을 완료한 것이므로 추가 Reissue 없이 최신 snapshot으로 한 번
  재시도한다.
- 이 값은 영속화하지 않는다.

## 13. State transitions

```text
CHECKING_LOCAL
├─ Refresh 있음                      → REISSUING
├─ Refresh 없음 + installation 없음  → installationId 저장
├─ Refresh 없음 + 동의 없음/무효     → CONSENT_REQUIRED(new)
├─ Refresh 없음 + 유효 동의           → GUEST_RECOVERING
└─ 저장소 I/O/installation 손상      → RETRYABLE_ERROR

CONSENT_REQUIRED(new)
├─ 한 항목 미선택                    → CONSENT_REQUIRED
├─ 동의 저장 성공                    → GUEST_RECOVERING
└─ 저장 실패                         → RETRYABLE_ERROR

REISSUING
├─ Token pair 저장 성공              → CHECKING_SERVER_CONSENT
├─ invalid/expired/reused 확정        → GUEST_RECOVERING
└─ 결과 불명/저장 실패               → RETRYABLE_ERROR

CHECKING_SERVER_CONSENT
├─ requiresConsent 모두 false        → local record 동기화 → AUTHENTICATED
├─ 하나 이상 true                    → CONSENT_REQUIRED(existing)
└─ 조회/저장 실패                    → RETRYABLE_ERROR

CONSENT_REQUIRED(existing)
├─ required 항목 미선택              → CONSENT_REQUIRED(existing)
├─ required 항목 제출                → CONSENT_UPDATING
└─ 비required 항목                   → 기존 동의 상태 유지

CONSENT_UPDATING
├─ PUT + local record 저장 성공      → AUTHENTICATED
├─ PUT 실패                          → RETRYABLE_ERROR(update-consent)
└─ PUT 성공 + local 저장 실패        → RETRYABLE_ERROR(persist-consent)

GUEST_RECOVERING
├─ consent-submit Token 저장 성공    → AUTHENTICATED
├─ startup Token 저장 성공           → CHECKING_SERVER_CONSENT
└─ API/저장 실패                     → RETRYABLE_ERROR

RETRYABLE_ERROR
└─ retry descriptor의 작업 성공      → 중단 지점 다음 상태
```

`AUTHENTICATED`만 protected navigator를 렌더링할 수 있다.

## 14. Relationships

```text
ConsentRecordV2 ──현재 두 동의──┐
                               ├─ GuestAuthRequest ──RawTokenPair── AuthSession
InstallationIdentity ──────────┘

AuthSession ──memory commit── RequestAuthSnapshot ──Learning Core request

AuthSession ──Access Token── ServerConsentStatus
ServerConsentStatus ──requiresConsent── Consent UI ──UpdateConsentsRequest
UpdateConsentsRequest ──PUT success── ConsentRecordV2
```

installationId와 Token은 Learning Core request body/query/path로 전달하지 않는다. Learning Core는
오직 `Authorization: Bearer {accessToken}`을 통해 JWT `sub`를 사용한다.
