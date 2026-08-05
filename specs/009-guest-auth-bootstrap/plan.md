# Implementation Plan: Guest 인증 부트스트랩

**Branch**: `feat/#TMI-68` (feature ID: `009-guest-auth-bootstrap`) | **Date**: 2026-08-05 | **Spec**: [spec.md](./spec.md)

**Approval**: 기존 구현 계획은 2026-08-05 승인됨. 서버 동의 조회·갱신을 포함한 이번 개정 계획은
같은 날 사용자 요청 "어 진행해줘"로 task 생성과 구현 진행을 승인받았다.

**Input**: `specs/009-guest-auth-bootstrap/spec.md`

## Summary

두 필수 동의를 독립된 버전으로 보관하고, 설치 단위 UUID를 이용해 최초 Guest 발급과 같은
Guest 복구를 수행한다. 기존 사용자는 Refresh Token Rotation 결과를 먼저 저장·메모리 반영한
뒤 인증된 서버 동의 상태를 조회한다. 서버가 `requiresConsent`로 지정한 항목만 다시 동의받고,
Guest API가 아닌 사용자 동의 갱신 API로 반영한 뒤 로컬 보조 기록을 갱신한다. 앱 최상단 인증
상태 머신은 이 과정이 끝날 때까지 보호 화면 진입을 차단한다. Learning Core 전송 계층의
single-flight와 Token 세대 비교 정책은 유지한다.

## Technical Context

**Language/Version**: TypeScript `~6.0.3` strict mode, React `19.2.3`, React Native `0.86.0`

**Primary Dependencies**: Expo `~57.0.7`, React Navigation 7, AsyncStorage 2.2.0,
설치된 `expo-secure-store ~57.0.1` 및 `expo-crypto ~57.0.1`

**Storage**: AsyncStorage(비밀이 아닌 동의 기록), Expo SecureStore(installationId와 인증 세션을
서로 다른 key로 저장), 메모리(auth state와 Token generation)

**Testing**: 자동 테스트 러너 없음. `pnpm lint`, `pnpm exec tsc --noEmit`, iOS/Android 개발
빌드에서 정상·실패·중단·동시성 시나리오 수동 검증

**Target Platform**: Expo native iOS/Android. Web Guest 인증 지원은 이번 범위 밖이며 web build가
명확한 미지원 상태로 실패하도록 저장소 경계를 유지한다.

**Project Type**: Expo/React Native mobile application

**Performance Goals**: 정상 네트워크의 재방문 인증 부트스트랩을 5초 안에 완료하고, 만료되지
않은 보호 요청에는 인증 계층이 추가 네트워크 왕복을 만들지 않는다.

**Constraints**: Refresh Rotation 결과를 부분 저장하지 않음, 안전한 GET만 401 자동 재시도 최대
1회, 쓰기 요청 자동 재전송 금지, 403에서 갱신 금지, Token/installationId 로그 금지,
알림·시험 재개·WebView 인증은 제외

**Scale/Scope**: 앱 시작 경로 1개, 동의 화면 1개, 복구 오류 화면 1개, Identity 공개 API 2개,
Identity Bearer API 2개, 기존 Learning Core API 전송 계층 전체

## Constitution Check

*GATE: Phase 0 전 통과했으며 Phase 1 설계 후 다시 확인했다.*

- [x] 명세가 승인됐고 사실, 가정, 범위, 범위 밖 동작과 미해결 질문을 분리했다.
- [x] 수용 기준이 사용자 관찰 동작이며 저장 실패, 네트워크 단절, Rotation과 취소 경로를 포함한다.
- [x] Expo/React Native API와 strict TypeScript를 사용하고 기존 API·navigation 경계를 보존한다.
- [x] 기존 `apiFetch`, endpoint별 API 모듈, 공유 UI와 typed navigation을 재사용한다.
- [x] 중앙 Auth Controller, React Provider 중심, refresh-only 영속화의 세 대안을 비교했다.
- [x] 검증 계획에 `pnpm lint`, `pnpm exec tsc --noEmit`, iOS/Android 기기 검증을 포함한다.
- [x] Expo SDK 호환 의존성 2개는 계획 승인 후 pnpm으로만 추가하며 비밀·Jira 쓰기·commit·push가 없다.

