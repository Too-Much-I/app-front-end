# Firebase·SNS 인증 API 변경사항과 공유 방식 제안

기준 문서: 2026-09-21 「프론트엔드 Firebase·SNS 로그인 및 회원 전환 연동 가이드」

이 문서는 기존 Guest 전환 계약의 변경점과, 현재처럼 Swagger 없이 Notion으로 API를 공유할 때 필요한 문서 구조를 정리한다. 실제 배포 환경의 활성화 여부와 Firebase 설정 완료 여부는 별도로 확인해야 한다.

## 1. 이번 변경의 핵심

`exchange`와 Guest 전용 `prepare`의 역할은 분리되어 유지된다.

| 사용자 상태 | 최초 호출 | 목적 |
|---|---|---|
| Guest Identity Access Token이 있음 | `POST /api/v1/auth/firebase/guest/prepare` | 기존 Guest의 회원 전환 재개 |
| Guest 토큰이 없음 | `POST /api/v1/auth/firebase/exchange` | Firebase 계정을 Identity 회원과 교환 |
| Guest 토큰이 없음·기존 MEMBER | `exchange` | MEMBER Token 발급 |
| Guest 토큰이 없음·신규 사용자 | `exchange` | 신규 가입용 enrollment 발급 |

`prepare`는 일반 SNS 계정 조회 API가 아니다. 기존 Guest 토큰과 Firebase ID Token을 함께 검증해 Guest 승격 또는 병합을 준비한다.

## 2. Guest prepare 변경 전후

### 변경 전

기존 Guest가 SNS로 전환을 시도하면 `prepare`가 다음 중 하나를 반환했다.

- `ENROLLMENT_REQUIRED`
- `ALREADY_LINKED`
- `MERGE_REQUIRED`

`ALREADY_LINKED`는 이름과 달리 MEMBER Token이나 `enrollmentId`를 주지 않았다. SNS 연결은 확인됐지만 Guest가 계속 Guest로 남을 수 있어 프론트가 다음 행동을 결정할 근거가 부족했다.

### 변경 후

Guest 전용 `ALREADY_LINKED`는 제거한다. 성공 결과는 다음 두 가지다.

- `ENROLLMENT_REQUIRED`: Guest 가입을 계속할 수 있음
- `MERGE_REQUIRED`: 기존 MEMBER로 병합 확인이 필요함

현재 Guest가 identity owner로 판정되는 불가능한 상태는 성공으로 처리하지 않고 `409 IDENTITY_STATE_CONFLICT`를 반환한다.

## 3. 변경 후 Guest 흐름

```text
기존 Guest Access Token 유지
→ Firebase Provider 로그인
→ POST /api/v1/auth/firebase/guest/prepare
→ 결과 분기
```

### ENROLLMENT_REQUIRED

`prepare`는 현재 유효한 가입 재개 정보를 반환한다.

```json
{
  "type": "ENROLLMENT_REQUIRED",
  "enrollmentId": "<uuid>",
  "missingRequirements": ["PHONE_VERIFICATION", "PROFILE"],
  "privacyConsentVersion": "privacy-v1",
  "termConsentVersion": "term-v1",
  "expiresIn": 600000
}
```

`missingRequirements`는 화면 번호가 아니라 현재 충족해야 할 요건의 집합이다.

가능한 값:

- `PHONE_VERIFICATION`
- `PROFILE`
- `CONSENTS`

프론트는 이 목록을 보고 필요한 UI만 보여준다. 전화번호를 Firebase User에 link하거나 닉네임·동의를 입력한 뒤, 같은 Firebase User에서 강제 갱신한 ID Token으로 `/guest/upgrade`를 호출한다.

`/guest/upgrade`에는 다음 값이 필요하다.

```json
{
  "enrollmentId": "<prepare-response-enrollmentId>",
  "firebaseIdToken": "<force-refreshed-firebase-id-token>",
  "nickname": "토스마스터",
  "isPrivacyConsented": true,
  "privacyConsentVersion": "<prepare-response-version>",
  "isTermConsented": true,
  "termConsentVersion": "<prepare-response-version>"
}
```

