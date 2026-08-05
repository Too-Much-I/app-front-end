# Quickstart: Guest 인증 부트스트랩 검증

이 문서는 구현 완료 후 iOS/Android 개발 빌드에서 실행할 검증 절차다. 자동 테스트 러너가 없는
현재 저장소에서는 lint/typecheck와 관찰 가능한 device 시나리오를 모두 완료한다.

## 1. Prerequisites

- Node/pnpm은 repository가 지정한 `pnpm@11.12.0` 사용
- Identity test server에 `/api/v1/auth/guest`, `/api/v1/auth/reissue`, Bearer
  `/api/v1/users/me/consents` GET/PUT이 배포돼 있음
- Learning Core test server가 Identity Access Token 검증 가능
- same-install Guest 요청이 같은 Guest를 반환하는 test backend 계약 확인
- iOS Simulator/device와 Android Emulator/device 중 최소 하나씩 준비

> 2026-08-05 staging 확인 시 아직 배포 전 계약이어서 legacy 필수 필드 `isAudioConsent`가 없으면
> `INVALID_REQUEST`를 반환했다. client에는 임시 호환 필드를 남기지 않으며, 본 문서의 다섯 필드
> 계약이 배포된 뒤 Guest bootstrap 시나리오를 다시 검증한다.

환경 예시:

```dotenv
EXPO_PUBLIC_IDENTITY_API_BASE_URL=https://identity-staging.to-teacher.com
EXPO_PUBLIC_LEARNING_API_BASE_URL=https://api-staging.to-teacher.com
EXPO_PUBLIC_WEB_BASE_URL=https://to-teacher.com
```

Gateway 환경은 두 API base URL을 같은 값으로 설정한다. URL은 public 설정이며 Token이나 다른
secret을 환경 변수에 넣지 않는다.

## 2. Install and static checks

계획 승인 후 구현 단계에서 Expo SDK 호환 패키지를 pnpm으로 설치한다.

```sh
pnpm exec expo install expo-secure-store expo-crypto
pnpm lint
pnpm exec tsc --noEmit
```

Expected:

- npm/yarn lockfile이 생기지 않는다.
- lint와 strict TypeScript가 모두 성공한다.
- 실패 시 command, 원인, 변경 범위 관련성을 결과에 기록한다.

## 3. Fresh install and consent

1. 앱 데이터와 기존 Keychain/Keystore test 값을 제거한 clean install로 실행한다.
2. MainTabs가 잠깐 보이지 않고 installationId UUIDv4가 SecureStore에 먼저 저장된 뒤 Consent
   화면이 표시되는지 storage adapter의 redacted event로 확인한다.
3. 개인정보 항목만 선택한 채 시작을 눌러 Guest network 요청이 발생하지 않는지 확인한다.
4. 이용약관도 선택하고 시작한다.
5. Consent 화면과 두 checkbox가 유지되고 시작 버튼 문구가 `시작하는 중...`으로 바뀌며 disabled,
   busy 접근성 상태가 전달되는지 확인한다.
6. 진행 중 버튼을 다시 눌러도 동의 저장 또는 Guest 요청이 중복되지 않는지 확인한다.
7. Guest request가 [Identity contract](./contracts/identity-auth-contract.md)의 단수형 다섯 필드와
   version `"privacy-v2"`, `"term-v1"`을 보내는지 backend test log의 redacted metadata로 확인한다.
8. Token pair가 저장된 뒤에만 MainTabs가 표시되는지 확인한다.
9. Learning Core 요청이 Authorization header를 사용하고 userId/installationId를 보내지 않는지
   확인한다.

Expected: 한 번의 동의 완료로 같은 Guest의 홈에 진입하며 Token/installationId 원문이 console에
출력되지 않는다.

## 4. Consent and installation storage failures

개발용 storage adapter/fault injection으로 각 write를 한 번 실패시킨다.

### Consent write failure

- Expected: Guest API가 호출되지 않고 선택 상태를 유지한 재시도 UI를 제공한다.

### installationId write failure

- Expected: Guest API가 호출되지 않고 동일 pending UUID의 저장만 재시도한다.

### Guest success followed by AuthSession write failure

