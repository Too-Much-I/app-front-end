# Phase 0 Research: Guest 인증 부트스트랩

## 1. 인증 소유권과 전송 계층

**Decision**: React와 분리된 중앙 Auth Controller를 두고, 공통 transport 위에 Identity 공개
API와 Learning Core 인증 API를 나눈다. `/guest`와 `/reissue`는 인증 interceptor를 타지 않는다.

**Rationale**: 기존 시험 API는 React hook이 아닌 일반 함수다. Controller가 Token과 Rotation을
소유하면 UI 밖에서도 같은 정책을 쓰고 `/reissue`가 자기 401 handler를 다시 호출하는 순환을
구조적으로 막을 수 있다.

**Alternatives considered**:

- React Context/Zustand가 네트워크까지 소유: UI 연결은 쉽지만 일반 endpoint와 background 작업이
  React 수명주기에 결합된다.
- endpoint마다 Authorization/재발급 구현: 누락과 서로 다른 재시도 정책이 생긴다.
- URL 문자열로 `/reissue`만 예외 처리: endpoint rename이나 base URL 변화에 취약하다.

## 2. Identity와 Learning Core 주소

**Decision**: `EXPO_PUBLIC_IDENTITY_API_BASE_URL`과 `EXPO_PUBLIC_LEARNING_API_BASE_URL`을
분리하고 기존 `EXPO_PUBLIC_API_BASE_URL`은 전환용 fallback으로만 사용한다. Gateway 환경에서는
두 새 값을 같은 URL로 설정할 수 있다. 현재 staging은 각각
`https://identity-staging.to-teacher.com`과 `https://api-staging.to-teacher.com`을 사용한다.
선택된 값은 URL로 파싱하고 HTTPS scheme이 아니면 Token이 포함된 요청 전에 거부한다.

**Rationale**: 백엔드 문서는 로컬 8081/8080 두 서비스를 명시하지만 현재 앱은 8000 단일 URL만
알고 있어 gateway 존재를 코드만으로 확정할 수 없다. 서비스 역할을 설정에 드러내면 두 배포
형태를 모두 지원하면서 비밀값을 추가하지 않는다.

**Alternatives considered**:

- Identity/Learning URL을 코드에 고정: staging/production과 로컬 구성이 달라진다.
- 기존 단일 URL만 유지: gateway가 없는 환경에서 Guest API를 호출할 수 없다.

## 3. Token과 installationId 저장

**Decision**: Expo SDK 57 호환 `expo-secure-store`를 사용한다. `installation-id.v1`과
`auth-session.v1` key는 분리하고, Access/Refresh Token·grant type·두 절대 만료 시각은 하나의
JSON 세션 레코드로 저장한다. `requireAuthentication`은 사용하지 않는다.

**Rationale**: Refresh Token과 same-install Guest를 복구하는 installationId는 인증 자격이다.
AsyncStorage는 암호화 저장소가 아니며, Token별 key는 Rotation 도중 서로 다른 세대를 남길 수
있다. installationId를 세션과 분리하면 세션 교체/정리로 사용자 연속성을 잃지 않는다.

**Alternatives considered**:

- AsyncStorage/Zustand persist: 저장 편의만 있고 자격 보호가 없다.
- Token별 SecureStore key: 부분 write와 crash window가 있다.
- `react-native-keychain`: 가능하지만 Expo 표준보다 native 설정 범위가 크다.
- 생체인증 보호: 부팅/갱신마다 prompt가 생겨 Guest 무마찰 흐름에 맞지 않는다.

## 4. installationId 생성과 수명

**Decision**: `expo-crypto`의 `Crypto.randomUUID()`로 UUIDv4를 만들고 SecureStore write 성공
후에만 반환한다. 동시 호출은 single-flight로 합친다. 없는 값은 생성하지만, 존재하는 손상 값이나
I/O 오류는 새 ID로 덮지 않고 복구 오류로 올린다.

