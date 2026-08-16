# Quickstart: EAS 빌드 준비 검증

## 전제 조건

- Expo/EAS 프로젝트 `d98fc341-a7a1-467f-8d21-00d0c60e4711`에 접근 가능한 계정
- 저장소 의존성 설치 완료
- Firebase SDK와 `google-services.json`/`GoogleService-Info.plist`가 없는 기준선
- 실제 비밀값을 출력하거나 저장소 파일에 기록하지 않을 것

## 1. 원격 프로젝트 연결

```sh
pnpm dlx eas-cli@latest init --id d98fc341-a7a1-467f-8d21-00d0c60e4711
git diff -- app.json
```

예상 결과:

- `extra.eas.projectId`가 명령의 ID와 정확히 같다.
- `owner`가 원격 프로젝트에서 확인한 `to-teacher`와 같다.
- slug가 원격 프로젝트의 `to-teacher-app`과 같고, name, iOS bundle identifier와 Android package가
  의도치 않게 바뀌지 않았다.

## 2. 정적 구성 검사

```sh
pnpm lint
pnpm exec tsc --noEmit
pnpm exec expo config --type public --json
git diff --check
```

예상 결과: 모든 명령이 성공하고 Expo public config가 프로젝트 연결 및 기존 앱 식별자를 유지한다.

## 3. Firebase 없는 양 플랫폼 export

임시 출력 디렉터리를 사용해 iOS와 Android bundle/source map을 만든다.

```sh
pnpm exec expo export --platform ios --source-maps --output-dir /tmp/toteacher-eas-ios
pnpm exec expo export --platform android --source-maps --output-dir /tmp/toteacher-eas-android
```

예상 결과: 양쪽 export가 성공하고 Firebase 모듈 또는 설정 파일을 요구하지 않는다.

## 4. Sentry Debug ID 확인

각 임시 export 디렉터리의 `.map` 파일에 설치된 Sentry 검사 스크립트를 실행한다.

```sh
pnpm exec node node_modules/@sentry/react-native/scripts/has-sourcemap-debugid.js <source-map-path>
```

예상 결과: iOS와 Android source map 모두 비어 있지 않은 `debugId` 또는 `debug_id`를 출력한다.
`SENTRY_AUTH_TOKEN` 값은 이 검사에 필요하지 않으며 출력하지 않는다.

## 5. 범위 및 secret 감사

```sh
git diff -- app.json eas.json metro.config.js .env.local.example docs/eas-build-handoff.md
git status --short
```

확인 항목:

- Firebase/Analytics dependency와 설정 파일이 추가되지 않았다.
- `SENTRY_AUTH_TOKEN`은 이름과 설명만 있고 실제 값은 없다.
- Apple/Google credential이나 운영 secret이 없다.
- 사용자 소유의 무관한 변경은 diff에 포함되지 않는다.

## 6. 원격 후속 작업

저장소 구현 완료 후 `docs/eas-build-handoff.md`에 따라 development/preview/production EAS
Environment, credential과 첫 preview build를 준비한다. 실제 cloud build와 submit은 이 quickstart의
완료 조건이 아니다.
