# Firebase·SNS 로그인 흐름과 Token 경계

기준 문서: 2026-09-21 Firebase·SNS 로그인 및 회원 전환 연동 가이드

이 문서는 화면 흐름을 이해하기 위한 그림이다. 실제 서버 활성화 여부와 Firebase Provider 설정은 배포 환경에서 별도로 확인한다.

## Token 종류

| 이름 | 발급 주체 | 보내는 곳 | 화면에서의 역할 |
|---|---|---|---|
| Firebase ID Token | Firebase Auth SDK | `exchange`, `signup`, `guest/prepare`, `guest/upgrade`, `guest/merge` 등의 요청 증명 | 현재 Firebase User가 누구인지 증명 |
| Firebase Phone Credential | Firebase Phone Auth SDK | 현재 Firebase User의 `linkWithCredential` | 전화번호 가입 proof. 서버 API에 직접 보내지 않음 |
| Identity Access Token | Identity API | `Authorization: Bearer ...`로 보호 API와 Learning Core | 우리 서비스의 현재 사용자 권한 증명 |
| Identity Refresh Token | Identity API | `reissue`, `logout`, `withdraw` | 새 Identity Token 발급·세션 종료. 일반 API에는 보내지 않음 |

Firebase ID Token과 Identity Access Token은 서로 바꿔 사용할 수 없다. Firebase ID Token을 Learning Core에 보내지 않고, Identity Access Token을 Firebase 교환 API의 `firebaseIdToken`으로 보내지 않는다.

## 화면 진입 분기

분기 전에 앱이 SecureStore에서 **Identity 세션**을 읽는다. 이 값은 Firebase가 발급한 값이 아니다.

- Guest Access Token 있음: 이전에 같은 설치에서 Guest로 사용한 서버 세션이 있음
- Guest Access Token 없음: 서버 Guest 세션을 복구하지 못했거나 처음 SNS 로그인하는 상태

그 다음 Firebase SDK로 Google·Apple·Kakao 로그인을 수행해 Firebase ID Token을 받는다. Firebase SDK에 “Guest Identity Token이 있는가?”를 묻는 API는 없다.

```mermaid
flowchart TD
    A[로그인 화면] --> B[SecureStore에서 Identity 세션 읽기]
    B --> C{Guest Access Token이 있는가?}
    C --> D[Google·Apple·Kakao Firebase 로그인]

    D --> E{Firebase 로그인 성공\nFirebase ID Token 획득}

    E -->|Guest Token 없음| F[exchange\nBody: Firebase ID Token]
    E -->|Guest Token 있음| G[guest/prepare\nHeader: Guest Access Token\nBody: Firebase ID Token]

    F --> H{exchange result.type}
    H -->|AUTHENTICATED| I[기존 MEMBER\nAccess·Refresh Token 저장]
    H -->|ENROLLMENT_REQUIRED| J[신규 회원가입 화면]

    G --> K{prepare result.type}
    K -->|ENROLLMENT_REQUIRED| L[Guest 회원가입 재개 화면]
    K -->|MERGE_REQUIRED| M[계정 통합 확인 화면]
    K -->|IDENTITY_STATE_CONFLICT| N[재인증·지원 안내]

    I --> O[홈 화면]
    J --> P[프로필·약관 화면]
    L --> P
    M --> Q[Guest 데이터가 기존 MEMBER로 이동됨을 확인]
    Q --> R[Guest merge]
    R --> O
```

## A. Guest 세션이 없는 신규·기존 SNS 사용자

```mermaid
sequenceDiagram
    actor User as 사용자
    participant UI as 로그인/가입 UI
    participant Firebase as Firebase Auth
    participant Identity as Identity API
    participant Core as Learning Core

    UI->>UI: SecureStore에서 Identity 세션 확인\nGuest Access Token 없음
    User->>UI: Google·Apple·Kakao 선택
    UI->>Firebase: Provider 로그인
    Firebase-->>UI: Firebase ID Token
    UI->>Identity: POST /firebase/exchange\nRequest: firebaseIdToken

    alt result.type = AUTHENTICATED
        Identity-->>UI: AUTHENTICATED\naccessToken + refreshToken + expiresIn
        UI->>UI: 두 Token을 SecureStore에 함께 저장
        UI->>Core: Authorization: Bearer Identity Access Token
        UI-->>User: 홈 진입
    else result.type = ENROLLMENT_REQUIRED
        Identity-->>UI: ENROLLMENT_REQUIRED\nenrollmentId + missingRequirements + expiresIn
        UI-->>User: 프로필·약관·전화번호 인증 화면
        UI->>Firebase: 현재 Firebase User에 Phone Credential link
        Firebase-->>UI: 같은 UID의 Firebase ID Token 강제 갱신
        UI->>Identity: POST /firebase/signup\nBody: Firebase ID Token + enrollmentId + nickname + consents
        Identity-->>UI: accessToken + refreshToken + expiresIn
        UI->>UI: 두 Token을 함께 저장
        UI-->>User: 홈 진입
    end
```

