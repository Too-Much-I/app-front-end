# Feature Specification: EAS 빌드 준비

**Feature Branch**: `chore/eas-build-config`

**Created**: 2026-08-15

**Status**: Approved

**Issue**: N/A

**Approval**: Draft specifications MUST be approved before planning begins.

**Input**: Firebase Analytics를 연결하기 전에 저장소에서 수행 가능한 EAS 개발·미리보기·배포 빌드 준비를 완료한다.

## Scope *(mandatory)*

### In Scope

- 개발, 내부 미리보기, 스토어 배포 목적을 명확히 구분하는 빌드 계약
- 각 빌드 목적이 대응하는 원격 환경 설정을 선택하는 계약
- 배포 빌드 번호가 이전 제출보다 항상 증가하는 정책
- Sentry 오류가 배포 산출물의 원본 코드 위치로 복원될 수 있는 빌드 전 처리
- 기존 앱 식별자, NativeWind 변환과 일반 앱 동작을 유지하는 구성
- 이미 생성된 Expo/EAS 프로젝트 `d98fc341-a7a1-467f-8d21-00d0c60e4711`과 저장소 연결
- 저장소에 기록할 수 있는 공개 설정과 원격에서만 관리할 비밀값의 경계
- Expo 프로젝트 연결, 환경변수와 자격증명 등 저장소 밖 후속 작업의 인수인계 문서

### Out of Scope

- Expo 조직 또는 원격 프로젝트의 추가 생성과 계정 권한 변경
- Apple 인증서, provisioning profile, Android keystore 생성
- 실제 EAS 클라우드 빌드와 스토어 제출
- Firebase 프로젝트·앱 등록, SDK·설정 파일 추가와 Analytics 활성화
- 사용자 행동 이벤트 목록, 개인정보 동의와 수집 정책 구현
- EAS Update, 배포 channel과 원격 업데이트 정책
- iOS 암호화 수출 규정에 대한 법적 판단 또는 미확인 선언 추가
- commit, push, PR과 외부 콘솔 쓰기

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 목적별 빌드를 재현한다 (Priority: P1)

개발자는 Firebase 같은 네이티브 기능을 추가하기 전에 개발용, 내부 검증용, 스토어 제출용 빌드를
서로 혼동하지 않고 같은 절차로 선택할 수 있다.

**Why this priority**: 빌드 목적과 배포 범위가 섞이면 개발 설정이 운영 앱에 포함되거나 검증되지 않은
앱이 스토어 제출 대상으로 만들어질 수 있다.

**Independent Test**: 저장소 설정을 검사해 세 빌드 목적이 각각 하나의 명확한 프로필과 환경으로
연결되고, 로컬 구성 검증이 성공하는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 네이티브 개발 기능을 확인하려는 개발자, **When** 개발 빌드를 선택하면, **Then** 내부
   배포 가능한 개발 클라이언트 계약이 선택된다.
2. **Given** Firebase가 없는 현재 앱을 내부 검증하려는 개발자, **When** 미리보기 빌드를 선택하면,
   **Then** 스토어에 제출되지 않는 내부 배포 계약이 선택된다.
3. **Given** 앱 심사용 산출물을 준비하는 개발자, **When** 배포 빌드를 선택하면, **Then** 스토어 배포
   계약과 자동 증가 버전 정책이 선택된다.

---

### User Story 2 - 운영 설정과 비밀을 분리한다 (Priority: P1)

개발자는 운영 API와 오류 보고를 활성화하면서도 토큰, 인증서와 계정 자격증명을 저장소나 앱 번들에
포함하지 않는다.

**Why this priority**: 운영 주소 누락은 실행 불가능한 앱을 만들고, 비밀값 노출은 빌드 성공 여부보다
우선해서 방지해야 하는 보안 사고다.

