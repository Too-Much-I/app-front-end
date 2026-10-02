# Firebase·SNS 인증 API 명세 — 2026-09-22

- 원본: 백엔드 전달 「프론트엔드 Firebase·SNS 로그인 및 회원 전환 연동 가이드」
- 원본 기준일: 2026-09-21
- 프론트 기록일: 2026-09-22
- 적용 범위: 모바일 Firebase·SNS 로그인, 신규 회원가입, 기존 Guest 승격·병합
- 주의: 이 문서는 계약 스냅샷이다. 코드 존재가 해당 환경의 배포·feature flag 활성화를 보장하지 않는다.

## 1. 확정된 제품 정책

- Google·Apple·Kakao 인증은 Firebase Auth를 사용한다.
- Firebase ID Token은 Identity API에만 증명으로 제출한다.
- Learning Core에는 Identity Access Token만 보낸다.
- 신규 Guest 생성 API는 신규 앱에서 호출하지 않는다.
- 기존 Guest의 Token은 SNS 승격·병합이 끝날 때까지 보존한다.
- 신규 앱은 이메일 로그인 UI, 전화번호 변경 API, Firebase UID rebind를 제공하지 않는다.
- Guest용 `ALREADY_LINKED` 결과는 폐기됐다.
- MEMBER의 Provider 연결 준비 API가 반환하는 `ALREADY_LINKED`는 별도 의미로 유지된다.

## 2. Token 계약

| Token | 발급·관리 | 사용처 |
|---|---|---|
| Firebase ID Token | Firebase SDK에서 필요 시 획득·갱신 | `exchange`, `signup`, Guest `prepare/upgrade/merge`, Provider 변경, 탈퇴 proof |
| Firebase Phone Credential | Firebase Phone Auth SDK | 현재 Firebase User의 `linkWithCredential`에만 사용 |
| Identity Access Token | Identity API | `Authorization: Bearer`, Identity 보호 API·Learning Core |
| Identity Refresh Token | Identity API | `/reissue`, `/logout`, `/users/withdraw` |

Firebase ID Token을 Learning Core에 보내지 않는다. Identity Access Token을 Firebase 요청의 `firebaseIdToken`으로 보내지 않는다. Token·OTP·Firebase credential·비밀번호·전화번호는 로그나 analytics에 기록하지 않는다.

`expiresIn`, `accessTokenExpiresIn`, `refreshTokenExpiresIn`은 밀리초이며, `expiresAt`은 UTC ISO-8601이다. `nextPollAfterSeconds`는 초다.

## 3. 최초 호출 분기

| 현재 상태 | 최초 API | 인증 | 성공 분기 |
|---|---|---|---|
| Guest Identity Access Token 없음 | `POST /api/v1/auth/firebase/exchange` | Firebase ID Token body | `AUTHENTICATED` 또는 direct signup `ENROLLMENT_REQUIRED` |
| 기존 Guest Identity Access Token 있음 | `POST /api/v1/auth/firebase/guest/prepare` | Guest Bearer + Firebase ID Token body | Guest `ENROLLMENT_REQUIRED` 또는 `MERGE_REQUIRED` |
| MEMBER가 Provider 추가 연결 | `POST /api/v1/auth/firebase/providers/link/prepare` | MEMBER Bearer + 기존 Provider proof | `PREPARED` 또는 Provider `ALREADY_LINKED` |

Guest Identity Access Token의 존재 여부는 Firebase에 묻지 않는다. 앱이 보안 저장소에서 기존 Identity 세션을 읽어 판단한다. Firebase SDK는 Firebase User와 Firebase ID Token을 관리한다.

## 4. API 카탈로그