전화번호, `userId`, `missingRequirements`를 upgrade 요청에 임의로 추가하지 않는다. 서버가 Firebase proof로 phone 상태를 다시 확인한다.

### MERGE_REQUIRED

현재 Guest의 Firebase SNS가 다른 ACTIVE MEMBER에 속한다는 뜻이다.

```text
사용자에게 Guest 데이터가 기존 MEMBER로 이동된다는 사실을 확인
→ POST /api/v1/auth/firebase/guest/merge
→ target MEMBER Token으로 교체
```

`MERGE_REQUIRED` 응답에는 `enrollmentId`가 없다. 프론트가 이메일·전화번호·닉네임으로 병합 대상을 추정하지 않는다.

### 만료와 앱 재실행

`expiresIn`은 밀리초이며 기본값은 10분이다. 재조회가 만료 시간을 연장하지는 않는다.

앱이 종료되거나 가입을 중단한 뒤에는 마지막 화면을 로컬 상태만으로 복원하지 않는다.

```text
Guest 세션 복구
→ 같은 Firebase 계정으로 인증
→ /guest/prepare 재호출
→ 새 enrollmentId·요건·정책 버전 사용
```

`FIREBASE_ENROLLMENT_CONFLICT` 또는 `FIREBASE_ENROLLMENT_RESTART_REQUIRED`가 발생하면 기존 ID로 반복하지 않고 `prepare`를 다시 호출한다. 새 Guest를 만들거나 direct `/firebase/signup`으로 우회하지 않는다.

## 4. 프론트 분기 기준

프론트는 다음 세 가지를 혼동하지 않아야 한다.

1. `exchange`의 `ENROLLMENT_REQUIRED`: Guest가 없는 신규 Firebase 사용자의 direct signup
2. `guest/prepare`의 `ENROLLMENT_REQUIRED`: 기존 Guest의 upgrade 재개
3. `providers/link/prepare`의 `ALREADY_LINKED`: 이미 승인된 MEMBER SNS 연결의 멱등 상태

이 세 응답은 이름이 비슷해도 서로 다른 enrollment와 lifecycle을 사용한다. Guest 전환용 enrollment를 direct signup API에 제출하지 않는다.

## 5. 현재 Notion 중심 공유 방식의 문제

현재 문서는 정책, 구현 설명, 요청·응답 예시, 운영 상태, 미검증 설정, QA 지침이 한 문서에 섞여 있다. 이 구조에서는 다음 오류가 생기기 쉽다.

- `exchange`와 `guest/prepare`의 최초 호출 조건을 혼동함
- `ALREADY_LINKED`가 어느 prepare를 가리키는지 모호함
- 응답 필드가 필수인지 선택인지 알기 어려움
- HTTP status와 application `code`의 처리 기준이 섞임
- 문서에 적힌 코드가 실제 배포 환경에 활성화됐는지 알 수 없음
- Notion 수정만으로 요청·응답 타입이 자동 검증되지 않음

## 6. Swagger가 없을 때 권장하는 공유 구조

당장 Swagger를 도입하지 못하더라도 Notion을 다음 네 문서로 분리하는 것이 좋다.

### A. Flow 문서

제품·QA·프론트가 읽는 문서다. 사용자 상태별 최초 호출 API와 다음 API만 설명한다.

```text
Guest 있음 → guest/prepare → upgrade 또는 merge
Guest 없음 → exchange → authenticated 또는 signup
```

### B. Endpoint 계약 문서

API 하나당 고정된 템플릿을 사용한다.

```md
## POST /api/v1/auth/firebase/guest/prepare

상태: STAGING 활성 / PROD 미확인
인증: Guest Identity Bearer 필수
멱등성: 없음

### Request
### Success: ENROLLMENT_REQUIRED
### Success: MERGE_REQUIRED
### Errors
### Retry / response-loss policy
### Changelog
```

