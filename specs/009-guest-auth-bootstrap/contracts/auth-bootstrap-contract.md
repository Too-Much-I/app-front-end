# Contract: App Auth Bootstrap and UI Gate

## Render contract

| Auth state | Rendered UI | Protected routes available |
| --- | --- | --- |
| `CHECKING_LOCAL` | splash/loading | No |
| `REISSUING` | splash/loading | No |
| `CHECKING_SERVER_CONSENT` | splash/loading | No |
| `GUEST_RECOVERING(startup)` | splash/loading | No |
| `GUEST_RECOVERING(consent-submit)` | 기존 Consent 화면 + 선택 유지 + `시작하는 중...` | No |
| `CONSENT_REQUIRED(new)` | 두 항목의 public Consent stack + policy/terms WebView | No |
| `CONSENT_REQUIRED(existing)` | 서버가 요구한 항목의 Consent stack + policy/terms WebView | No |
| `CONSENT_UPDATING` | 기존 Consent 화면 + 선택 유지 + `동의 반영 중...` | No |
| `RETRYABLE_ERROR(startup)` | Auth recovery screen | No |
| `RETRYABLE_ERROR(consent-submit)` | 기존 Consent 화면 + 선택 유지 + 오류/재시도 | No |
| `AUTHENTICATED` | MainTabs and protected root screens | Yes |

Root navigation은 `initialRouteName`으로 auth transition을 흉내 내지 않는다. 현재 state에 해당하는
screen set만 렌더링하고, `AUTHENTICATED` 전에는 MainTabs/Reanswer/Settings 등 보호 route를 선언하지
않는다.

## Startup contract

```text
1. fonts와 auth bootstrap 시작
2. auth session 읽기
3. Refresh Token이 있으면 Reissue
4. Token pair 검증
5. SecureStore AuthSession write
6. memory session/sessionGeneration commit
7. 새 Access Token으로 서버 동의 상태 GET
8. 두 항목 모두 현재 동의면 local consent 동기화 후 protected navigator render
9. 필요한 항목이 있으면 기존 사용자 Consent 표시
10. Refresh Token이 없으면 installationId get/create + SecureStore write
11. local consent가 없거나 현재 신규 Guest 계약과 다르면 신규 Consent 표시
12. 유효한 local consent가 있으면 same-install Guest 복구
```

폰트 준비와 인증 준비가 모두 끝나기 전까지 splash를 내리지 않는다. 다만 Consent 또는 recovery
화면도 정상적인 auth bootstrap 결과이므로 해당 state가 정해지면 public navigator를 렌더링한다.

## Consent submit contract

Consent 화면의 시작 버튼은 다음을 만족할 때만 활성화한다.

```text
화면에서 required로 표시된 모든 항목 checked
submit/storage/guest/update 작업 진행 중 아님
```

버튼 event 순서:

```text
이미 저장된 installationId 확인
→ ConsentRecordV2 write
→ Guest request
→ AuthSession write
→ memory session/sessionGeneration commit
→ AUTHENTICATED
```

화면은 `navigation.reset(MainTabs)`를 직접 호출하지 않는다. 실패 시 두 checkbox 선택과 pending
retry operation을 보존한다. 위 작업이 진행되는 동안 Consent 화면을 교체하지 않고 시작 버튼을
`시작하는 중...`으로 표시하며 접근성 busy/disabled 상태를 제공한다.

기존 사용자 event 순서:

```text
server consent snapshot의 requiresConsent 항목 확인
→ required 항목 사용자 선택
→ server currentVersion으로 Bearer consent PUT
→ 변경 항목은 제출 시각, 비변경 항목은 server consentedAt을 보존한 ConsentRecordV2 write
→ AUTHENTICATED
```

PUT 성공 전에는 local record를 최신으로 쓰지 않는다. PUT 성공 뒤 local write가 실패하면 PUT을
반복하지 않고 pending ConsentRecordV2 write부터 재시도한다.

## Retry contract

Recovery 화면은 controller가 보존한 operation만 재시도한다.

| Operation | Retry action |
| --- | --- |
| `read-local` | storage reads/migration 재시작 |
| `persist-consent` | 동일 pending consent write 후 지정된 continuation 수행 |
| `persist-installation` | 동일 pending UUID write; 새 UUID 생성 금지 |
| `reissue` | 저장된 현재 Refresh Token으로 사용자-triggered 재시도 |
| `guest` | 같은 installationId와 현재 consent로 재시도 |
| `persist-session` | 메모리에 보존한 새 AuthSession write 후 지정된 bootstrap continuation 수행; API 재호출 금지 |
| `check-consent` | 현재 memory session의 Access Token으로 동일 GET 재시도 |
| `update-consent` | 동일 server snapshot과 version으로 PUT 재시도; Guest 호출 금지 |

Retry 중 버튼을 비활성화해 같은 operation의 중복 실행을 막는다.

## Failure classification

- Session이 없는 상태의 Consent missing/version mismatch/corrupt JSON → `CONSENT_REQUIRED(new)`
- Session이 있는 상태의 local consent missing/version mismatch → 서버 GET 전환에 영향 없음
- Consent AsyncStorage I/O error → `RETRYABLE_ERROR(read-local)`
- AuthSession missing/corrupt → same-install `GUEST_RECOVERING`
- AuthSession SecureStore I/O error → `RETRYABLE_ERROR(read-local)`
- installationId missing → 생성 후 저장
- installationId corrupt/I/O error → `RETRYABLE_ERROR`, 새 ID 자동 생성 금지
- Reissue definitive invalid/expired/reused → `GUEST_RECOVERING`
- Reissue network/timeout/5xx/protocol unknown → `RETRYABLE_ERROR(reissue)`
- Guest failure → `RETRYABLE_ERROR(guest)`
- AuthSession write failure → `RETRYABLE_ERROR(persist-session)`
- consent GET network/timeout/5xx/protocol failure → `RETRYABLE_ERROR(check-consent)`
- consent GET 401 → shared Rotation 한 번 후 GET 한 번 재시도, 재실패 시 retryable error
- consent PUT failure → `RETRYABLE_ERROR(update-consent)`이며 Consent 화면 선택 보존
- consent PUT 성공 후 local write failure → `RETRYABLE_ERROR(persist-consent)`이며 PUT 반복 금지

## Lifecycle contract

- Controller bootstrap은 동시에 하나만 실행한다.
- Provider cleanup은 controller 구독을 해제해 이전 화면에 늦은 state를 반영하지 않고, controller의
  실행 generation은 재시작된 bootstrap이 이전 run의 state를 덮는 것을 막는다.
- 이미 서버 Rotation을 시작한 Promise는 화면 unmount만으로 abort하지 않는다.
- app foreground 복귀는 보호 요청 시 만료 검사를 사용하며 별도 interval timer를 시작하지 않는다.

## Accessibility and layout

- Recovery 화면은 기존 `Text`, `Pressable`, theme token과 safe-area primitive를 사용한다.
- 오류 설명과 재시도 버튼에는 접근성 label/state를 제공한다.
- phone/tablet에서 중앙 content가 과도하게 늘어나지 않도록 responsive width를 사용한다.
- Token, installationId, raw rejectedValue는 화면에 표시하지 않는다.

## Out of scope routes

이번 계약은 Notifications route나 알림 기기 등록을 추가/수정하지 않는다. 이메일·소셜 로그인,
로그아웃, WebView Token 전달, 시험 중단 후 같은 examId 복구도 포함하지 않는다.