Phase 1 재검토 결과 위반 사항이 없으며 Complexity Tracking 예외가 필요하지 않다.

## Current Implementation Before This Revision

1. `AuthController`가 로컬 동의 기록을 먼저 읽고 앱 상수의 버전과 비교한다.
2. 로컬 기록이 없거나 버전이 다르면 저장된 Refresh Token이 있어도 `CONSENT_REQUIRED`로 간다.
3. 로컬 동의가 현재 버전이면 installationId와 session을 읽어 Reissue 또는 same-install Guest
   복구를 수행한다.
4. Reissue Token pair를 저장·메모리 반영하면 서버 동의 상태 확인 없이 바로
   `AUTHENTICATED`가 된다.
5. Consent 화면은 항상 개인정보와 약관 두 항목을 새로 선택받고, 제출하면 Guest API를 호출한다.

따라서 기존 사용자도 로컬 기록에 따라 불필요한 재동의를 볼 수 있고, 새 정책·약관 배포를 앱
상수 변경 없이 감지할 수 없으며, 기존 사용자 동의를 별도 Bearer API로 갱신하지 못한다.

## Design Options

### Option A - 중앙 Auth Controller와 계층화된 전송 모듈

React와 무관한 Auth Controller가 부트스트랩 상태, 메모리 세션, SecureStore commit,
single-flight Rotation과 Token generation을 소유한다. Identity의 Guest/Reissue는 인증을 타지
않는 raw transport를 사용하고, Learning Core `apiFetch`만 Auth Controller를 통해 Token을
준비한다. React Auth Provider는 상태를 구독하고 동의 완료·재시도 이벤트만 전달한다.

- 장점: 일반 함수인 기존 시험 API에서도 같은 인증 규칙을 사용하고 `/reissue` 재귀를 구조적으로
  막는다. Rotation과 저장의 소유자가 하나라 동시성 불변식과 GET 전용 replay 정책을 설명하기 쉽다.
- 비용: 작은 상태 머신과 구독 경계를 새로 만들고 저장/네트워크 의존성을 명시해야 한다.
- 실패 모드: 서버 Rotation 성공 후 저장 실패가 가능하므로 받은 세션 저장 재시도와 same-install
  Guest 복구가 필요하다.

### Option B - React Context 또는 Zustand가 인증과 API를 직접 소유

Provider/store가 Token과 화면 상태를 관리하고 각 hook에서 API를 호출한다.

- 장점: 화면 상태 표현과 UI 연결이 단순하다.
- 비용: React 밖의 endpoint 함수와 녹음/업로드 흐름이 Provider에 결합되고 stale closure 또는
  전역 store 직접 접근이 늘어난다.
- 실패 모드: Provider 재마운트와 요청 수명주기가 어긋나면 공유 Rotation이 취소되거나 중복될 수
  있다.

### Option C - Refresh Token만 영속화하고 Access Token은 메모리에 유지

앱 실행과 JS reload마다 Reissue하고 Access Token의 로컬 노출 범위를 줄인다.

- 장점: 영속 저장되는 자격을 줄인다.
- 비용: 개발 reload와 프로세스 재생성마다 네트워크가 필수이고 한 세대의 Token·만료 메타데이터를
  원자적으로 복구한다는 승인 명세와 맞지 않는다.
- 실패 모드: offline 재실행 시 아직 유효한 Access Token도 활용하지 못하고 복구 화면으로 간다.

## Decision

Option A를 선택한다. `auth-controller`가 인증의 유일한 변경 주체가 되고 다음 계층을 사용한다.

```text
service transport (HTTP + JSON + Envelope 검증)
├── Identity public APIs: guest / reissue
├── Identity authenticated consent APIs: get / update
│       └── Auth Controller가 명시적인 최신 Access Token 전달
└── authenticated Learning Core client
        ├── apiFetch: 모든 method 단일 attempt
        ├── apiFetchWithAuthRetry: GET만 401 복구 후 최대 한 번 재전송
        └── Auth Controller
              ├── consent AsyncStorage
              ├── installationId SecureStore
              └── auth-session SecureStore
```