| Method | Path | 인증 | 목적 |
|---|---|---|---|
| POST | `/api/v1/auth/firebase/exchange` | 공개 + Firebase ID Token body | 기존 MEMBER 로그인 또는 신규 direct signup 준비 |
| POST | `/api/v1/auth/firebase/signup` | 공개 + Firebase ID Token body | exchange enrollment 기반 신규 MEMBER 가입 |
| POST | `/api/v1/auth/firebase/guest/prepare` | Guest Bearer + Firebase ID Token body | 기존 Guest 가입 재개·병합 판정 |
| POST | `/api/v1/auth/firebase/guest/upgrade` | Guest Bearer + Firebase ID Token body | 같은 canonical userId의 MEMBER 승격 |
| POST | `/api/v1/auth/firebase/guest/merge` | Guest Bearer + 기존 MEMBER Firebase proof | Guest 데이터를 기존 MEMBER로 병합 |
| POST | `/api/v1/auth/firebase/auth-methods/sync` | MEMBER Bearer + Firebase ID Token | 이미 승인된 Provider 목록 검증 |
| POST | `/api/v1/auth/firebase/providers/link/prepare` | MEMBER Bearer + 기존 Provider proof | SNS 연결 준비 |
| POST | `/api/v1/auth/firebase/providers/link/start` | MEMBER Bearer + 기존 Provider proof | 연결 SDK 실행 허가 |
| POST | `/api/v1/auth/firebase/providers/link/complete` | MEMBER Bearer + 대상 Provider proof | 연결 완료 승인 |
| POST | `/api/v1/auth/firebase/providers/link/status` | MEMBER Bearer + Firebase proof | 연결 작업 상태 조회 |
| POST | `/api/v1/auth/firebase/providers/unlink` | MEMBER Bearer + 남는 Provider proof | SNS 해제 작업 접수(202) |
| POST | `/api/v1/auth/firebase/providers/unlink/status` | 남는 Provider Firebase proof | 해제 작업 상태 조회 |
| POST | `/api/v1/auth/reissue` | Refresh Token body | Access·Refresh Token rotation |
| POST | `/api/v1/auth/logout` | Refresh Token body | 현재 기기 로그아웃 |
| POST | `/api/v1/auth/logout-all` | Identity Access Token | 전체 세션 무효화 접수 |
| GET | `/api/v1/users/me` | Identity Access Token | 현재 사용자·`accountType` 조회 |
| GET | `/api/v1/users/me/consents` | Identity Access Token | 정책 version·동의 상태 조회 |
| PUT | `/api/v1/users/me/consents` | Identity Access Token | 필수·선택 동의 저장 |
| GET | `/api/v1/policies/consents` | 공개 | 현재 정책 version 조회 (2026-09-30 추가 예정) |
| POST | `/api/v1/users/withdraw` | Identity Bearer + credential body | Firebase/LOCAL/Guest 탈퇴 |

구버전 참고 API:

- `POST /api/v1/auth/guest`: 신규 앱 호출 금지
- `POST /api/v1/auth/login`, `/signup`, `/check-email`: 신규 SNS UI 범위 밖
- `/api/v1/auth/firebase/providers/relink/prepare`: 폐기 경로, 호출 금지

## 5. 핵심 API 계약

### 5.1 Firebase exchange

요청:

```json
{
  "firebaseIdToken": "<firebase-id-token>"
}
```

기존 MEMBER:

```json
{
  "type": "AUTHENTICATED",
  "accessToken": "<identity-access-token>",
  "refreshToken": "<identity-refresh-token>",
  "grantType": "Bearer",
  "accessTokenExpiresIn": 1800000,
  "refreshTokenExpiresIn": 1209600000
}
```

신규 사용자:

```json
{
  "type": "ENROLLMENT_REQUIRED",
  "enrollmentId": "<uuid>",
  "missingRequirements": ["PHONE_VERIFICATION", "PROFILE", "CONSENTS"],
  "expiresIn": 600000
}
```

`missingRequirements` 가능 값은 `PHONE_VERIFICATION`, `PROFILE`, `CONSENTS`이며 배열 순서는 계약이 아니다. `EMAIL_VERIFICATION`은 SNS 로그인 경로에서 사용하지 않는다(2026-09-30 서버 확인). 신규 가입은 같은 Firebase User에 phone credential을 link한 뒤 `/firebase/signup`을 호출한다.

### 5.2 Firebase signup

`exchange`에서 받은 direct signup enrollment에 사용한다. Guest `prepare`에서 받은 enrollment를 사용하지 않는다.

```json
{
  "enrollmentId": "<exchange-enrollment-id>",
  "firebaseIdToken": "<force-refreshed-firebase-id-token>",
  "nickname": "토스마스터",
  "isPrivacyConsented": true,
  "privacyConsentVersion": "privacy-v1",
  "isTermConsented": true,
  "termConsentVersion": "term-v1",
  "isQualityReviewConsented": false,
  "qualityReviewConsentVersion": "quality-review-v1"
}
```

성공 시 Identity Access/Refresh Token을 발급한다. 닉네임은 2~20자이며 필수 동의는 `true`, version은 서버 정책과 일치해야 한다.

