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
pnpm dlx eas-cli@latest config --platform android --profile development --json --non-interactive
pnpm dlx eas-cli@latest config --platform android --profile preview --json --non-interactive
pnpm dlx eas-cli@latest config --platform android --profile production --json --non-interactive
pnpm dlx eas-cli@latest config --platform ios --profile development --json --non-interactive
pnpm dlx eas-cli@latest config --platform ios --profile preview --json --non-interactive
pnpm dlx eas-cli@latest config --platform ios --profile production --json --non-interactive
git diff --check
```

예상 결과:

- 모든 명령이 성공하고 Expo public config가 프로젝트 연결 및 기존 앱 식별자를 유지한다.
- 모든 profile의 `pnpm`은 `11.12.0`이고 `environment`는 profile 이름과 같다.
- development는 development client와 내부 배포, preview는 내부 배포를 사용한다.
- production은 store 배포 기본값, 원격 앱 버전 소스와 자동 증가 정책을 사용한다.
- JSON 출력은 로컬에서 구조만 확인하고 값이 포함된 원문을 PR이나 로그에 첨부하지 않는다.

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

PR 기준 브랜치가 `origin/main`인 경우 다음처럼 저장소 전체 변경을 검사한다. 출력되는 실제 비밀값이 없도록
민감 패턴 검사는 일치한 파일 이름만 표시한다.

```sh
git status --short
git diff --name-status origin/main...HEAD
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
git diff origin/main...HEAD -- package.json pnpm-lock.yaml
git diff --name-only --diff-filter=A origin/main...HEAD
git diff --name-only origin/main...HEAD | rg '(^|/)(google-services\.json|GoogleService-Info\.plist|.*\.(jks|keystore|p8|p12|mobileprovision))$'
git diff --name-only --diff-filter=ACMR -z origin/main...HEAD | xargs -0 rg -l --no-messages \
  -e 'BEGIN ([A-Z ]+)?PRIVATE KEY' \
  -e 'SENTRY_AUTH_TOKEN[[:space:]]*=[[:space:]]*[^[:space:]#]+' \
  -e 'gh[pousr]_[A-Za-z0-9_]{20,}' \
  -e 'AKIA[0-9A-Z]{16}'
```

확인 항목:

- 전체 변경 파일과 신규 파일이 의도한 범위에 속하며 사용자 소유의 무관한 변경은 포함되지 않았다.
- `package.json`과 `pnpm-lock.yaml`에는 검토한 빌드 의존성만 있고 Firebase/Analytics dependency가 없다.
- Firebase 설정, 서명 키, 인증서와 provisioning profile 파일이 추가되지 않았다.
- 민감 패턴 검사에서 출력된 파일은 값을 출력하지 않은 채 직접 확인하고, `SENTRY_AUTH_TOKEN`은 이름과
  설명 또는 빈 placeholder만 있으며 실제 값은 없다.
- 마지막 두 `rg` 검사는 일치 항목이 없으면 아무것도 출력하지 않고 종료 상태 `1`을 반환할 수 있으며,
  수동 감사에서는 이를 "탐지 없음"으로 판정한다. 명령 실행 오류와 혼동하지 않도록 출력도 함께 확인한다.
- Apple/Google credential이나 운영 secret이 없다.

## 6. 원격 후속 작업

저장소 구현 완료 후 `docs/eas-build-handoff.md`에 따라 development/preview/production EAS
Environment, credential과 첫 preview build를 준비한다. 실제 cloud build와 submit은 이 quickstart의
완료 조건이 아니다.