이 흐름에서는 Guest Access Token을 보내지 않는다. `exchange`에서 받은 enrollment는 direct `/firebase/signup`에만 사용한다.

## B. 기존 Guest를 새 MEMBER로 승격

```mermaid
sequenceDiagram
    actor User as 사용자
    participant UI as 로그인/가입 UI
    participant Firebase as Firebase Auth
    participant Identity as Identity API
    participant Core as Learning Core

    UI->>UI: SecureStore에서 Guest Identity Access Token 읽기
    User->>UI: 기존 Guest 상태에서 SNS 로그인 선택
    UI->>Firebase: Provider 로그인
    Firebase-->>UI: Firebase ID Token
    UI->>Identity: POST /firebase/guest/prepare\nHeader: Guest Access Token\nBody: Firebase ID Token
    Identity-->>UI: ENROLLMENT_REQUIRED\nenrollmentId + missingRequirements + policy versions + expiresIn

    UI-->>User: missingRequirements에 필요한 화면 표시
    UI->>Firebase: 같은 Firebase User에 Phone Credential link
    Firebase-->>UI: 같은 UID의 fresh Firebase ID Token
    UI->>Identity: POST /firebase/guest/upgrade\nHeader: Guest Access Token\nBody: fresh Firebase ID Token + enrollmentId + profile/consents
    Identity-->>UI: 새 MEMBER accessToken + refreshToken + expiresIn
    UI->>UI: Guest Token을 새 MEMBER Token으로 모두 교체
    UI->>Core: Authorization: Bearer MEMBER Access Token
    UI-->>User: 홈 진입
```

`prepare` 응답의 `missingRequirements`는 서버가 저장한 화면 번호가 아니다. 현재 충족해야 하는 요건의 집합이며, `enrollmentId`는 `/guest/upgrade`에 그대로 보낸다.

## C. Guest와 기존 MEMBER를 통합

```mermaid
sequenceDiagram
    actor User as 사용자
    participant UI as 통합 확인 UI
    participant Firebase as Firebase Auth
    participant Identity as Identity API

    UI->>Firebase: Guest가 로그인한 Firebase User 확인
    Firebase-->>UI: Guest 측 Firebase ID Token
    UI->>Identity: POST /firebase/guest/prepare\nHeader: Guest Access Token\nBody: Guest Firebase ID Token
    Identity-->>UI: MERGE_REQUIRED
    UI-->>User: Guest 학습 기록이 기존 MEMBER로 이동됨을 안내
    User->>UI: 통합 동의
    UI->>Firebase: 기존 MEMBER 계정으로 fresh Provider 인증
    Firebase-->>UI: 기존 MEMBER Firebase ID Token
    UI->>Identity: POST /firebase/guest/merge\nHeader: Guest Access Token\nBody: 기존 MEMBER Firebase ID Token
    Identity-->>UI: target MEMBER accessToken + refreshToken + expiresIn
    UI->>UI: Guest Token 삭제·target MEMBER Token 저장
    UI-->>User: MEMBER 화면 진입
```

`MERGE_REQUIRED`에는 `enrollmentId`가 없다. 프론트가 이메일·전화번호·닉네임으로 대상 MEMBER를 추정하지 않는다.

## 앱 재실행·가입 재개

```mermaid
flowchart LR
    A[앱 재실행] --> B{보안 저장소에 Identity Refresh Token이 있는가?}
    B -->|없음| C[Firebase SNS 로그인 화면]
    B -->|있음| D[POST /auth/reissue\nRefresh Token body]
    D --> E{계정 상태}
    E -->|GUEST| F[Firebase SNS 로그인]
    F --> G[POST /firebase/guest/prepare\nGuest Access + fresh Firebase ID Token]
    G --> H[최신 enrollmentId·요건 사용]
    E -->|MEMBER| I[MEMBER 화면 진입]
    H --> J[필요한 가입 단계만 재개]
```

`enrollmentId`가 만료됐거나 `FIREBASE_ENROLLMENT_CONFLICT`가 발생하면 기존 ID로 반복하지 않는다. 현재 Guest Token과 fresh Firebase proof로 `prepare`를 다시 호출한다.

## 보호 API 요청 규칙

```text
Firebase 로그인·가입 증명
  Firebase ID Token → Identity의 Firebase endpoint body

우리 서비스 사용자 권한
  Identity Access Token → Authorization: Bearer header

세션 재발급·로그아웃·탈퇴
  Identity Refresh Token → 해당 endpoint의 body
```

Refresh Token은 일반 API나 Learning Core에 보내지 않는다. Firebase ID Token도 장기 세션 Token처럼 직접 저장하지 않고 Firebase SDK에서 필요할 때 다시 받는다.
