# Tasks: Guest 인증 부트스트랩

**Input**: Design documents from `/specs/009-guest-auth-bootstrap/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Validation**: 자동 테스트 러너가 없으므로 각 사용자 스토리의 수동 검증과 최종 `pnpm lint`,
`pnpm exec tsc --noEmit`, iOS/Android 개발 빌드 검증을 포함한다.

**Organization**: 공통 기반을 먼저 만들고, 최초 Guest 진입·재실행 복구·사용 중 Rotation·안전한
오류 복구 순서로 사용자 스토리를 독립 검토 가능한 단계로 구현한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 선행 작업 완료 후 다른 파일에서 병렬로 진행 가능
- **[Story]**: `spec.md`의 사용자 스토리와 연결
- 모든 작업은 변경 또는 검증할 정확한 파일 경로를 포함

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Expo SDK 57 호환 보안 저장소와 서비스별 환경 설정 준비

- [x] T001 `pnpm exec expo install expo-secure-store expo-crypto`로 SDK 호환 의존성을 `package.json`과 `pnpm-lock.yaml`에 추가
- [x] T002 [P] Android SecureStore backup 제외 plugin을 `app.json`에 설정하고 Identity/Learning Core URL 예시와 legacy fallback을 `.env.local.example`에 추가

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 인증 사용자 스토리가 공유하는 타입, 전송, 저장 경계 구현

**⚠️ CRITICAL**: 이 단계가 끝나기 전에는 사용자 스토리 구현을 시작하지 않는다.

- [x] T003 성공/실패 Envelope와 구조화된 `ApiError` 타입 및 안전한 오류 payload를 `src/types/api.ts`에 정의
- [x] T004 [P] Identity/Learning Core/legacy base URL 선택과 누락 구성 오류 처리를 `src/lib/api/service-base-url.ts`에 구현
- [x] T005 HTTP timeout·caller abort·JSON/Envelope 검증과 HTTP 2xx `isSuccess=false` 오류 변환을 `src/lib/api/transport.ts`에 구현
- [x] T006 [P] Raw Token pair 검증, 절대 만료 시각 변환, `AuthSession`, bootstrap state, retry descriptor, request snapshot 타입을 `src/features/auth/types.ts`에 구현
- [x] T007 [P] 단일 JSON AuthSession 읽기·검증·교체를 `src/features/auth/auth-session-storage.ts`에 구현
- [x] T008 [P] UUIDv4 검증, SecureStore 읽기/생성/저장, pending UUID single-flight를 `src/features/auth/installation-id.ts`에 구현
- [x] T009 legacy 통합 동의의 v2 migration과 privacy/term 독립 버전 읽기·쓰기·검증을 `src/features/consent/consent-storage.ts`에 구현

**Checkpoint**: 공개 Identity API와 인증 컨트롤러가 사용할 안전한 공통 경계가 준비됨

---

## Phase 3: User Story 1 - 최초 동의 후 Guest로 시작 (Priority: P1) 🎯 MVP

**Goal**: 새 설치 사용자가 두 필수 동의를 완료하고 같은 설치 식별자로 Guest 세션을 안전하게
저장한 뒤에만 보호 화면에 진입한다.

**Independent Test**: 저장 데이터가 없는 앱에서 동의 항목을 각각 선택하고 Guest 요청·세션 저장이
완료되기 전에는 MainTabs가 보이지 않으며, 완료 후 한 번만 홈에 진입하는지 확인한다.

### Implementation for User Story 1

- [x] T010 [P] [US1] 공개 `POST /api/v1/auth/guest` 요청과 raw Token pair 매핑을 `src/features/auth/api/create-guest.ts`에 구현
- [x] T011 [US1] `CHECKING_LOCAL`·`CONSENT_REQUIRED`·`GUEST_RECOVERING`·`AUTHENTICATED` 전이와 동의→installationId→Guest→세션 저장→메모리 commit 순서를 `src/features/auth/auth-controller.ts`에 구현
- [x] T012 [US1] controller 구독, 단일 bootstrap 시작, `acceptConsent()` event를 제공하는 React 경계를 `src/features/auth/auth-provider.tsx`에 구현
- [x] T013 [P] [US1] 인증 상태별 public/protected screen set과 관련 route 타입을 `src/navigation/RootNavigator.tsx`와 `src/navigation/types.ts`에 반영
- [x] T014 [US1] 폰트와 auth bootstrap gate를 조합하고 저장 완료 전 splash를 유지하도록 `App.tsx`를 변경
- [x] T015 [US1] 직접 저장·`navigation.reset()`을 제거하고 controller 동의 event, `시작하는 중...` busy/disabled 접근성 상태, 진행·실패 중 화면과 checkbox 선택 보존을 `src/screens/consent/ConsentScreen.tsx`에 연결
- [x] T016 [P] [US1] privacy/term 독립 동의 일시 표시를 `src/screens/settings/SettingsScreen.tsx`에 반영
- [ ] T017 [US1] fresh install, 한 항목 미선택, 제출 중 Consent 화면·선택·busy 상태 유지, 중복 제출 차단, consent/installation/session write 실패, legacy migration 시나리오를 `specs/009-guest-auth-bootstrap/quickstart.md` 3~5절에 따라 수동 검증하고 결과 기록

**Checkpoint**: 최초 설치 Guest 진입이 독립적으로 동작하고 세션 저장 전 보호 route가 존재하지 않음

---

## Phase 4: User Story 2 - 재실행 시 기존 Guest 세션 복구 (Priority: P1)

**Goal**: 유효한 동의와 저장 세션이 있는 재방문 사용자가 Reissue로 같은 Guest 세션을 교체하고,
확정 무효일 때만 same-install Guest로 복구한다.

**Independent Test**: 저장된 Refresh Token으로 앱을 재실행해 한 번 Reissue하고, 확정적인 401과
불확실한 timeout/5xx가 각각 Guest 복구와 재시도 오류로 분기되는지 확인한다.

### Implementation for User Story 2

- [x] T018 [P] [US2] 공개 `POST /api/v1/auth/reissue` 요청과 definitive invalid code 분류를 `src/features/auth/api/reissue-tokens.ts`에 구현
- [x] T019 [US2] cold start `REISSUING`, 저장 세션 Rotation, 확정 무효 same-install Guest fallback, 불확실 실패 보존을 `src/features/auth/auth-controller.ts`에 구현
- [x] T020 [US2] 앱 재실행의 `REISSUING`/`GUEST_RECOVERING` 동안 splash를 유지하고 완료 후 보호 navigator를 렌더링하도록 `src/features/auth/auth-provider.tsx`와 `App.tsx`를 통합
- [ ] T021 [US2] cold restart, definitive invalid/expired/reused, timeout/5xx, 5초 부트스트랩 목표를 `specs/009-guest-auth-bootstrap/quickstart.md` 6~7절에 따라 수동 검증하고 결과 기록

**Checkpoint**: 재실행이 새 Guest를 추측하지 않고 기존 설치 계보로 안전하게 복구됨

---

## Phase 5: User Story 3 - 사용 중 만료를 방해 없이 복구 (Priority: P1)

**Goal**: 동시 또는 늦은 GET 401에서도 Reissue를 한 번만 수행하고 안전한 조회만 최신 세션으로
최대 한 번 재시도하며 쓰기 요청은 자동 재전송하지 않는다.

**Independent Test**: 두 GET이 같은 generation의 Token을 사용하게 한 뒤 동시 401과 늦은 401을
각각 반환해 Identity Reissue call count가 한 번인지 확인하고, POST 401은 재전송되지 않는지 확인한다.

### Implementation for User Story 3

- [x] T022 [US3] 메모리 AuthSession commit 시 단조 증가 generation, 요청 snapshot, 60초 사전 만료, shared Reissue Promise를 `src/features/auth/auth-controller.ts`에 구현
- [x] T023 [US3] 매 attempt 최신 Authorization 구성, GET 전용 generation 비교·401 최대 1회 replay,
  쓰기 요청과 403/5xx/network non-retry를 `src/lib/api/client.ts`에 구현
- [x] T024 [US3] caller abort가 해당 요청의 대기/retry만 중단하고 shared Reissue와 세션 commit은 계속되도록 `src/lib/api/client.ts`와 `src/features/auth/auth-controller.ts`의 취소 경계를 연결
- [x] T025 [US3] 기존 시험 GET만 명시적 auth retry client를 사용하고 POST는 단일 attempt로 유지하며
  S3 PUT 비인증 경계를 `src/features/exam/api/*.ts`와 `src/features/exam/upload-answer-audio.ts`에서 검토
- [ ] T026 [US3] proactive expiry, GET 첫/두 번째 401, POST 401 non-replay, 403, GET 동시/late 401,
  caller abort 시나리오를 `specs/009-guest-auth-bootstrap/quickstart.md` 8~9절에 따라 수동 검증하고 결과 기록

**Checkpoint**: 동일 프로세스의 Refresh Rotation 경합과 늦은 과거 Token 응답이 중복 Rotation을 만들지 않음

---

## Phase 6: User Story 4 - 인증 실패 시 안전하게 머무르기 (Priority: P2)

**Goal**: 읽기·Guest·Reissue·저장 실패가 보호 화면을 노출하지 않고 정확히 중단된 작업부터 재시도된다.

**Independent Test**: 각 저장/네트워크 실패를 주입해 recovery 화면이 표시되고 재시도 중복 실행 없이
실패 작업 다음 상태로 이어지는지 확인한다.

### Implementation for User Story 4

- [x] T027 [US4] `read-local`·`persist-consent`·`persist-installation`·`guest`·`reissue`·`persist-session` descriptor별 재시도와 pending 민감정보 비노출을 `src/features/auth/auth-controller.ts`에 구현
- [x] T028 [P] [US4] 안전한 오류 설명, busy/disabled 접근성 상태, responsive width와 safe area를 갖춘 `src/screens/auth/AuthRecoveryScreen.tsx`를 구현
- [x] T029 [US4] `RETRYABLE_ERROR`일 때 recovery route만 선언하고 보호 route를 제거하도록 `src/navigation/RootNavigator.tsx`와 `src/navigation/types.ts`를 연결
- [x] T030 [US4] Provider cleanup의 controller 구독 해제와 bootstrap 실행 generation guard, 이미 시작한 Rotation commit 보존을 `src/features/auth/auth-provider.tsx`와 `src/features/auth/auth-controller.ts`에 구현
- [ ] T031 [US4] 저장소·Guest·Reissue·Envelope·background/unmount·phone/tablet·screen reader 실패 시나리오를 `specs/009-guest-auth-bootstrap/quickstart.md` 4, 10~11절에 따라 수동 검증하고 결과 기록

**Checkpoint**: 모든 부트스트랩 실패가 보호 화면을 차단하고 원래 작업을 안전하게 재시도함

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 이전 동의 gate 제거, 문서·환경·보안·회귀 검토와 정적 검증

- [x] T032 더 이상 사용하지 않는 `src/features/consent/use-consent-gate.ts`를 제거하고 import 잔존 여부를 전체 `src/`에서 확인
- [x] T033 [P] Identity/Learning URL fallback, SecureStore 플랫폼 수명 차이, 수동 검증 방법의 최종 구현 일치를 `.env.local.example`, `specs/009-guest-auth-bootstrap/quickstart.md`, 관련 코드 주석에서 검토
- [x] T034 Token·Refresh Token·installationId·backend rejectedValue가 console, 오류 문구, navigation params에 노출되지 않는지 `src/` 전체를 보안 검토
- [x] T035 `pnpm lint`를 실행하고 결과와 변경 범위 관련 실패를 기록
- [x] T036 `pnpm exec tsc --noEmit`을 실행하고 strict TypeScript 결과를 기록
- [ ] T037 iOS와 Android 개발 빌드에서 `specs/009-guest-auth-bootstrap/quickstart.md` 11~12절의 플랫폼 저장소 및 기존 시험 흐름 회귀를 검증
- [x] T038 최종 diff를 `specs/009-guest-auth-bootstrap/spec.md`, `plan.md`, `contracts/`, `tasks.md`와 대조하고 범위 밖 Notifications/WebView 인증/로그아웃/시험 제출 계약 변경이 없는지 확인

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 즉시 시작 가능
- **Foundational (Phase 2)**: Setup 완료 후 진행하며 모든 사용자 스토리를 차단
- **US1 (Phase 3)**: Foundational 완료 후 진행하는 최초 사용자 MVP
- **US2 (Phase 4)**: US1의 controller·Provider·Guest 복구 경계에 의존
- **US3 (Phase 5)**: US2의 Reissue와 단일 세션 commit 경계에 의존
- **US4 (Phase 6)**: US1~US3의 실패 operation을 하나의 recovery UI로 연결
- **Polish (Phase 7)**: 구현 대상으로 승인된 모든 사용자 스토리 완료 후 진행

### User Story Dependencies

- **US1 (P1)**: 새 설치 Guest 발급과 보호 navigation gate의 최소 독립 흐름
- **US2 (P1)**: US1의 installation identity, 세션 저장, Guest endpoint를 재사용
- **US3 (P1)**: US2의 Reissue 작업에 generation과 single-flight 동시성 정책을 추가
- **US4 (P2)**: 앞선 스토리에서 발생하는 실패를 보존하고 UI로 노출

### Within Each User Story

- raw endpoint와 mapper를 controller orchestration보다 먼저 구현
- SecureStore write가 성공한 뒤에만 메모리 session과 generation을 commit
- controller state가 정해진 뒤 React Provider와 navigation을 연결
- 각 스토리의 수동 검증을 완료한 뒤 다음 스토리로 이동

### Parallel Opportunities

- T002는 T001과 다른 파일에서 병렬 진행 가능
- T004, T006, T007, T008은 각 파일 경계를 유지하며 병렬 구현 가능
- T010, T013, T016은 US1 controller 통합 전에 병렬 구현 가능
- T018은 US1 완료 뒤 US2 controller 변경과 분리해 먼저 구현 가능
- T028은 retry descriptor 계약이 정해진 뒤 controller 변경과 다른 파일에서 병렬 구현 가능
- T033은 core 구현 완료 뒤 보안 검토 T034와 병렬 진행 가능

---

## Parallel Example: User Story 1

```text
Task T010: 공개 Guest endpoint 구현
Task T013: 인증 상태별 navigator와 route 타입 준비
Task T016: 독립 동의 일시 표시 변경
```

## Parallel Example: Foundational

```text
Task T004: 서비스별 base URL 결정
Task T006: 인증 raw/domain/bootstrap 타입 정의
Task T007: AuthSession SecureStore adapter 구현
Task T008: installationId SecureStore adapter 구현
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup 완료
2. Phase 2 Foundational 완료
3. Phase 3 US1 완료
4. fresh install과 저장 실패 시나리오 검증
5. 사용자 검토 후 재실행·Rotation·recovery 단계 진행

### Incremental Delivery

1. Setup + Foundational → 안전한 저장과 전송 기반
2. US1 → 최초 동의와 Guest 홈 진입
3. US2 → 재실행 세션 복구
4. US3 → 사용 중 만료와 동시 요청 경합 복구
5. US4 → 실패 원작업 보존과 recovery UI
6. Polish → 플랫폼·보안·시험 흐름 회귀 검증

## Notes

- 자동 테스트 러너가 없어 테스트 파일 대신 quickstart 기반 fault injection/device evidence를 남긴다.
- generation은 TanStack Query cache가 아니라 controller 메모리에 있고 AuthSession commit 때만 증가한다.
- `apiFetch`와 GET 전용 `apiFetchWithAuthRetry`는 Learning Core 요청에만 인증을 적용하며 Identity와
  S3 요청은 이 경계를 타지 않는다.
- push와 Jira 변경은 별도 명시적 요청 전에는 수행하지 않는다. commit은 2026-08-05 사용자 요청으로
  작업 단위별 수행을 승인받았다.

---

## Phase 8: User Story 2 Revision - 서버 동의 상태 확인과 기존 사용자 갱신 (Priority: P1)

**Goal**: 기존 사용자는 Reissue 세션을 먼저 안전하게 저장한 뒤 서버 동의 상태를 확인하고,
`requiresConsent=true`인 항목만 Guest 생성과 분리된 Bearer API로 갱신한다. 최초 사용자는
installationId를 동의 화면보다 먼저 확보한다.

**Independent Test**: 저장 세션과 과거 로컬 동의를 준비해 앱을 재실행하고 Reissue → session
write/commit → consent GET 순서를 확인한다. privacy만 재동의가 필요한 응답에서 privacy만 선택한
뒤 consent PUT으로 갱신되며 Guest call count가 늘지 않는지 확인한다.

- [x] T039 [US2] ServerConsentStatus, UpdateConsentsRequest, consent-aware bootstrap state와 retry continuation 타입을 `src/features/auth/types.ts`에 구현
- [x] T040 [P] [US2] Bearer `GET /api/v1/users/me/consents` raw 검증과 mapper를 `src/features/auth/api/get-consent-status.ts`에 구현
- [x] T041 [P] [US2] Bearer `PUT /api/v1/users/me/consents` endpoint를 `src/features/auth/api/update-consents.ts`에 구현
- [x] T042 [US2] Session 우선 startup, Consent 화면 전 installationId 저장, Reissue 저장·commit 뒤 consent GET 흐름을 `src/features/auth/auth-controller.ts`에 구현
- [x] T043 [US2] 변경 항목만 PUT, PUT 성공 뒤 로컬 record 갱신, GET/PUT/persist continuation retry와 retry 중복 방지를 `src/features/auth/auth-controller.ts`에 구현
- [x] T044 [US2] 신규/기존 required item, 기존 항목 선택 보존과 `동의 반영 중...` 상태를 `src/screens/consent/ConsentScreen.tsx`, `src/navigation/RootNavigator.tsx`에 연결
- [x] T045 [US2] 서버 동의 상태 계약과 Reissue→GET→PUT 수동 검증 절차를 `specs/009-guest-auth-bootstrap/contracts/`, `data-model.md`, `research.md`, `quickstart.md`에 반영
- [x] T046 개정 구현에 `pnpm lint`와 `pnpm exec tsc --noEmit`을 실행하고 결과를 기록
- [ ] T047 Android emulator에서 fresh install installationId 선저장과 기존 사용자 consent bootstrap 화면 전이를 검증하고 결과를 기록 — consent API 서버 배포 전이라 사용자 요청으로 보류

**Checkpoint**: 로컬 버전은 서버 동의 판정을 앞서지 않고, 기존 사용자 재동의가 Guest API를
호출하거나 PUT 성공 전에 로컬 최신 동의를 남기지 않음

---

## Phase 9: PR Review Follow-up

**Purpose**: 승인된 CodeRabbit 지적만 반영해 자동 재전송 범위와 인증 복구 화면을 안전하게 제한

- [x] T048 [US3] 기본 `apiFetch`를 단일 attempt로 바꾸고 GET 전용 401 재시도 함수를 추가한 뒤
  기존 시험 GET/POST 호출부를 `src/features/exam/api/*.ts`에서 분리
- [x] T049 [US2] consent GET 재시도의 `source`를 보존하고 Identity/Learning base URL의 HTTPS
  검증을 `src/features/auth/auth-controller.ts`와 `src/lib/api/service-base-url.ts`에 구현
- [x] T050 승인된 GET retry/write non-replay, HTTPS, memory commit, 설치된 dependency 상태를
  `specs/009-guest-auth-bootstrap/`의 명세·계획·계약·검증 문서에 동기화
- [x] T051 `pnpm lint`, `pnpm exec tsc --noEmit`과 최종 diff 검토로 후속 수정 범위를 검증