**Independent Test**: 설정과 문서를 전수 검사해 필요한 공개 변수 이름은 모두 정의되고 실제 비밀값은
없으며, 운영 빌드가 staging 주소를 암묵적으로 사용하지 않는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 원격 production 환경이 준비된 상태, **When** 배포 빌드 설정을 해석하면, **Then** 운영 API,
   Web, Sentry 공개 활성화 값과 비밀 토큰이 올바른 관리 경계에서 제공된다.
2. **Given** production 필수 주소가 누락된 상태, **When** 앱이 해당 서비스를 사용하면, **Then** staging
   주소로 자동 대체되지 않고 누락이 명확하게 드러난다.
3. **Given** 저장소 전체, **When** 비밀값 감사를 수행하면, **Then** Sentry token, Apple·Google 자격증명과
   Firebase 설정 비밀이 0건이다.

---

### User Story 3 - Firebase 전 빌드 기준선을 확정한다 (Priority: P2)

개발자는 Firebase를 추가하기 전 기존 앱과 Sentry source map 구성이 로컬 빌드 검증을 통과했는지
확인하고, 원격 콘솔에서 해야 할 남은 작업을 구분한다.

**Why this priority**: EAS와 Firebase를 동시에 추가하면 네이티브 빌드 실패 원인을 분리하기 어렵다.

**Independent Test**: Firebase 관련 파일과 의존성이 없는 상태에서 정적 검사와 iOS·Android 산출물
생성을 완료하고, 원격 EAS 빌드에 필요한 후속 항목 목록을 확인한다.

**Acceptance Scenarios**:

1. **Given** 현재 앱 소스, **When** 로컬 품질 및 양 플랫폼 산출물 검증을 실행하면, **Then** Firebase 없이
   모두 성공한다.
2. **Given** 오류가 배포 번들에서 발생한 상황, **When** 빌드 산출물을 검사하면, **Then** Sentry가 원본
   위치를 연결할 수 있는 식별 정보가 포함된다.
3. **Given** 원격 프로젝트가 생성된 상태, **When** 저장소 연결과 인수인계 문서를 확인하면, **Then** 프로젝트
   ID가 로컬 앱 구성에 기록되고 계정, 환경변수, 자격증명과 첫 빌드 작업이 저장소 작업과 구분되어 있다.

### Edge Cases

- 프로젝트 연결 명령이 계정 또는 프로젝트 불일치로 실패하면 임의의 `owner` 값을 기록하지 않아야 한다.
- 로컬에서만 존재하는 환경 파일을 원격 빌드가 사용할 것이라고 가정해서는 안 된다.
- production 환경이 없는 상태에서 preview 또는 development 값이 조용히 선택되어서는 안 된다.
- 빌드 번호가 이전 스토어 제출과 같거나 낮아지는 정책을 사용해서는 안 된다.
- source map 업로드 토큰이 없거나 업로드가 실패해도 토큰 원문이 로그나 앱 번들에 노출되어서는 안 된다.
- Firebase 설정 파일이나 Analytics SDK가 이번 변경에 우연히 포함되어서는 안 된다.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 개발, 내부 미리보기와 스토어 배포 목적을 서로 다른 빌드 프로필로 제공해야 한다.
- **FR-002**: 개발 프로필은 내부 배포 가능한 개발 클라이언트 계약을 사용해야 한다.
- **FR-003**: 미리보기 프로필은 스토어 제출과 분리된 내부 배포 계약을 사용해야 한다.
- **FR-004**: 배포 프로필은 스토어 배포 계약을 사용하고 제출마다 빌드 번호를 증가시켜야 한다.
- **FR-005**: 각 프로필은 이름이 같은 원격 환경 설정만 선택해야 한다.
- **FR-006**: 시스템은 운영 API와 Web 주소가 누락됐을 때 staging 값으로 자동 대체해서는 안 된다.
- **FR-007**: 저장소는 필요한 공개 환경변수 이름과 용도를 제공하되 실제 운영 비밀값을 포함해서는 안 된다.
- **FR-008**: Sentry 업로드 토큰, Apple·Google 자격증명과 향후 Firebase 비밀은 앱 번들에 공개되는 변수로
  취급하거나 저장소에 기록해서는 안 된다.