direct signup의 version은 exchange 응답에 없으므로 공개 API `GET /api/v1/policies/consents`로 받는다(2026-09-30 서버 안내, 배포 예정). 예정 응답:

```json
{
  "privacyConsentVersion": "privacy-v1",
  "termConsentVersion": "term-v1",
  "qualityReviewConsentVersion": "quality-review-v1"
}
```

`qualityReviewConsentVersion`은 선택 동의(품질 검토)다. signup과 Guest upgrade body 모두 `isQualityReviewConsented`·`qualityReviewConsentVersion`으로 보낸다(2026-10-01 서버 확인). 동의하지 않아도 생략하지 않고 `false`와 version을 보낸다. version은 두 경로 모두 이 공개 API에서 받는다. `ApiEnvelope` 여부는 배포 후 확인한다.

### 5.3 Guest prepare — TMI-169

요청:

```http
Authorization: Bearer <guest-identity-access-token>
```

```json
{
  "firebaseIdToken": "<fresh-firebase-id-token>"
}
```

`ENROLLMENT_REQUIRED`:

```json
{
  "type": "ENROLLMENT_REQUIRED",
  "enrollmentId": "<guest-enrollment-id>",
  "missingRequirements": ["PHONE_VERIFICATION", "PROFILE"],
  "privacyConsentVersion": "privacy-v1",
  "termConsentVersion": "term-v1",
  "expiresIn": 600000
}
```

`MERGE_REQUIRED`:

```json
{
  "type": "MERGE_REQUIRED"
}
```

변경 규칙:

- Guest `ALREADY_LINKED`는 사용하지 않는다.
- owner가 없으면 활성 enrollment를 재사용하거나 새로 만들어 `ENROLLMENT_REQUIRED`를 반환한다.
- 다른 ACTIVE MEMBER owner면 mutation 없이 `MERGE_REQUIRED`를 반환한다.
- Guest가 identity owner인 불가능한 상태는 `409 IDENTITY_STATE_CONFLICT`다.
- 활성 enrollment 재조회는 TTL을 연장하지 않는다.
- 만료·부재 시 prepare를 다시 호출해 새 ID를 받는다.

### 5.4 Guest upgrade

`prepare`에서 받은 Guest enrollment를 사용한다.

```json
{
  "enrollmentId": "<guest-enrollment-id>",
  "firebaseIdToken": "<force-refreshed-firebase-id-token>",
  "nickname": "토스마스터",
  "isPrivacyConsented": true,
  "privacyConsentVersion": "<latest-prepare-version>",
  "isTermConsented": true,
  "termConsentVersion": "<latest-prepare-version>",
  "isQualityReviewConsented": true,
  "qualityReviewConsentVersion": "<policies-consents-version>"
}
```

전화번호, `userId`, `missingRequirements`를 추가하지 않는다. 서버가 Firebase proof로 phone 상태를 검증한다. 성공하면 canonical userId는 유지되고 기존 Guest RefreshSession은 폐기되며 새 MEMBER Access/Refresh Token을 반환한다. 응답은 signup과 같은 `ApiEnvelope` + 토큰 응답이다(2026-10-01 서버 확인).

필수 약관 version은 prepare 응답, 품질 검토 version은 `GET /api/v1/policies/consents`에서 받는다. 승격 후 옛 Guest Access Token으로 prepare를 호출하면 `403 GUEST_UPGRADE_NOT_ALLOWED`가 온다(2026-10-01 서버 확인). 응답 유실 시 승격 성공 판별에 쓴다.

### 5.5 Guest merge

`MERGE_REQUIRED` 확인 후 호출한다.

```http
Authorization: Bearer <guest-identity-access-token>
```

```json
{
  "firebaseIdToken": "<existing-member-firebase-id-token>"
}
```

성공하면 target MEMBER Access/Refresh Token을 반환한다. 응답은 signup과 같은 `ApiEnvelope` + 토큰 응답이다(2026-10-01 서버 확인).

```json
{
  "isSuccess": true,
  "code": "SUCCESS",
  "message": "요청에 성공했습니다.",
  "result": {
    "accessToken": "<target-member-identity-access-token>",
    "refreshToken": "<target-member-identity-refresh-token>",
    "grantType": "Bearer",
    "accessTokenExpiresIn": 1800000,
    "refreshTokenExpiresIn": 1209600000
  }
}
```

