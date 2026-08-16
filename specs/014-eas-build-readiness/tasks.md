# Tasks: EAS 빌드 준비

**Input**: Design documents from `/specs/014-eas-build-readiness/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Validation**: 테스트 러너가 없는 구성 변경이므로 lint, typecheck, Expo public config, 양 플랫폼의
development/preview/production EAS config, 양 플랫폼 export, source map Debug ID와 저장소 전체
secret/diff 감사를 수행한다.

**Organization**: 태스크는 각 사용자 스토리가 독립적으로 검토 가능하도록 구성한다.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 저장소와 이미 생성된 Expo/EAS 프로젝트를 안전하게 연결한다.

- [x] T001 `pnpm dlx eas-cli@latest init --id d98fc341-a7a1-467f-8d21-00d0c60e4711`로 프로젝트를 연결하고 `app.json` diff를 검사한다
- [x] T002 `app.json`에서 project ID, 원격 slug와 CLI가 확인한 owner를 검증하고 기존 name, iOS bundle identifier, Android package가 유지되는지 확인한다

**Checkpoint**: 저장소가 정확한 원격 프로젝트 하나에 연결되어 있다.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 구현 중 생성될 비밀과 산출물이 추적되지 않도록 기존 저장소 경계를 확인한다.

- [x] T003 `.gitignore`가 `.env*`, 로컬 Expo/EAS 산출물과 플랫폼 credential 파일을 적절히 제외하는지 검토하고 필요한 최소 패턴만 보완한다

**Checkpoint**: 모든 사용자 스토리 구현 전에 비밀·임시 산출물 보호 경계가 준비되어 있다.

---

## Phase 3: User Story 1 - 목적별 빌드를 재현한다 (Priority: P1) 🎯 MVP

**Goal**: 개발, 내부 preview와 스토어 production 빌드가 서로 다른 profile 및 같은 이름의 원격
environment를 사용한다.

**Independent Test**: `eas.json`을 스키마로 해석했을 때 세 profile, 배포 범위, remote version source와
production auto increment가 모두 존재하고 앱 식별자가 유지된다.

- [x] T004 [US1] development, preview, production profile과 environment, remote version, production auto increment, submit 계약을 `eas.json`에 추가한다
- [x] T005 [US1] `eas.json` 및 `app.json`을 Expo/EAS 구성 명령으로 해석하고 양 플랫폼의 development, preview, production profile별 `pnpm`, environment, 배포 범위, 버전 정책과 기존 앱 식별자를 검증한다

**Checkpoint**: Firebase 없이도 세 빌드 목적을 저장소 설정만 보고 구분할 수 있다.

---

## Phase 4: User Story 2 - 운영 설정과 비밀을 분리한다 (Priority: P1)

**Goal**: 공개 앱 설정의 변수명은 재현 가능하게 제공하되 실제 비밀과 플랫폼 credential은 저장소 밖에
남긴다.

**Independent Test**: 예제 env와 인수인계 문서에 필요한 이름·위치·책임이 있고 실제 token, credential,
production secret 값은 없다.

- [x] T006 [P] [US2] EAS Environment에서 사용할 공개 변수와 `SENTRY_AUTH_TOKEN`의 비밀 경계를 `.env.local.example`에 명확히 설명한다
- [x] T007 [P] [US2] 프로젝트 접근, 세 EAS Environment, Apple/Google credential과 첫 preview/production 빌드 순서를 `docs/eas-build-handoff.md`에 작성한다
- [x] T008 [US2] 저장소 전체 변경 파일·신규 파일·dependency·lockfile을 값 비노출 방식으로 감사해 Firebase 설정·의존성, 실제 비밀과 production-to-staging fallback 계약 위반이 없는지 확인한다

**Checkpoint**: 계정 소유자가 값 자체를 문서에 남기지 않고 원격 후속 작업을 완료할 수 있다.

---

## Phase 5: User Story 3 - Firebase 전 빌드 기준선을 확정한다 (Priority: P2)

**Goal**: Firebase가 없는 앱에서 기존 NativeWind와 양 플랫폼 bundle을 유지하면서 Sentry Debug ID를
생성한다.

**Independent Test**: iOS/Android Expo export가 성공하고 각 source map에 비어 있지 않은 `debugId` 또는
`debug_id`가 있으며 Firebase 의존성과 설정 파일은 없다.

- [x] T009 [US3] Sentry Expo Metro config를 기반으로 기존 NativeWind 설정을 합성하도록 `metro.config.js`를 변경한다
- [x] T010 [US3] Firebase 없는 상태에서 iOS와 Android source map export를 생성하고 Sentry Debug ID를 검사한다

**Checkpoint**: EAS/Sentry 기준선이 Firebase native 설정과 분리되어 양 플랫폼에서 검증된다.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 전체 요구사항과 diff를 최종 검증한다.

- [x] T011 `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec expo config --type public --json`, `git diff --check`를 실행한다
- [x] T012 `specs/014-eas-build-readiness/spec.md`, `specs/014-eas-build-readiness/plan.md`, `specs/014-eas-build-readiness/tasks.md`와 최종 diff를 대조하고 Firebase·Analytics·secret·무관한 사용자 변경이 포함되지 않았는지 검토한다

---

## Dependencies & Execution Order

- Phase 1 프로젝트 연결은 이후 모든 EAS 구성 검증의 선행 조건이다.
- Phase 2 보호 경계 확인 후 User Story 1과 User Story 2를 진행한다.
- User Story 3의 source map export는 User Story 1의 EAS config와 독립적이지만 최종 기준선에서는 둘 다
  통과해야 한다.
- T006과 T007은 서로 다른 파일을 수정하므로 병렬 수행할 수 있다.
- Phase 6은 모든 사용자 스토리 완료 후 수행한다.

## Parallel Example: User Story 2

```text
Task T006: `.env.local.example`의 공개/비밀 변수 경계 설명
Task T007: `docs/eas-build-handoff.md`의 원격 후속 작업 체크리스트
```

## Implementation Strategy

1. 프로젝트 연결을 완료하고 diff가 예상된 project ID만 포함하는지 확인한다.
2. MVP로 `eas.json`의 세 profile과 version 계약을 추가해 목적별 빌드를 구분한다.
3. 변수·credential 경계와 원격 작업을 문서화한다.
4. Sentry/NativeWind Metro 합성을 적용하고 Firebase 없는 양 플랫폼 export를 검증한다.
5. 정적 검사, secret 감사와 전체 artifact 대조를 통과시킨다.

## Notes

- 실제 EAS cloud build, submit, credential 생성과 Firebase 설정은 수행하지 않는다.
- 실제 secret은 어떤 저장소 파일이나 명령 출력에도 기록하지 않는다.
- commit과 push는 별도 사용자 요청 전 수행하지 않는다.