앱 부팅은 `AuthProvider`가 controller를 한 번 시작하고 현재 상태에 맞는 navigator를 렌더링한다.
Consent 화면은 직접 MainTabs로 reset하지 않고 `acceptConsent()`를 호출한다. 최초 설치는 화면을
보이기 전에 installationId를 SecureStore에 확보하고, 두 동의 제출 후 Guest 발급과 세션 저장을
완료한다. 기존 사용자는 Reissue 세션 저장·메모리 commit 후 서버 동의 상태를 조회하고,
`requiresConsent=true`인 항목만 선택받아 Bearer PUT으로 갱신한다. Consent 화면의 선택과 busy/error
상태는 Guest 제출과 기존 사용자 갱신 모두에서 유지한다.

동의 endpoint가 일반 `apiFetch`를 사용하면 `apiFetch → AuthController → consent endpoint` 순환
의존이 생긴다. 따라서 controller 전용 Identity consent endpoint는 최신 Access Token을 인자로
받아 `serviceFetch`를 직접 사용한다. 401을 무제한 재발급하지 않고 controller가 한 번의 Rotation과
재시도 여부를 명시적으로 소유한다.

서비스 주소는 `EXPO_PUBLIC_IDENTITY_API_BASE_URL`과
`EXPO_PUBLIC_LEARNING_API_BASE_URL`로 분리한다. Gateway 환경에서는 두 값을 같게 둘 수 있고,
전환 기간에는 기존 `EXPO_PUBLIC_API_BASE_URL`을 명시적 fallback으로 허용한다. 정확한 운영 URL은
public 환경 설정이며 코드에 고정하지 않는다. 선택된 값은 URL 파싱과 HTTPS scheme 검증을 통과한
뒤에만 Token이 포함된 요청에 사용한다. 현재 staging 설정은 Identity Guest/Reissue/consents에
`https://identity-staging.to-teacher.com`, 기존 Learning API에
`https://api-staging.to-teacher.com`을 사용한다.

## Data and State Flow

### 최초 동의

```text
CHECKING_LOCAL
→ auth-session 없음 확인
→ installationId 읽기 또는 UUIDv4 생성 후 저장
→ CONSENT_REQUIRED
→ 개인정보 `privacy-v1`, 약관 `term-v1` 동의 저장
→ GUEST_RECOVERING(source=consent-submit; Consent 화면 busy 유지)
→ POST Identity /auth/guest
→ Token 응답 검증 + 절대 만료 시각 계산
→ auth-session 단일 레코드 저장
→ 메모리 session/generation commit
→ AUTHENTICATED
```

기존 통합 동의 `{ version: "1", agreedAt }`은 당시 UI가 두 필수 체크를 모두 요구했다는 코드
근거로 `privacy-v1`과 `term-v1`에 같은 `agreedAt`을 넣어 한 번만 마이그레이션한다. 다른 legacy
버전, 손상된 JSON 또는 이후 개별 버전 불일치는 재동의를 요구한다.

### 앱 재실행

```text
auth-session의 Refresh Token 확인
→ REISSUING
→ 새 Token pair 단일 저장
→ 메모리 session/sessionGeneration commit
→ CHECKING_SERVER_CONSENT
→ GET Identity /users/me/consents (새 Access Token)
   ├─ privacy/terms requiresConsent=false
   │  → 서버 동의 snapshot을 로컬 보조 기록에 반영
   │  → AUTHENTICATED
   └─ 하나 이상 requiresConsent=true
      → CONSENT_REQUIRED(mode=existing, requiredItems)
      → 필요한 항목만 사용자 선택
      → CONSENT_UPDATING
      → PUT Identity /users/me/consents (두 항목의 server currentVersion)
      → 변경 항목은 제출 시각, 비변경 항목은 서버 동의 시각을 사용해 로컬 기록 저장
      → AUTHENTICATED
```