**Rationale**: 저장 전 Guest 호출은 성공했는데 ID를 잃으면 같은 Guest를 복구할 수 없다. 손상
값을 조용히 바꾸면 학습 이력이 다른 Guest로 분리될 수 있다.

**Alternatives considered**:

- `Math.random()` 자체 UUID: 충돌·예측 위험이 있다.
- 광고 ID/device ID: 권한·개인정보·재설정 문제와 UUIDv4 계약에 맞지 않는다.
- 손상 시 자동 재생성: 복구보다 사용자 연속성 손실 위험이 크다.

## 5. 동의 기록과 legacy migration

**Decision**: 동의는 비밀이 아니므로 AsyncStorage에 유지하되 schema v2에서 privacy와 term을
각각 `{ consented, version, agreedAt }`로 기록한다. 신규 Guest 계약에 고정한 현재 버전은 개인정보
`"privacy-v1"`, 이용약관 `"term-v1"`이다. legacy `{ version: "1", agreedAt }`은
`privacy-v1`과 `term-v1`으로 명시적으로
매핑하고 다른 값은 재동의를 요구한다.

**Rationale**: 기존 화면은 두 checkbox가 모두 선택돼야 통합 v1을 저장했으므로 두 동의 사실을
이미 증명한다. 명시적 매핑은 불필요한 재동의를 막으면서 이후 두 문서 버전을 독립적으로 올릴 수
있다.

**Alternatives considered**:

- 모든 legacy 사용자 재동의: 가장 보수적이지만 동일 문서/동일 필수 체크에 불필요한 마찰이다.
- 모든 legacy 버전을 현재 버전으로 승격: 실제 동의 문서가 다른 경우 법적 의미가 틀린다.
- 동의를 SecureStore에 저장: 비밀이 아니며 migration/표시가 복잡해질 이점이 없다.

## 6. 앱 시작 상태 머신과 navigation

**Decision**: `CHECKING_LOCAL`, mode/requiredItems를 가진 `CONSENT_REQUIRED`, `REISSUING`,
`CHECKING_SERVER_CONSENT`, `GUEST_RECOVERING`, `CONSENT_UPDATING`, `AUTHENTICATED`,
`RETRYABLE_ERROR` 상태를 최상단에서 관리한다. 인증·서버 동의 확인 전에는 protected screen
set을 렌더링하지 않는다. Consent는 controller event를 호출하고 직접 MainTabs로 reset하지 않는다.

**Rationale**: React Navigation의 `initialRouteName`은 mount 이후 auth 상태 전환을 표현하지
못한다. Screen set 자체를 인증 상태에 맞추면 back gesture나 잘못된 reset으로 보호 화면을
우회할 수 없다.

**Alternatives considered**:

- 기존 `useConsentGate`에 boolean 추가: 저장/네트워크 단계와 재시도 원작업을 표현할 수 없다.
- 모든 route를 항상 선언하고 reset: 인증 전 보호 화면이 런타임에 존재하며 reset race가 생긴다.

## 7. 동의와 저장 순서

**Decision**: 최초 흐름은 installationId 저장 → 동의 저장 → Guest 호출 → 세션 단일 저장 →
메모리 commit → 홈 순서다. Guest 응답 후 세션 저장이 실패하면 메모리에 받은 응답의 저장부터
재시도하고 API를 즉시 다시 호출하지 않는다. 기존 사용자 흐름은 Reissue 세션 저장·commit →
서버 동의 GET → 필요 시 Bearer PUT → 로컬 동의 기록 순서다.

**Rationale**: AsyncStorage와 SecureStore 사이 원자 transaction은 없다. 동의 화면 전에
installationId를 보관해야 Guest 호출과 모든 재시도가 동일 사용자를 가리킨다. 동의는 Guest 호출
전에 기록해 Guest 성공/응답 유실 뒤 앱이 종료돼도 재동의를 요구하지 않는다. 기존 사용자의
로컬 동의는 PUT 성공 뒤에만 갱신해 서버 실패를 최신 동의로 오인하지 않는다.

