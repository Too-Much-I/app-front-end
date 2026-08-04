# 알림 화면 mock 데이터 상태

## 현재 동작

`NotificationsScreen`은 UI만 구현되어 있다. `src/screens/notifications/mocks/mock-notifications.ts`의 하드코딩된 목록을 화면 로컬 상태로만 다루며, 실제 백엔드 API 조회나 푸시 알림(Expo Notifications 등) 발송/수신 연동은 없다. 읽음 처리, 필터, 읽은 알림 삭제는 모두 로컬 state에서만 동작하고 서버에 반영되지 않는다.

## 결정

MVP에서는 알림 기능 자체를 지원하지 않는다. `NotificationsScreen`과 `Notifications` 라우트는 코드에 남겨두되, 홈 화면 헤더의 진입 아이콘(벨)은 제거해 사용자가 접근할 수 없게 한다. 실제 알림 데이터 연동, 푸시 발송, 헤더 진입 아이콘 복원은 이후 업데이트에서 함께 진행한다.

## 연동 시 확인할 사항

- 홈 화면 헤더에 벨 아이콘을 복원하고 `Notifications` 라우트로 다시 연결한다.
- 목록 조회 API로 `MOCK_NOTIFICATIONS`를 대체하고, 읽음 처리/삭제를 서버에 반영하도록 변경한다.
- 실기기 푸시 수신을 위해 Expo push token 발급, 권한 요청, `app.json`의 Android 패키지/알림 설정을 확인한다.
- 안 읽은 알림 여부를 벨 아이콘에 뱃지로 표시할지 정한다.