Refresh Token이 없거나 확정적으로 invalid/expired/reused이면 같은 installationId로 Guest를
복구한 후 서버 동의 상태를 조회한다. timeout, 네트워크 오류, 5xx처럼 Reissue·동의 조회·갱신의
결과가 불명확하면 Guest로 전환하거나 로컬 동의를 최신으로 추측하지 않고 원래 작업을 보존한
`RETRYABLE_ERROR`를 표시한다.

로컬 ConsentRecord는 신규 Guest 요청과 설정 화면 표시를 위한 보조 기록이다. 저장된 세션이
있으면 로컬 기록의 누락·손상·버전 불일치가 서버 조회보다 먼저 동의 화면을 열지 않는다.

### 보호 요청

```text
요청이 현재 Token generation을 캡처
→ 만료 60초 이내면 single-flight Reissue
→ 최신 Access Token으로 Learning Core 요청
→ 안전한 GET의 401이면 사용한 generation과 현재 generation 비교
   ├─ 이미 변경됨: 추가 Rotation 없이 최신 Token으로 GET 재시도
   └─ 같음: single-flight Reissue 후 GET 재시도
→ GET 재시도는 최대 1회
→ POST/PUT/PATCH/DELETE의 401은 동일 요청을 자동 재전송하지 않고 오류 전달
```

호출자의 AbortSignal은 그 호출의 대기/GET 재시도만 취소하고 공유 Reissue를 취소하지 않는다.
S3 PUT은 Learning Core 인증 client 밖에 유지한다. GET 재시도 함수는 method를 GET으로 제한하고
body를 타입 수준에서 금지한다.

## Failure and Recovery Paths

| 실패 지점 | 처리 | 홈 진입 |
| --- | --- | --- |
| 동의 저장 I/O 실패 | 동의와 입력을 유지하고 저장만 재시도 | 차단 |
| installationId 미저장 | API 호출 전 중단하고 같은 UUID 저장 재시도 | 차단 |
| installationId 손상/I/O 오류 | 새 ID를 조용히 만들지 않고 복구 오류 표시 | 차단 |
| Guest 네트워크/timeout/5xx | 같은 installationId와 동의로 Guest 재시도 | 차단 |
| Guest 성공 후 세션 저장 실패 | 메모리 응답의 저장을 먼저 재시도; 앱 재시작 시 same-install Guest | 차단 |
| Reissue 명시적 invalid/expired/reused | same-install Guest 복구 | 차단 또는 보호 요청 대기 |
| Reissue 결과 불명 | 자동 Guest 전환 없이 Reissue 재시도 상태 | 차단 또는 요청 실패 |
| 동의 상태 GET 실패 | 로컬 기록으로 추측하지 않고 동일 GET 재시도 | 차단 |
| 동의 상태 GET 401 | 최신 세션으로 Rotation을 한 번 시도한 뒤 GET 한 번 재시도 | 차단 |
| 기존 사용자 동의 PUT 실패 | 선택을 유지하고 동일 PUT 재시도; Guest 호출 금지 | 차단 |
| PUT 성공 후 로컬 동의 저장 실패 | PUT 반복 없이 받은 snapshot의 로컬 저장부터 재시도 | 차단 |
| Rotation 성공 후 세션 저장 실패 | 새 응답 저장부터 재시도; 재시작 후 확정 무효면 Guest 복구 | 차단/요청 실패 |
| 안전한 GET 401 | Token generation 확인 후 한 번만 갱신·GET 재시도 | 유지 |
| GET 재시도도 401 | 인증 복구 오류로 종료, 반복 금지 | 보호 요청 중단 |
| 쓰기 요청 401 | 동일 요청 자동 재전송 없이 ApiError 전달 | 해당 작업 중단 |
| 403 | 갱신하지 않고 ApiError 전달 | 유지 |
| HTTP 200 + `isSuccess=false` | 구조화된 ApiError로 처리 | 오류 성격에 따름 |
| caller abort | 해당 요청만 중단, 공유 Rotation과 저장은 계속 | 유지 |
| 앱 background/unmount | 실행 generation guard로 늦은 UI 전환 무시 | 현재 gate 유지 |

