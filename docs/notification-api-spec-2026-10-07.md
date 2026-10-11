# 알림 API 명세

2026-10-07 · Learning Core develop a77a53f 기준 · TMI-198

> 테스트 서버는 기기 API·제출 추적 ON, 실제 푸시 발송 OFF입니다(마지막 배포 확인 기준). 등록 성공은 푸시 발송·표시 성공을 뜻하지 않습니다.

## 1. 공통

테스트 Base URL: `https://api-test.to-teacher.com`

| 헤더 | 필수 | 값 |
| --- | --- | --- |
| Authorization | 두 API 모두 | Bearer <ACCESS_TOKEN> |
| X-Installation-Secret | 두 API 모두 | 설치 시 생성한 암호학적 난수 32바이트 → padding 없는 base64url 43자 |
| Content-Type | PUT | application/json |

JWT의 sub·account_type으로 사용자를 식별합니다. 기기 API는 MEMBER/GUEST 모두 허용하지만 일일 알림은 MEMBER만 대상입니다. 요청에 userId를 보내지 않습니다.

**installationId와 secret은 설치 단위**로 안전하게 보관하고 계정 전환 때 유지합니다. 재설치 시 둘 다 새로 발급합니다. 토큰·secret은 로그/분석/크래시 리포트에 남기지 마세요.

## 2. 기기 등록·갱신

**PUT /api/v1/notifications/devices**

신규 등록, FCM 토큰 갱신, OS 권한 보고에 같은 API를 사용합니다. Path/Query Parameter 없음.

| Body 필드 | 타입·필수 | 규칙 |
| --- | --- | --- |
| installationId | string · 필수 | 소문자 UUID v4. 같은 설치에서는 유지 |
| platform | string · 필수 | IOS 또는 ANDROID |
| pushToken | string · 필수 | FCM 토큰 20~4096자. 허용 문자: 영문·숫자·_ : . - |
| permission | string · 선택 | AUTHORIZED / DENIED / UNKNOWN. 생략하면 UNKNOWN |
| permissionObservedAt | string · 조건부 필수 | ISO 8601 시각(UTC Z 권장). AUTHORIZED/DENIED일 때 필수. UNKNOWN에서 생략하면 서버 접수 시각 |

Body 최대 8 KiB. 알 수 없는 필드와 잘못된 타입은 거절합니다. 관측 시각이 서버 기준 미래 60초 초과 또는 과거 30일 초과이면 400, 기존 저장 시각보다 오래된 보고이면 409입니다.

### 요청 예시

```
PUT /api/v1/notifications/devices
Authorization: Bearer <ACCESS_TOKEN>
X-Installation-Secret: <INSTALLATION_SECRET>
Content-Type: application/json

{
  "installationId": "550e8400-e29b-41d4-a716-446655440000",
  "platform": "IOS",
  "pushToken": "EXAMPLE_FCM_TOKEN_REPLACE_ME",
  "permission": "AUTHORIZED",
  "permissionObservedAt": "2026-10-07T07:15:00Z"
}
```

예시를 실제 설치 정보·토큰·권한 관측 시각으로 교체하세요. 갱신 때도 필수 필드를 모두 보냅니다. **permission 생략은 기존 값 유지가 아니라 UNKNOWN으로 변경**되어 발송에서 제외됩니다.

### 성공 · HTTP 200

```
{
  "isSuccess": true,
  "code": "COMMON_200",
  "message": "성공입니다."
}
```

result는 null이므로 JSON에서 생략됩니다. userId·토큰·secret은 반환하지 않습니다.

## 3. 기기 등록 해제

**DELETE /api/v1/notifications/devices/{installationId}**

| 항목 | 규칙 |
| --- | --- |
| Path: installationId | 해제할 설치의 소문자 UUID v4 |
| Headers | Authorization + X-Installation-Secret 필수 |
| Body / Query | 없음 |
| 성공 | HTTP 200, PUT과 동일한 COMMON_200 응답 |

```
DELETE /api/v1/notifications/devices/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <ACCESS_TOKEN>
X-Installation-Secret: <INSTALLATION_SECRET>
```

현재 계정 소유와 secret을 확인해 토큰·사용자 연결을 해제합니다. 없는 설치 또는 이미 해제된 설치도 성공합니다. 해제 이력이 남아 있으면 secret 검증은 유지합니다. 다른 활성 계정 소유이거나 secret이 다르면 403입니다.

**로그아웃 전에 DELETE → 새 계정 로그인 후 같은 설치 ID/secret으로 PUT**하세요. 설치 증명이 일치하는 인증된 계정만 연결을 전환할 수 있습니다.

## 4. 오류 코드와 앱 처리

### 알림 API 전용 오류

| HTTP / code | 원인 | 앱 처리 |
| --- | --- | --- |
| 400 / NOTIFICATION_400 | 필수 헤더 누락, 잘못된 JSON·필드·UUID·secret 형식·토큰·권한·시각, Body 크기 초과 | 요청값 수정. 동일한 잘못된 요청 반복 금지 |
| 403 / NOTIFICATION_403 | 기능 OFF, 허용되지 않은 account_type/인증 방식, 접근 차단, DELETE 소유권·secret 불일치 | 로그인 계정·설치 정보 확인. 자동 반복 금지 |
| 409 / NOTIFICATION_409 | PUT secret 불일치, 다른 설치의 동일 토큰, 기존보다 오래된 권한 관측 시각 | 설치/토큰 충돌 확인 또는 OS 상태를 다시 읽어 보고. 설치 ID 임의 변경으로 우회하지 않기 |
| 429 / NOTIFICATION_429 | 사용자당 등록 요청 분당 60회 또는 활성 기기 20개 제한 | 갱신 요청 병합·지연. 기기 수 초과라면 미사용 기기 해제 |
| 503 / NOTIFICATION_503 | DB·트랜잭션 등 서버 처리 실패 또는 처리 결과 불명 | 지연 후 동일 설치 ID/secret으로 재요청 가능. 즉시 무한 재시도 금지 |