- Expected: MainTabs가 표시되지 않는다.
- Consent 제출에서 시작했다면 기존 checkbox 선택과 오류/재시도 UI가 같은 화면에 유지된다.
- 재시도 버튼은 Guest API를 다시 호출하기 전에 받은 세션 write를 재시도한다.
- 앱을 강제 종료해 메모리 세션도 잃은 뒤 재실행하면 동일 installationId로 Guest를 호출한다.
- backend에서 Guest user identity가 바뀌지 않았음을 확인한다.

## 5. Legacy consent migration

AsyncStorage에 legacy `{ "version": "1", "agreedAt": valid ISO timestamp }`를 준비하고 Token은
없는 상태로 실행한다.

Expected:

- Consent 화면을 다시 요구하지 않는다.
- `privacy-v1`/`term-v1`에 같은 agreedAt을 가진 V2 record로 저장한다.
- same-install Guest 복구 후 홈에 진입한다.

다음 변형도 확인한다.

| Input | Expected |
| --- | --- |
| legacy version other than `"1"` | Consent 필요 |
| malformed consent JSON | Consent 필요 |
| AsyncStorage read I/O error | Consent로 오판하지 않고 retry screen |
| privacy 또는 term version mismatch | Consent 필요 |

## 6. Cold restart and Token Rotation

1. 정상 Guest 세션으로 앱을 완전히 종료한다.
2. 다시 실행한다.
3. Access Token이 아직 남아 있어도 `/auth/reissue`가 한 번 호출되는지 확인한다.
4. 성공 뒤 Access/Refresh Token과 두 만료 시각이 모두 새 세대로 바뀌는지 저장소 adapter의 redacted
   generation 정보로 확인한다.
5. 세션 저장과 memory commit 뒤 새 Access Token으로 consent GET이 호출되는지 확인한다.
6. 이전 Refresh Token으로 별도 재발급을 시도하지 않는지 확인한다.

Expected: 추가 동의 없이 5초 내 기존 Guest로 홈에 진입한다.

### 서버 동의가 모두 현재인 경우

privacy/terms의 `requiresConsent=false` 응답을 준비한다.

Expected:

- 로컬 ConsentRecord가 없거나 과거 버전이어도 Consent 화면을 표시하지 않는다.
- 서버 `consentedVersion`과 `consentedAt`을 로컬 보조 기록에 동기화한 뒤 홈에 진입한다.

### 일부 항목만 재동의가 필요한 경우

privacy는 `requiresConsent=true`, terms는 `false`인 응답을 준비한다.

Expected:

- Consent 화면에서 privacy만 새 선택을 요구하고 terms는 기존 동의 상태로 표시한다.
- 제출 전 Guest API call count가 증가하지 않는다.
- PUT body는 두 항목 모두 `true`이고 각 version은 GET의 `currentVersion`이다.
- PUT 성공 뒤 privacy는 새 버전·제출 시각, terms는 기존 version·consentedAt으로 로컬 저장된다.
- PUT 실패 시 checkbox를 유지하고 같은 PUT을 재시도한다.
- PUT 성공 뒤 local write만 실패하면 PUT을 반복하지 않고 local write부터 재시도한다.

### 동의 상태 조회 실패

consent GET을 timeout 또는 5xx로 실패시킨다.

Expected: 로컬 기록으로 홈/재동의를 추측하지 않고 MainTabs를 차단한 채 동일 GET 재시도를
제공한다. 첫 GET의 401은 Rotation과 GET 재시도를 각각 최대 한 번만 허용한다.

## 7. Expired and uncertain Refresh failures

### Definitive invalid/expired/reused

Identity가 HTTP 401과 `INVALID_REFRESH_TOKEN`, `REFRESH_TOKEN_EXPIRED` 또는
`REFRESH_TOKEN_REUSE_DETECTED`를 반환하게 한다.

Expected: 유효한 consent/installationId로 `/auth/guest`를 호출하고 같은 Guest를 복구한다.

### Network timeout or 5xx

Reissue 응답을 timeout시키거나 5xx를 반환한다.

Expected:

- 자동 Guest 호출이 발생하지 않는다.
- MainTabs가 표시되지 않는다.
- retry screen에서 Reissue 작업을 다시 시도할 수 있다.

## 8. Proactive expiry and 401 fallback