각 필드는 `필수 여부`, `타입`, `단위`, `예시`, `민감정보 여부`를 함께 표기한다.

### C. Error catalog

오류는 API 본문에 흩어 쓰지 말고 별도 표로 관리한다.

| HTTP | code | 의미 | 재시도 | 프론트 동작 |
|---|---|---|---|---|
| 409 | `FIREBASE_ENROLLMENT_CONFLICT` | enrollment 만료·소비·불일치 | 같은 ID 재시도 금지 | 현재 진입점의 prepare/exchange 재시작 |
| 409 | `IDENTITY_STATE_CONFLICT` | Guest 소유권 상태 모순 | 자동 반복 금지 | 재인증 후 반복, 지속 시 지원 |
| 409 | `MERGE_REQUIRED` | 기존 MEMBER와 통합 필요 | 자동 반복 금지 | 사용자 확인 후 merge |

### D. Release matrix

API 계약과 배포 상태를 분리한다.

| 환경 | backend 버전 | base URL | prepare 계약 | Firebase Provider | 담당자 | 확인일 |
|---|---|---|---|---|---|---|
| STAGING | `TMI-169` | `<url>` | ON | Google ON | `<name>` | `<date>` |
| PROD | 미정 | `<url>` | 미확인 | 미확인 | `<name>` | `<date>` |

문서에 Controller가 존재한다는 사실만으로 해당 환경의 기능이 켜졌다고 표시하지 않는다.

## 7. OpenAPI 도입 권장안

장기적으로는 백엔드가 OpenAPI YAML을 정본으로 관리하고, Notion은 사용자 흐름과 운영 설명만 담당하는 구성이 좋다.

```text
OpenAPI YAML
├─ request/response schema
├─ enum
├─ HTTP status
└─ 인증 방식

Notion
├─ 사용자 흐름
├─ 오류를 화면에서 어떻게 처리하는지
├─ 배포 feature flag
└─ QA 시나리오
```

OpenAPI를 도입하면 다음을 자동화할 수 있다.

- 모바일용 TypeScript 타입 생성
- 요청·응답 예시 검증
- 필수 필드 누락 검출
- enum 변경 감지
- staging API와 문서의 차이 검사

도입 순서는 `exchange`, `guest/prepare`, `guest/upgrade`, `guest/merge` 네 API부터 시작하는 것이 적절하다. 이 네 API가 현재 회원가입과 Guest 전환의 핵심 상태 전이를 정의하기 때문이다.

## 8. 백엔드에 요청할 최소 산출물

다음 자료를 받아야 프론트가 구현을 확정할 수 있다.

1. 위 네 API의 OpenAPI 또는 동일한 구조의 계약표
2. `prepare`의 인증 조건과 Guest 토큰 필수 여부
3. `missingRequirements` 전체 enum과 각 요건의 충족 방법
4. `enrollmentId` 생성·재사용·만료·폐기 규칙
5. 응답 유실 시 재시도 가능 여부와 멱등성 정책
6. 환경별 backend 버전·base URL·feature flag
7. Firebase Phone Auth의 SMS 재발송 제한과 실제 테스트 환경
8. `MERGE_REQUIRED` 이후 downstream 데이터 이전 완료 시점

특히 다음 표는 백엔드가 직접 채워야 한다.

| 현재 상태 | 최초 API | 인증 | 성공 type | 후속 API |
|---|---|---|---|---|
| Guest 있음 | `?` | `?` | `?` | `?` |
| Guest 없음·기존 MEMBER | `?` | `?` | `?` | `?` |
| Guest 없음·신규 사용자 | `?` | `?` | `?` | `?` |
| Guest와 기존 MEMBER 통합 | `?` | `?` | `?` | `?` |

현재 2026-09-21 가이드 기준으로는 각각 `guest/prepare`, `exchange`, `exchange`, `guest/prepare` 후 `guest/merge`로 채울 수 있다.