프론트는 이메일·전화번호·닉네임으로 target을 추정하지 않는다. 병합 후 옛 Guest Access Token으로 prepare를 호출하면 `401 ACCOUNT_MERGED_TOKEN_REJECTED`가 온다. 응답 유실 시 병합 성공 판별에 쓴다(2026-10-01 서버 확인).

## 6. 가입 재개와 만료

앱 종료·중단 후 마지막 화면을 로컬 상태만으로 복원하지 않는다.

```text
기존 Guest 세션 유지
→ 같은 Firebase 계정으로 인증
→ guest/prepare 재호출
→ 최신 enrollmentId·missingRequirements·정책 version 사용
```

`expiresIn`이 소진되거나 `FIREBASE_ENROLLMENT_CONFLICT`, `FIREBASE_ENROLLMENT_RESTART_REQUIRED`가 발생하면 같은 enrollment를 반복하지 않는다. 현재 Guest 인증과 fresh Firebase proof로 prepare를 다시 호출한다. 새 Guest 생성이나 direct signup 우회는 하지 않는다.

## 7. 공통 오류 처리 기준

2026-10-01 서버 공유 오류 표. 의미·권장 처리는 서버 문서 문구를 그대로 옮겼다.

| HTTP / code | 의미 | 권장 처리 |
| --- | --- | --- |
| `400 INVALID_REQUEST` | JSON·필드 검증 실패 | `result` 필드 오류를 화면에 연결. 민감값은 표시하지 않음 |
| `401 COMMON_UNAUTHORIZED` | Identity Access Token 누락·만료·검증 실패 | single-flight reissue 한 번 후 원 요청 한 번 재시도 |
| `401 INVALID_FIREBASE_ID_TOKEN` | Firebase Token 누락·만료·검증 실패 | 강제 갱신 한 번, 실패하면 Provider 재로그인 |
| `401 FIREBASE_RECENT_AUTH_REQUIRED` | `auth_time`이 목적별 허용시간 초과 | Provider credential로 명시적 재인증 후 재시도 |
| `403 FIREBASE_ACCOUNT_NOT_ALLOWED` | disabled·삭제됨·불완전 Firebase 계정 | Firebase signOut 후 재인증, 반복 시 지원 안내 |
| `403 FIREBASE_PROVIDER_NOT_ALLOWED` | Provider flag off, 미지원 Provider, phone-only login | 해당 버튼/흐름 중단, 지원 로그인 수단 안내 |
| `403 FIREBASE_EMAIL_VERIFICATION_REQUIRED` | password account email 미인증 | Firebase email 인증 완료 후 재인증·Token 갱신 |
| `403 FIREBASE_PHONE_VERIFICATION_REQUIRED` | signup/upgrade에 same-UID verified phone 없음 | 현재 Firebase User에 phone link 후 Token 강제 갱신 |
| `409 PHONE_ALREADY_LINKED` | 번호가 다른 User/Firebase User 소유 | 자동 merge 금지, 기존 계정 로그인·복구 안내 |
| `409 MERGE_REQUIRED` | Guest upgrade 대상 identity가 기존 MEMBER 소유 | 명시적 확인 후 Guest merge 흐름 |
| `409 FIREBASE_ENROLLMENT_CONFLICT` | attempt 없음·만료·소비·UID 불일치 | enrollment 폐기. Guest 승격은 `/guest/prepare`, direct 가입은 `/exchange`부터 재시작 |
| `409 FIREBASE_ENROLLMENT_RESTART_REQUIRED` | lifecycle상 가입 재시작 필요 | enrollment 폐기. 현재 진입점의 prepare/exchange부터 재시작 |
| `409 IDENTITY_STATE_CONFLICT` | Guest인데 현재 identity owner로 판정된 불가능 상태 | 자동 승격·merge 금지, 재인증 후 반복되면 지원 안내 |
| `409 FIREBASE_IDENTITY_CONFLICT` | Firebase owner 불일치 | 로컬 추정 복구 금지, 재로그인 후 반복 시 지원 |
| `409 SOCIAL_IDENTITY_CONFLICT` | Provider subject owner 불일치 | 자동 연결 금지, 재로그인 후 반복 시 지원 |
| `403 GUEST_UPGRADE_NOT_ALLOWED` | 현재 User가 ACTIVE GUEST가 아님 | 프로필·Token 상태 재조회 후 로그인 초기화 |
| `403 GUEST_MERGE_NOT_ALLOWED` | merge source가 ACTIVE GUEST가 아님 | merge 중단, 현재 계정 재확인 |
| `409 GUEST_MERGE_TARGET_CONFLICT` | target MEMBER를 하나로 확정할 수 없음 | 자동 선택 금지, 처음부터 재인증 또는 지원 |
| `409 GUEST_MERGE_CONFLICT` | merge 동시성 충돌 | Token·프로필 재조회 후 한 번만 재시도 |
| `429 FIREBASE_RATE_LIMITED` | Firebase quota·rate limit | 입력 차단, backoff 후 재시도 |
| `503 FIREBASE_UNAVAILABLE` | Firebase 기능 off 또는 일시 장애 | 계정 없음으로 간주하지 말고 일시 장애 표시 |
| `401 INVALID_REFRESH_TOKEN` | RefreshSession 없음·일반 폐기 | Identity Token 삭제 후 로그인 |
| `401 REFRESH_TOKEN_EXPIRED` | Refresh Token 만료 | Identity Token 삭제 후 로그인 |
| `401 REFRESH_TOKEN_REUSE_DETECTED` | rotation된 Token 재사용 | 모든 로컬 Token 삭제, 보안상 전체 재로그인 안내 |
| `401 ACCOUNT_WITHDRAWN` | 탈퇴로 Session 폐기 또는 User 탈퇴 | terminal signed-out 처리 후 안내 한 번 표시 |
| `401 ACCOUNT_MERGED_TOKEN_REJECTED` | MERGED Guest의 옛 Access Token 사용 | 옛 Guest 상태 삭제 후 target MEMBER 로그인 |
| `403 ACCOUNT_NOT_ACTIVE` | SUSPENDED 등 비활성 User | 재발급 반복 금지, 상태 안내·지원 |
| `409 WITHDRAWAL_CLEANUP_PENDING` | 탈퇴 identity 정리 진행 중 | 가입·로그인 중단 후 나중에 재시도 안내 |
| `400 INVALID_REISSUE_REQUEST_ID` | 재발급 요청 ID 누락/형식 오류 | 구현 점검. 이미 보낸 요청 ID를 새로 바꿔 재시도하지 않음 |
| `409 REISSUE_REQUEST_CONFLICT` | 재발급 요청 ID 재사용 충돌 | 해당 복구 중단, 최신 로컬 인증 상태 확인 |
| `409 REISSUE_RECOVERY_EXPIRED` | 같은 응답의 복구 기한 만료 | 최신 Token이 없다면 SNS 재인증 |
| `409 REISSUE_RESULT_SUPERSEDED` | 이미 교체된 재발급 결과 | 최신 결과 유지, 없으면 재인증 |
| `401 SESSION_LOGGED_OUT` | 세션/epoch/인증 시각 무효화 | 자체 Token 삭제·Firebase signOut·재로그인 |
| `503 SESSION_SECURITY_UNAVAILABLE` | 세션 처리를 확정할 수 없음 | 동일 요청으로 제한 재시도, 성공으로 간주하지 않음 |