동의 제출 중 실패는 retry descriptor와 함께 `source=consent-submit`을 보존한다. Consent 화면은
선택 상태를 유지한 채 안전한 오류 문구와 재시도 동작을 제공하고, 별도 recovery 화면은 cold
start처럼 Consent 화면을 거치지 않은 bootstrap 실패에 사용한다.

## Developer Explain-Back

- [x] `AuthProvider`는 UI 상태를, Auth Controller는 인증 상태·Rotation을, transport는 HTTP와
  Envelope를, endpoint는 URL과 raw 결과 매핑을 맡는다고 설명할 수 있다.
- [x] 최초 설치의 installationId 저장 → 동의 → Guest 흐름과 기존 사용자의 Reissue 저장·commit
  → consent GET → 필요 시 PUT → 로컬 기록 → 보호 navigator 흐름을 구분해 설명할 수 있다.
- [x] React store 직접 소유와 refresh-only 저장을 기각한 이유 및 중앙 controller의 비용을
  설명할 수 있다.
- [x] Rotation 저장 실패, 조회 요청의 동시/늦은 401, 쓰기 non-replay, 취소, 403과
  `isSuccess=false` 검증 방법을 설명할 수 있다.

## Project Structure

### Documentation (this feature)

```text
specs/009-guest-auth-bootstrap/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── authenticated-request-contract.md
│   ├── auth-bootstrap-contract.md
│   └── identity-auth-contract.md
└── checklists/
    └── requirements.md
```

`tasks.md`는 계획 승인 후 별도 `$speckit-tasks` 단계에서만 생성한다.

### Source Code (repository root)

```text
App.tsx                                      # 폰트와 AuthProvider gate 조합
app.json                                     # expo-secure-store native 설정
.env.local.example                          # Identity/Learning public base URL 예시
src/
├── features/
│   ├── auth/
│   │   ├── api/
│   │   │   ├── create-guest.ts             # POST /auth/guest
│   │   │   ├── reissue-tokens.ts           # POST /auth/reissue
│   │   │   ├── get-consent-status.ts        # Bearer GET /users/me/consents + raw mapper
│   │   │   └── update-consents.ts           # Bearer PUT /users/me/consents
│   │   ├── auth-controller.ts              # bootstrap, state, single-flight Rotation
│   │   ├── auth-provider.tsx               # controller 상태를 React UI에 노출
│   │   ├── auth-session-storage.ts          # SecureStore 단일 세션 레코드
│   │   ├── installation-id.ts              # UUIDv4 생성/검증/single-flight 저장
│   │   └── types.ts                        # raw/session/bootstrap/request snapshot 타입
│   ├── consent/
│   │   ├── consent-storage.ts              # 항목별 v2 기록과 legacy v1 migration
│   │   └── use-consent-gate.ts             # AuthProvider로 대체 후 제거
│   └── exam/api/*.ts                       # 기존 endpoint/result 경계 유지
├── lib/api/
│   ├── client.ts                           # Learning 단일 요청과 GET 전용 401 1회 재시도
│   ├── service-base-url.ts                 # 서비스별 public 환경 URL 결정
│   └── transport.ts                        # timeout, abort, JSON/Envelope/ApiError
├── navigation/
│   ├── RootNavigator.tsx                   # 인증 상태별 public/protected screen set
│   └── types.ts                            # AuthRecovery route 타입
├── screens/
│   ├── auth/AuthRecoveryScreen.tsx         # 재시도 가능한 부트스트랩 오류
│   ├── consent/ConsentScreen.tsx            # 동의 event 전달, 직접 reset 제거
│   └── settings/SettingsScreen.tsx          # 분리된 동의 일시 표시 규칙
└── types/api.ts                             # 성공 Envelope와 오류 payload 분리

package.json / pnpm-lock.yaml               # Expo 호환 SecureStore/Crypto 추가
```

**Structure Decision**: 기존 단일 Expo 앱 구조를 유지한다. 인증 도메인은 `src/features/auth`,
공통 HTTP는 `src/lib/api`, 사용자 진입 UI는 기존 navigation/screen 계층에 둔다. 새 backend나 별도
native project를 만들지 않는다.

## Complexity Tracking

Constitution 위반이나 별도 복잡성 예외 없음.