전용 오류의 message는 모두 동일합니다. 세부 원인을 구분하는 응답 필드는 없으므로 HTTP status와 code를 기준으로 처리하세요.

```
{
  "isSuccess": false,
  "code": "NOTIFICATION_409",
  "message": "알림 기기 등록 상태를 확인해 주세요."
}
```

### 인증·계정 공통 오류

보안 필터에서 거절되면 NOTIFICATION_* 대신 아래 코드가 반환될 수 있습니다.

| HTTP / code | 의미·처리 |
| --- | --- |
| 401 / COMMON401 | Access Token 누락·만료·유효하지 않음. 기존 인증 갱신/재로그인 흐름 사용 |
| 403 / COMMON403 | 공통 접근 권한 거부 |
| 403 / ACCOUNT_MERGED_TOKEN_REJECTED | 병합된 이전 계정 토큰 사용. 현재 계정으로 인증 갱신 |
| 503 / USER_MERGED_DENY_GATE_UNAVAILABLE | 병합 계정 검증 일시 불가. 지연 후 재시도 |
| 401 / ACCOUNT_WITHDRAWN | 탈퇴 계정 차단. 기존 세션 사용 중단(탈퇴 gate 활성 환경) |
| 503 / WITHDRAWAL_DENY_GATE_UNAVAILABLE | 탈퇴 계정 검증 일시 불가. 지연 후 재시도(탈퇴 gate 활성 환경) |

```
{
  "isSuccess": false,
  "code": "COMMON401",
  "message": "인증이 필요합니다."
}
```

## 5. 수신 푸시 형식

실제 발송 활성화 후 앱이 처리할 notification/data 예시입니다. 기기 API의 HTTP 응답과는 별개입니다.

```
{
  "notification": {
    "title": "오늘의 모의고사",
    "body": "오늘 모의고사로 영어 연습을 이어가 볼까요?"
  },
  "data": {
    "notificationId": "<OPAQUE_SHA256_ID>",
    "type": "DAILY_EXAM_REMINDER",
    "route": "MOCK_EXAM_HOME"
  }
}
```

notificationId는 해석하지 않는 식별자입니다. 클릭 시 현재 로그인 상태를 확인한 뒤 모의고사 홈으로 이동합니다. userId·examId·점수·음성은 포함하지 않습니다.

## 6. 꼭 알아둘 사항

- **권한:** 별도 가입 알림 동의/서버 수신 토글 API는 없습니다. OS 권한을 확인해 PUT으로 보고합니다. iOS authorized만 AUTHORIZED, denied는 DENIED, notDetermined/provisional/ephemeral은 UNKNOWN. Android는 앱 알림과 학습 채널 모두 허용 시 AUTHORIZED, 앱 또는 채널 거부 시 DENIED, 미확인 시 UNKNOWN입니다.
- **동기화:** 로그인 후·FCM 토큰 갱신·앱 foreground 복귀 시 권한을 재확인해 PUT합니다. 권한 보고가 30일보다 오래되면 일일 발송에서 제외하며, 기기 미관측 90일 경과 시 연결을 정리합니다.
- **대상/시각:** KST 21:00~21:15, OS 알림을 허용한 MEMBER의 등록된 모든 적격 기기. 이용권과 무관하며 오늘 시험을 시작하지 않은 회원도 포함합니다. 등록 기기가 없는 회원에게는 보낼 수 없습니다.
- **완료:** 필수 문항의 최초 응시(retryCount=0)를 모두 제출한 날짜가 오늘이면 제외하며 채점 완료는 기다리지 않습니다. 과거 제출일이 불명확한 시험을 가진 회원 등은 안전하게 제외될 수 있습니다.
- **중복/지연:** 사용자·날짜·기기별 최대 1회 전송 시도. 실패·결과 불명이어도 당일 재발송하지 않습니다. TTL은 21:15까지(최대 15분), 최종 표시는 OS가 결정합니다. 기기 API 재요청과 푸시 재발송은 별개입니다.
- **보존:** 완료 시험의 문항별 제출 영수증은 전체 제출 완료 후 72시간 TTL, 발송 이력은 해당 KST 날짜 종료 후 30일 TTL입니다. 미완료 영수증과 시험의 제출 완료 시각은 유지하며 TTL 삭제는 비동기입니다.

범위: 기기 API + 일일 미완료 알림. 알림 목록/읽음 처리/설정 조회 API와 채점 완료 푸시는 이번 구현에 없습니다. 실제 발송은 FCM·탈퇴 연동·하루 전체 추적·모바일 검증 후 별도 활성화합니다.

구현 근거: NotificationController / NotificationStore / NotificationExceptionAdvice / SecurityErrorResponseHandler / BaseResponse / FcmPushGateway. 컨트롤러 테스트 3개 통과. 실제 기기 등록·푸시 수신 E2E는 별도 검증 대상입니다.