`message`가 아니라 안정적인 `code`로 분기한다. 명확한 terminal 오류를 무한 재시도하지 않는다.

## 8. 기존 앱·배포 확인 사항

기존 SecureStore의 Guest 세션을 업데이트 직후 삭제하지 않는다. 서버가 제공하는 최소 지원 버전·강제 업데이트 정책과 실제 적용 시점을 확인한다. 구버전 앱이 신규 Guest 생성을 호출할 수 있으므로, 백엔드 차단 시 구버전 사용자에게 제공할 복구·업데이트 화면을 별도로 합의해야 한다.

출시 전에 다음 값을 환경별로 확정한다.

- backend base URL 및 배포 버전
- TMI-169 Guest prepare 계약 활성화 여부
- Google·Apple·Kakao Firebase Provider 활성화 여부
- Firebase Phone Auth 프로젝트 설정과 SMS 제한
- Guest용 약관 본문·URL과 prepare version의 연결 방식
- 최소 지원 앱 버전·스토어 URL·강제 업데이트 방식
- Guest merge downstream 데이터 이전 검증 완료 여부

## 9. 원본과의 관계

상세 Controller·DTO·Service 설명과 모든 예시·운영 부록은 2026-09-21 백엔드 인계 가이드 및 전달된 `identity-swagger.zip`을 기준으로 한다. 이 파일은 프론트 구현에 필요한 계약을 고정해 기록한 문서이며, 실제 환경의 활성화·종단 테스트 완료를 보증하지 않는다.
