# EAS 빌드 인수인계

이 문서는 저장소 설정을 완료한 뒤 Expo/EAS 계정에서 해야 할 작업을 구분한다. 실제 토큰, 인증서,
keystore 또는 운영 URL 값은 이 문서와 저장소에 기록하지 않는다.

## 현재 저장소에서 완료되는 항목

- Expo/EAS project ID: `d98fc341-a7a1-467f-8d21-00d0c60e4711`
- Expo project owner: `to-teacher`
- Expo project slug: `to-teacher-app`
- iOS bundle identifier: `com.toteacher.app`
- Android package: `com.toteacher.app`
- `development`, `preview`, `production` build profile과 같은 이름의 EAS Environment 연결
- native build version의 원격 관리 및 production build number 자동 증가
- Sentry Debug ID를 생성하는 Metro 구성과 기존 NativeWind 변환 결합

`app.json`에는 확인된 project ID만 기록한다. `owner`는 로그인 계정이 원격 프로젝트를 확인하기 전에는
추측해서 추가하지 않는다.

## 1. 프로젝트 접근 확인

Expo 프로젝트에 접근 가능한 계정으로 로컬 터미널에서 로그인하고 연결 상태를 확인한다.

```sh
pnpm dlx eas-cli@latest login
pnpm dlx eas-cli@latest init --id d98fc341-a7a1-467f-8d21-00d0c60e4711
pnpm dlx eas-cli@latest project:info
```

확인할 내용:

- 원격 project ID가 `app.json` 값과 같다.
- 프로젝트 소유 조직 또는 계정이 의도한 Expo 계정이다.
- slug가 원격 프로젝트의 `to-teacher-app`과 같고, `name`, iOS bundle identifier, Android package가
  의도치 않게 바뀌지 않았다.

## 2. EAS Environment 준비

Expo 프로젝트의 Environment variables 화면에 `development`, `preview`, `production` 세 환경을
준비한다. 실제 값은 배포 대상의 백엔드·웹 주소가 확정된 뒤 해당 환경에 직접 입력한다.

| 변수 | 공개 여부 | development | preview | production |
|---|---|---|---|---|
| `EXPO_PUBLIC_IDENTITY_API_BASE_URL` | 앱 번들에 포함 | 개발/스테이징 주소 | 내부 검증 주소 | 확정된 운영 HTTPS 주소 |
| `EXPO_PUBLIC_LEARNING_API_BASE_URL` | 앱 번들에 포함 | 개발/스테이징 주소 | 내부 검증 주소 | 확정된 운영 HTTPS 주소 |
| `EXPO_PUBLIC_WEB_BASE_URL` | 앱 번들에 포함 | 개발 웹 주소 | 내부 검증 웹 주소 | 확정된 운영 HTTPS 주소 |
| `EXPO_PUBLIC_ENABLE_CLARITY` | 앱 번들에 포함 | 제품 정책에 따른 boolean | 제품 정책에 따른 boolean | 동의·수집 정책 확정값 |
| `EXPO_PUBLIC_ENABLE_SENTRY` | 앱 번들에 포함 | 필요 시 `false` | 검증 정책에 따른 boolean | 일반적으로 `true` |
| `SENTRY_AUTH_TOKEN` | 빌드 전용 secret | 필요 시 | source map 업로드 시 | source map 업로드 시 |

`EXPO_PUBLIC_*`는 누구나 앱 번들에서 읽을 수 있으므로 secret으로 사용하지 않는다. production 주소가
준비되지 않았으면 development/preview 값을 복사하지 않고 production build를 보류한다.

`SENTRY_AUTH_TOKEN`은 `EXPO_PUBLIC_` 접두사를 붙이지 않고 secret visibility로 저장한다. 토큰 원문을
빌드 로그, 이슈, PR 또는 문서에 붙여 넣지 않는다.

## 3. 플랫폼 자격증명 준비

### iOS

- 유료 Apple Developer Program 계정과 App Store Connect 접근 권한이 필요하다.
- distribution certificate와 provisioning profile은 첫 iOS EAS build에서 EAS가 생성·관리하도록 할 수
  있다.
- App Store Connect의 앱 레코드는 bundle ID `com.toteacher.app`과 일치해야 한다.
- 암호화 수출 규정 선언은 앱 동작과 법적 기준을 확인한 뒤 결정한다. 현재 저장소에서는 임의로 선언하지
  않는다.

### Android

- keystore는 Android 앱의 동일한 서명 주체를 증명하며 이후 업데이트에도 같은 키가 필요하다.
- 첫 Android EAS build에서 EAS가 keystore를 생성·관리하도록 할 수 있다.
- Google Play App Signing을 사용하더라도 업로드 키 관리가 필요하다.
- keystore 파일과 암호를 저장소에 복사하거나 커밋하지 않는다.

## 4. 첫 빌드 순서

Firebase를 추가하기 전에 아래 순서로 기준선을 확인한다.

1. 세 EAS Environment의 필수 공개 설정을 채운다.
2. `preview` 환경에 필요한 Sentry secret과 플랫폼 credential을 준비한다.
3. `pnpm dlx eas-cli@latest build --profile preview --platform android`로 Android 내부 빌드를 먼저 확인한다.
4. Apple 계정과 기기 배포 조건이 준비되면
   `pnpm dlx eas-cli@latest build --profile preview --platform ios`를 확인한다.
5. preview 설치, API 연결과 Sentry symbolication을 확인한다.
6. 운영 URL·수집 정책·스토어 메타데이터가 확정된 뒤 production build를 실행한다.
7. Firebase 프로젝트와 Analytics는 이 기준선이 통과된 다음 별도 변경으로 추가한다.

실제 cloud build와 submit은 비용, credential 생성과 외부 상태 변경을 수반하므로 별도 확인 후 실행한다.