**Alternatives considered**:

- 동의 화면 진입 뒤 installationId 생성: UUID 저장 실패를 사용자가 동의를 마친 뒤 늦게 알게 된다.
- Guest 후 동의 저장: 중간 종료 시 실제 동의했어도 다시 물어본다.
- Guest 후 installationId 저장: 기존 Guest를 찾을 key를 잃을 수 있다.
- 여러 저장소 동시 write: 원자성을 제공하지 않고 실패 순서가 비결정적이다.

## 8. 만료 판단과 Token Rotation

**Decision**: 응답을 받은 시각의 `Date.now() + expiresIn`으로 절대 만료 시각을 계산한다.
보호 요청 직전 Access Token 만료까지 60초 이하이면 Reissue한다. 앱 cold start에서는 Refresh
Token이 있으면 Access Token 잔여 시간과 무관하게 한 번 Reissue한다. 서버 401은 안전한 GET
조회에서만 자동 복구의 최종 안전장치로 사용한다.

**Rationale**: 모바일 background timer는 실행이 보장되지 않는다. 요청 시점 비교는 불필요한
타이머를 없애고, 잘못된 기기 시각은 401 fallback이 보완한다.

**Alternatives considered**:

- 25분 주기 timer: background에서 중단되고 사용하지 않아도 Token을 회전한다.
- 401에서만 갱신: 구현은 단순하지만 제출 시점에 불필요한 실패 왕복이 생긴다.

## 9. 동시 401과 늦은 401

**Decision**: Reissue는 공유 Promise 하나로 직렬화하고 자동 복구가 허용된 각 GET 요청은 자신이
사용한 Access Token generation을 캡처한다. 401 도착 시 현재 generation이 이미 달라졌으면 추가
Rotation 없이 현재 Token으로 GET을 한 번 재시도한다. 쓰기 요청은 401 뒤 자동 재전송하지 않는다.

**Rationale**: single-flight Promise가 정리된 뒤 old Token의 늦은 401이 도착할 수 있다. 세대
비교가 없으면 이미 새 Refresh Token으로 바뀐 직후 불필요한 두 번째 Rotation을 일으킨다.

**Alternatives considered**:

- 공유 Promise만 사용: 늦은 401 race가 남는다.
- 401마다 독립 Reissue: Refresh reuse detection과 세션 폐기를 유발할 수 있다.

## 10. 취소와 요청 재시도

**Decision**: 호출자 AbortSignal은 해당 요청의 wait/retry만 취소하고 공유 Reissue에는 전달하지
않는다. 기본 `apiFetch`는 모든 method를 한 번만 보내고, 별도 `apiFetchWithAuthRetry`는 body 없는
GET만 401 뒤 최대 한 번 재시도한다. 403, 5xx와 네트워크 오류는 인증 계층이 재시도하지 않는다.

**Rationale**: 한 화면의 unmount가 Rotation을 취소하면 다른 요청이 모두 실패한다. 서버가 이미
Rotation했는데 client만 취소하면 새 Refresh Token 저장 기회도 잃는다. 쓰기 body가 문자열이어도
서버 처리 여부를 클라이언트가 확정할 수 없으므로 자동 재전송 대상에서 제외한다.

**Alternatives considered**:

- 첫 요청자의 signal로 Reissue 취소: 공유 세션을 손상시킬 수 있다.
- 문자열 JSON 쓰기 body 재전송 허용: 인증 실패 전후 서버 처리 여부에 따라 작업이 중복될 수 있다.
- 무제한 재시도: POST 중복 실행과 인증 loop를 만든다.

## 11. Envelope와 오류 모델

**Decision**: transport가 HTTP 상태와 JSON `isSuccess`를 모두 검사한다. 성공은 code 문자열과
무관하게 `isSuccess=true`이며, 실패는 HTTP 200이어도 `ApiError { status, code, message,
result }`로 변환한다. 401 여부는 code 문자열이 아닌 HTTP status로 판정한다.

