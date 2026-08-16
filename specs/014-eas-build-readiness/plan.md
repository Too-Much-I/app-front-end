# Implementation Plan: EAS 빌드 준비

**Branch**: `chore/eas-build-config` | **Date**: 2026-08-15 | **Spec**: [spec.md](./spec.md)

**Approval**: Draft plans MUST be approved before tasks or implementation begin.

**Input**: Feature specification from `/specs/014-eas-build-readiness/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Firebase를 추가하기 전에 Expo/EAS 프로젝트 연결과 개발·미리보기·배포 빌드 계약을 확정한다.
`pnpm dlx eas-cli@latest init`으로 이미 생성된 프로젝트를 연결하고, `eas.json`은 프로필별 동일 이름의
EAS Environment와 원격 버전 관리를 사용한다. Metro의 기본 구성은 Sentry Debug ID를 생성하는 구성으로
교체한 뒤 NativeWind 변환을 마지막에 합성한다. 공개 환경변수 이름과 저장소 밖 비밀·자격증명의 경계는
문서화하며 Firebase SDK, 설정 파일, Analytics와 실제 클라우드 빌드는 포함하지 않는다.

## Technical Context

**Language/Version**: TypeScript 6.0, JavaScript(CommonJS 설정 파일), JSON

**Primary Dependencies**: Expo SDK 57, React Native 0.86, EAS CLI latest(일회성 pnpm 실행),
`@sentry/react-native` 7.11, NativeWind 4.2

**Storage**: N/A — 저장소 설정 파일과 Expo 원격 프로젝트 메타데이터만 사용

**Testing**: `pnpm lint`, `pnpm exec tsc --noEmit`, Expo public config 검사, 양 플랫폼 Expo export와
source map Debug ID 검사, diff/secret 감사

**Target Platform**: Expo/EAS의 iOS 및 Android 앱 빌드

**Project Type**: Expo managed React Native 모바일 앱

**Performance Goals**: 런타임 성능 변화 없음; 구성 검사와 로컬 export가 결정적으로 재현될 것

**Constraints**: pnpm만 사용, 앱 식별자 유지, 비밀 저장·번들 포함 금지, Firebase 추가 금지,
NativeWind Metro 변환 유지, 법적 확인 전 암호화 선언 금지

**Scale/Scope**: EAS 프로젝트 1개, 빌드 프로필/환경 3개, iOS·Android 2개 플랫폼

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] The specification is approved and separates facts, assumptions, scope, out-of-scope behavior, and open questions.
- [x] Acceptance criteria describe observable behavior and include failure or interruption paths.
- [x] The design uses Expo/React Native APIs and preserves strict TypeScript and existing architectural boundaries.
- [x] Existing shared UI, theme, navigation, API, mapper, and domain layers are reused where applicable.
- [x] At least two viable approaches were considered, or the plan explains why only one approach is practical.
- [x] The validation plan includes `pnpm lint`, `pnpm exec tsc --noEmit`, and relevant manual or device checks.
- [x] No secret or unapproved Jira write, commit, push, dependency addition, or other external side effect is required.

## Current Flow

1. `app.json`에 앱 이름, `com.toteacher.app` iOS/Android 식별자와 Sentry Expo plugin은 있지만
   `owner` 및 `extra.eas.projectId`는 없어 원격 EAS 프로젝트와 연결되지 않았다.
2. `eas.json`이 없어 개발 클라이언트, 내부 preview, 스토어 production의 배포·환경·버전 정책이 없다.
3. 앱 공개 설정은 로컬 `.env.local`에서 `process.env.EXPO_PUBLIC_*`로 번들에 주입된다. 서비스 API
   주소가 없으면 `src/lib/api/service-base-url.ts`가 명시적으로 실패하며 staging으로 대체하지 않는다.
4. Sentry 런타임 보고는 공개 플래그로 제어하고 업로드 토큰은 빌드 타임 비밀이다. 현재 Metro는
   `getDefaultConfig()`에 NativeWind만 합성하므로 Sentry source map Debug ID 구성은 빠져 있다.
5. Firebase 의존성·설정 파일은 아직 없으며, Firebase 추가 전의 빌드 기준선을 따로 검증할 수 있다.

## Design Options

### Option A - EAS 원격 환경과 공식 Sentry Metro 구성

EAS 프로젝트 연결 결과를 `app.json`에 보존하고, `eas.json`의 세 프로필이 같은 이름의 원격 EAS
Environment를 명시하게 한다. 앱 버전 소스는 remote, production은 `autoIncrement`를 사용한다.
Metro는 Sentry가 제공하는 Expo config를 기반으로 NativeWind를 합성한다. 비밀은 EAS 원격 secret으로만
관리한다. Expo/EAS와 Sentry의 표준 경로라 유지보수와 원인 분리가 쉽지만, 첫 원격 빌드 전에 콘솔 또는
CLI에서 환경과 credential을 준비해야 한다.

### Option B - 프로필 내부 env와 기본 Metro 구성 유지

`eas.json` 각 프로필에 값을 직접 중복하고 현재 Metro 구성을 유지한다. 초기 파일 수는 적지만 공개 운영
주소가 저장소에 고정되고 환경별 값이 어긋나기 쉬우며, 비밀을 잘못 넣을 위험이 있다. 또한 Sentry Debug
ID와 source map 업로드 경로가 보장되지 않아 배포 오류를 원본 위치로 복원한다는 요구를 충족하지 못한다.

## Decision

Option A를 선택한다. EAS Environment를 구성의 단일 원천으로 두고 profile 이름과 1:1로 연결하면
development/preview/production 혼입을 방지할 수 있다. `appVersionSource: remote`와 production
`autoIncrement: true`는 스토어 빌드 번호 재사용을 막는다. Sentry 공식 Metro config는 Debug ID 생성과
업로드 도구의 계약을 유지하며, 그 결과를 NativeWind로 감싸 기존 CSS 변환도 유지한다. Option B는 환경
중복과 source map 누락 때문에 기각한다.

## Failure and Recovery Paths

- EAS CLI 로그인 또는 프로젝트 권한이 없으면 연결 명령을 중단하고 `app.json` diff를 원복한다. 프로젝트
  ID나 `owner`를 추측해 수동 입력하지 않고, 올바른 계정으로 다시 로그인한 뒤 같은 명령을 재시도한다.
- 연결 뒤 예상 ID와 다른 값이 기록되면 구현을 중단하고 diff와 원격 프로젝트를 대조한다.
- 원격 환경변수가 없으면 cloud build를 실행하지 않는다. 특히 production이 development/preview 값을
  대신 쓰게 하지 않고 필수 변수 목록을 채운 뒤 재검증한다.
- `SENTRY_AUTH_TOKEN`이 없으면 업로드 검증은 실패 원인을 보고하되 값 자체를 로그에 출력하지 않는다.
  source map 생성과 Debug ID 존재 여부는 토큰 없이도 로컬 export로 별도 확인한다.
- Sentry Metro 합성 후 NativeWind 또는 export가 깨지면 `metro.config.js` 변경만 되돌려 기존 기준선과
  비교한다. 앱 런타임 코드나 Firebase를 함께 바꾸지 않아 원인을 분리한다.
- 일부 플랫폼 export만 성공하면 성공한 결과로 전체 완료를 선언하지 않고 실패 플랫폼을 수정해 둘 다
  통과시킨다.

## Developer Explain-Back

- [x] The affected files and their responsibilities can be explained.
- [x] The changed data and state transitions can be described in order.
- [x] The selected tradeoffs and rejected alternatives can be explained.
- [x] The validation and rollback approach can be explained.

## Project Structure

### Documentation (this feature)

```text
specs/014-eas-build-readiness/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
```text
app.json                          # Expo 앱 및 원격 EAS 프로젝트 연결 메타데이터
eas.json                          # profile, environment, distribution, version/submit 계약
metro.config.js                   # Sentry Debug ID와 NativeWind Metro 구성 합성
.env.local.example                # 로컬 공개 변수 이름과 비밀 변수 경계 예시
docs/
└── eas-build-handoff.md          # 원격 환경·credential·첫 빌드 인수인계
specs/014-eas-build-readiness/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/eas-build-contract.md
```

**Structure Decision**: 런타임 기능이나 새 계층을 추가하지 않고 Expo/EAS가 읽는 루트 설정과 운영
인수인계 문서만 변경한다. 기존 앱 API 및 화면 코드는 현재의 production 누락 실패 동작을 유지한다.

## Complexity Tracking

해당 없음. Constitution gate 위반 없이 구현 가능하다.