- **FR-009**: 빌드 구성 변경은 기존 iOS bundle identifier와 Android package identifier를 변경해서는 안 된다.
- **FR-010**: 오류 보고가 활성화된 배포 산출물은 원본 코드 위치를 복원할 수 있는 안정된 빌드 식별 정보를
  포함해야 한다.
- **FR-011**: 오류 보고용 빌드 처리는 기존 스타일 변환과 iOS·Android bundle 생성을 깨뜨려서는 안 된다.
- **FR-012**: 저장소 문서는 원격 프로젝트 연결, 환경변수, 자격증명과 첫 preview·production 빌드 작업을
  저장소 내부 작업과 구분해 설명해야 한다.
- **FR-013**: 이번 변경은 Firebase 설정 파일, Firebase SDK와 사용자 행동 수집을 추가하거나 활성화해서는
  안 된다.
- **FR-014**: 법적 확인이 필요한 iOS 암호화 수출 규정 선언은 확인 전 임의로 확정해서는 안 된다.
- **FR-015**: 앱 구성은 Expo/EAS 프로젝트 ID `d98fc341-a7a1-467f-8d21-00d0c60e4711`과 연결되어야 하며,
  계정에서 확인되지 않은 프로젝트 소유자 값을 추측해 기록해서는 안 된다.

### Key Entities

- **빌드 프로필**: 개발, 내부 미리보기 또는 스토어 배포 목적과 배포 범위를 나타낸다.
- **빌드 환경**: 프로필별 공개 설정과 비밀값이 원격에서 관리되는 경계다.
- **빌드 버전**: 스토어가 새 산출물로 식별할 수 있도록 단조 증가하는 플랫폼별 번호다.
- **빌드 인수인계 항목**: 저장소 밖에서 계정 소유자가 완료해야 하는 프로젝트 연결, 변수와 자격증명이다.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 개발자가 저장소만 보고 세 빌드 목적과 배포 범위를 100% 구분할 수 있다.
- **SC-002**: 로컬 구성 검사에서 개발·미리보기·배포 프로필과 대응 환경의 누락이 0건이다.
- **SC-003**: 저장소 비밀값 감사에서 Sentry, Apple, Google과 Firebase credential 노출이 0건이다.
- **SC-004**: Firebase가 없는 상태의 lint, typecheck와 iOS·Android 산출물 검사가 모두 성공한다.
- **SC-005**: 배포 빌드 정책 검사에서 이전 제출과 같은 빌드 번호를 재사용할 가능성이 0건이다.
- **SC-006**: source map 산출물 검사에서 지원하는 각 모바일 bundle에 빌드 식별 정보가 존재한다.
- **SC-007**: 원격 작업 인수인계 목록이 프로젝트 연결, 환경변수, 자격증명, 첫 빌드의 네 범주를 모두 포함한다.
- **SC-008**: 이번 변경의 dependency와 설정 감사에서 Firebase 또는 Analytics 추가가 0건이다.

## Assumptions

- 앱 이름과 `com.toteacher.app` 식별자는 확정되어 있으며 이번 변경에서 유지한다.
- 원격 EAS 프로젝트 `d98fc341-a7a1-467f-8d21-00d0c60e4711`은 계정 소유자가 이미 생성했다.
- 프로젝트 소유자 값은 EAS CLI가 로그인 계정과 원격 프로젝트에서 확인한 결과를 사용한다.
- development, preview, production 세 환경은 원격 프로젝트 연결 후 같은 이름으로 생성한다.
- 원격 production API 주소와 Sentry 업로드 토큰은 준비돼 있으나 저장소에 기록하지 않는다.
- 첫 원격 검증은 Firebase를 추가하지 않은 preview 빌드로 수행한다.
- EAS Update는 첫 스토어 빌드 이후 별도 요구사항으로 결정한다.

## Open Questions

- 없음. iOS 암호화 수출 규정 선언은 법적 확인 전 범위 밖으로 두고, 원격 프로젝트 값은 인수인계 항목으로 남긴다.