**Rationale**: Identity는 `SUCCESS`, Learning Core는 `COMMON_200`이므로 공통 code 비교가 없다.
오류 result는 null, 생략 또는 validation 배열일 수 있어 `unknown`으로 유지해야 한다.

**Alternatives considered**:

- endpoint마다 `isSuccess` 검사: 누락과 서로 다른 오류 모양이 생긴다.
- `code === COMMON200` 검사: 두 서비스 모두의 실제 성공 code와 맞지 않는다.

## 12. 플랫폼 수명주기와 의존성

**Decision**: 이 기능은 iOS/Android native release를 대상으로 한다. Android SecureStore backup
제외 설정을 Expo plugin으로 명시하고, iOS Keychain 값은 uninstall 후 남을 수 있음을 same-install
Guest 복구 정책과 함께 문서화한다. 의존성은 `pnpm exec expo install expo-secure-store expo-crypto`
로 SDK 호환 버전을 설치한다.

**Rationale**: Android uninstall과 iOS Keychain 수명은 동일하지 않으며 SecureStore만으로
“삭제하면 반드시 새 설치”를 보장할 수 없다. Expo bundled native module 버전을 쓰면 SDK 57
호환성을 유지한다.

**Alternatives considered**:

- uninstall 경계를 client 저장소만으로 엄격 보장: platform backup/Keychain 정책상 신뢰할 수 없다.
- SecureStore 대신 web 호환 저장소 사용: native 자격 보호를 약화한다.

## 13. 기존 사용자 동의의 서버 판정과 API 경계

**Decision**: 저장된 Refresh Token이 있으면 로컬 동의 버전보다 Reissue를 우선하고, 새 세션을
SecureStore에 저장·메모리 commit한 뒤 Identity의 Bearer 동의 조회를 수행한다. 항목별
`requiresConsent`가 최종 gate이며, 필요한 항목만 UI에서 새 동의를 받은 뒤 별도 Bearer PUT으로
반영한다. consent endpoint는 Access Token을 명시적으로 받아 raw `serviceFetch`를 사용한다.

**Rationale**: 새 정책 버전은 앱 배포 없이 서버에서 바뀔 수 있어 로컬 상수 비교만으로 감지할 수
없다. GET은 Bearer 인증이 필요하고 Refresh Rotation은 이전 Token을 폐기하므로 새 세션의 영속
저장이 조회보다 먼저 완료돼야 한다. controller가 endpoint에 Token을 전달하면 `apiFetch →
AuthController → consent endpoint` 순환 의존도 피할 수 있다.

**Alternatives considered**:

- 로컬 버전 비교 후 필요할 때만 GET: 앱이 모르는 서버 버전을 감지하지 못하고 서버 원장보다
  로컬 보조 기록이 우선한다.
- GET을 공통 Learning `apiFetch`에 연결: 서비스 base URL이 다르고 controller bootstrap 중
  controller 자신을 다시 호출하는 순환이 생긴다.
- 기존 사용자도 Guest API로 동의 갱신: 인증 복구와 법적 동의 갱신의 책임이 섞이고 서버가
  요구한 별도 Bearer 계약을 위반한다.
- 앱 업데이트로 동의 버전 강제: 간단하지만 WebView 문서와 서버 정책 변경마다 스토어 배포를
  요구해 불필요한 진입 차단을 만든다.

## Resolved Unknowns

- Guest request 필드는 단수형 `isTermConsented`, `termConsentVersion`을 사용한다.
- 신규 Guest의 개인정보/이용약관 버전은 각각 `privacy-v1`, `term-v1`이며 legacy 통합 v1은
  `privacy-v1`, `term-v1`으로만 이관한다.
- Identity/Learning Core URL은 서비스별 public 환경 변수로 분리하고 gateway에서 같게 설정한다.
- 알림, 시험 재개, WebView 인증과 submit body 변경은 이 계획에 포함하지 않는다.
- 미해결 조사 항목 없음.
