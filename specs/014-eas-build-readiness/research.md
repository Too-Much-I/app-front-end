# Research: EAS 빌드 준비

## 1. 기존 원격 프로젝트 연결

**Decision**: 저장소의 pnpm 정책에 맞춰 다음 명령을 사용한다.

```sh
pnpm dlx eas-cli@latest init --id d98fc341-a7a1-467f-8d21-00d0c60e4711
```

명령 완료 후 `app.json`에 기록된 `extra.eas.projectId`가 요청 ID와 같은지, `owner`가 있다면 EAS CLI가
확인한 계정 값인지 diff로 검증한다.

**Rationale**: `eas init --id`는 이미 생성된 프로젝트를 앱 구성에 연결하는 공식 흐름이며, pnpm 실행은
npm/Yarn lockfile 생성을 방지한다.

**Alternatives considered**: `npx eas-cli@latest`는 동작하지만 저장소 패키지 관리자 정책과 다르다.
`app.json`을 직접 수정하면 owner와 권한 검증을 건너뛰므로 사용하지 않는다.

## 2. 목적별 빌드 프로필

**Decision**: `development`, `preview`, `production` 세 profile을 만든다. development는
development client와 internal distribution, preview는 internal distribution, production은 기본 store
distribution을 사용한다. 각 profile의 `environment`는 profile 이름과 동일하게 고정한다.

**Rationale**: 산출물의 목적·설치 범위·원격 설정을 한눈에 구분하고, 운영 값이 다른 profile에서 조용히
선택되는 것을 방지한다.

**Alternatives considered**: 하나의 profile에서 CLI 인자로 환경을 바꾸는 방식은 호출 실수가 운영
산출물에 직접 반영될 수 있어 기각한다.

## 3. 앱 빌드 버전

**Decision**: `cli.appVersionSource`는 `remote`로 두고 production에 `autoIncrement: true`를 적용한다.

**Rationale**: 로컬 브랜치마다 native build number/versionCode가 갈라지는 것을 막고, 새 스토어 제출이
이전 번호를 재사용하지 않게 한다.

**Alternatives considered**: `local` 버전과 `app.json` 수동 수정은 병렬 작업과 재시도에서 충돌할 수 있다.

## 4. 공개 설정과 비밀 경계

**Decision**: 앱에서 읽는 `EXPO_PUBLIC_*` 값은 공개 정보로 간주해 EAS Environment별로 관리한다.
`SENTRY_AUTH_TOKEN`, Apple/Google credential과 향후 Firebase credential은 `EXPO_PUBLIC_` 접두사를
쓰지 않고 EAS secret 또는 전용 credential 저장소에서만 관리한다. 실제 값은 `eas.json`, 예제 env,
문서에 넣지 않는다.

**Rationale**: Expo public 변수는 앱 번들에 포함되므로 비밀 저장 수단이 아니다. 원격 EAS build는
개발자의 `.env.local`이 있다고 가정할 수 없다.

**Alternatives considered**: profile `env`에 실제 값을 넣으면 환경별 중복과 비밀 커밋 위험이 생긴다.

## 5. Sentry source map과 NativeWind 합성

**Decision**: `metro.config.js`의 기반을 `getDefaultConfig(__dirname)`에서
`getSentryExpoConfig(__dirname)`로 바꾸고, 그 결과에 기존 `withNativeWind` 설정을 적용한다.

**Rationale**: 설치된 Sentry 도구는 source map의 `debugId`/`debug_id`를 사용한다. 공식 Expo Metro
구성이 안정된 식별자를 생성하고, NativeWind를 외부 wrapper로 유지하면 기존 CSS 입력과 `inlineRem:
false` 동작을 보존할 수 있다.

**Alternatives considered**: 기본 Metro를 유지한 채 upload script만 실행하면 source map의 Debug ID를
보장하지 못한다. wrapper 순서를 반대로 바꾸면 NativeWind가 만든 최종 config를 Sentry가 보존하는지
불명확해 기존 형태를 Sentry 기반 config 위에 그대로 적용한다.

## 6. Firebase 전 기준선

**Decision**: Firebase SDK와 설정 파일을 추가하지 않은 채 lint, typecheck, Expo config, iOS/Android
export와 Debug ID를 확인한다. 원격 preview build는 환경과 credential이 준비된 뒤 후속 단계로 남긴다.

**Rationale**: EAS/Sentry 구성과 Firebase native 설정 실패를 분리해 첫 실패의 원인을 좁힐 수 있다.

**Alternatives considered**: Firebase와 EAS를 한 번에 연결하면 native build 실패 시 어느 설정이 원인인지
구분하기 어렵다.

## Resolution

계획에 남은 `NEEDS CLARIFICATION`은 없다. iOS 암호화 수출 규정은 제품·법적 확인이 필요하므로 결정하지
않고 명시적으로 범위 밖에 유지한다.