### Expiring Access Token

Access expiry가 현재 시각 기준 60초 이내인 세션에서 Learning Core 요청을 실행한다.

Expected: 원 요청 전에 Reissue하고 새 Access Token으로 요청한다.

### Device clock mismatch / first 401

client가 Token을 유효하다고 판단하지만 Learning Core가 첫 attempt에 401을 반환하게 한다.

Expected: Reissue 후 Authorization을 새로 구성해 원 요청을 정확히 한 번 재시도한다.

### Retry also returns 401

Expected: 두 번째 Reissue나 무한 loop 없이 ApiError/복구 상태로 종료한다.

### 403

다른 사용자의 examId로 HTTP 403을 반환하게 한다.

Expected: Reissue가 한 번도 호출되지 않는다.

## 9. Concurrent and late 401

제어 가능한 test endpoint/proxy로 요청 A와 B가 같은 old Token을 쓰게 한다.

### Simultaneous 401

1. A와 B의 401을 거의 동시에 반환한다.
2. Identity Reissue call count를 확인한다.

Expected: Reissue는 한 번이고 A/B는 같은 새 generation으로 각각 최대 한 번 재시도한다.

### Late 401

1. A의 401을 먼저 반환해 Rotation을 완료한다.
2. shared refresh Promise가 정리된 뒤 B의 old-token 401을 반환한다.

Expected: B는 generation 차이를 감지해 추가 Reissue 없이 현재 Token으로 한 번 재시도한다.

### Caller abort during shared refresh

1. A/B가 같은 Reissue를 기다리게 한다.
2. A 화면을 이탈해 A signal만 abort한다.

Expected: A만 중단되고 Reissue/세션 저장은 계속되며 B는 성공한다.

## 10. Envelope validation

Identity와 Learning Core 각각에서 다음 응답을 준비한다.

| Response | Expected |
| --- | --- |
| HTTP 200 + `isSuccess=true` + `SUCCESS` | success |
| HTTP 200 + `isSuccess=true` + `COMMON_200` | success |
| HTTP 200 + `isSuccess=true` + unknown code | success |
| HTTP 200 + `isSuccess=false` | structured ApiError |
| HTTP 4xx + JSON error envelope | status/code/message/result preserved |
| non-JSON HTTP error | safe fallback ApiError |
| malformed success Token result | protocol error, no storage/home entry |

## 11. Lifecycle and platform checks

### Background/unmount

- Guest/Reissue 중 앱을 background로 이동했다가 복귀한다.
- auth 화면 component를 unmount하는 개발 시나리오를 만든다.

Expected: 늦은 실행이 잘못된 navigator를 렌더링하지 않고, 시작된 Rotation은 저장까지 완료한다.

### Android

- uninstall/reinstall 후 SecureStore 값이 복원되지 않는지 확인한다.
- Auto Backup restore가 암호화할 수 없는 Token을 되살리지 않는지 확인한다.

### iOS

- uninstall/reinstall에서 Keychain 값이 남을 수도 있는 platform 동작을 확인한다.
- local consent가 없으면 남은 Token만으로 홈을 우회하지 않는지 확인한다.

### Responsive/accessibility

- 작은 phone과 tablet에서 Consent/Recovery UI의 safe area와 button 폭을 확인한다.
- screen reader에서 checkbox, disabled, busy/retry 상태가 전달되는지 확인한다.

## 12. Scope regression

- 기존 시험 생성, upload URL, S3 PUT, submit, status, summary 요청이 인증 header 외에는 바뀌지
  않았는지 확인한다.
- submit body나 examId 재개 정책을 이 변경에서 수정하지 않았는지 diff로 확인한다.
- Notifications 화면/API/device registration 관련 변경이 없는지 확인한다.
- WebView 인증, 이메일/소셜 로그인, logout API가 추가되지 않았는지 확인한다.

## 13. Completion evidence

구현 handoff에는 다음을 기록한다.

- 변경 파일과 각 책임
- lint/typecheck 결과
- iOS/Android에서 실행한 시나리오와 결과
- backend test 환경에서 확인한 Guest identity 연속성 및 Reissue call count
- 실행하지 못한 검증과 이유
- 알려진 platform storage 수명 차이와 후속 범위
