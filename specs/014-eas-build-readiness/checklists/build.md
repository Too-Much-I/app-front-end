# Build Requirements Checklist: EAS 빌드 준비

**Purpose**: EAS 연결, 환경·비밀 경계와 Sentry 빌드 요구사항이 구현 전 검토 가능한 수준인지 평가
**Created**: 2026-08-15
**Feature**: [spec.md](../spec.md)

**Note**: 이 목록은 구현 결과가 아니라 명세와 계획의 완전성·명확성·일관성을 검사한다.

## Requirement Completeness

- [x] CHK001 세 빌드 목적의 배포 범위와 개발 클라이언트 여부가 모두 정의되어 있는가? [Completeness, Spec §FR-001–FR-004]
- [x] CHK002 각 빌드 profile이 선택할 원격 environment 관계가 빠짐없이 정의되어 있는가? [Completeness, Spec §FR-005]
- [x] CHK003 프로젝트 연결에서 project ID, owner 출처와 유지할 앱 식별자가 모두 정의되어 있는가? [Completeness, Spec §FR-009, §FR-015]
- [x] CHK004 공개 변수와 빌드 비밀·플랫폼 credential의 관리 경계가 각각 정의되어 있는가? [Completeness, Spec §FR-007–FR-008]
- [x] CHK005 Sentry 원본 위치 복원과 NativeWind 유지 요구사항이 양 플랫폼을 포함하는가? [Completeness, Spec §FR-010–FR-011]
- [x] CHK006 저장소 작업과 원격 후속 작업의 네 범주가 모두 요구사항에 포함되는가? [Completeness, Spec §FR-012, §SC-007]

## Requirement Clarity

- [x] CHK007 연결 대상 project ID가 단일 값으로 명확하며 owner를 추측하지 않는 기준이 정의되어 있는가? [Clarity, Spec §FR-015]
- [x] CHK008 production의 “자동 증가”가 native build number/versionCode 재사용 방지로 명확히 설명되는가? [Clarity, Spec §FR-004, §SC-005]
- [x] CHK009 “동일 이름의 환경”이 development, preview, production 각각의 1:1 매핑으로 명확한가? [Clarity, Spec §FR-005]
- [x] CHK010 “비밀”과 번들에 포함 가능한 공개 설정의 구분 기준이 `EXPO_PUBLIC_*` 노출 특성과 함께 명확한가? [Clarity, Spec §FR-007–FR-008]
- [x] CHK011 source map 성공 기준이 양 플랫폼의 비어 있지 않은 Debug ID로 객관화되어 있는가? [Clarity, Spec §SC-006]

## Requirement Consistency

- [x] CHK012 프로젝트 연결이 범위 안이라는 정의가 추가 프로젝트 생성·권한 변경 제외와 충돌하지 않는가? [Consistency, Spec §Scope, §FR-015]
- [x] CHK013 production 환경 누락 시 실패한다는 요구와 staging fallback 금지가 acceptance criteria 및 edge case에서 일치하는가? [Consistency, Spec §FR-006]
- [x] CHK014 Sentry 활성화 공개 플래그와 Sentry 업로드 token의 비밀 분류가 문서 전반에서 일치하는가? [Consistency, Spec §FR-007–FR-008]
- [x] CHK015 Firebase 제외 범위가 기준선 검증 및 후속 인수인계 설명과 일치하는가? [Consistency, Spec §FR-013, §SC-008]

## Scenario and Recovery Coverage

- [x] CHK016 로그인·권한 또는 프로젝트 불일치로 연결이 실패할 때 중단·정리·재시도 요구가 정의되어 있는가? [Coverage, Plan §Failure and Recovery Paths]
- [x] CHK017 원격 environment나 production 필수 값이 누락된 경우 cloud build를 진행하지 않는 경계가 정의되어 있는가? [Coverage, Spec §Edge Cases]
- [x] CHK018 Sentry token 누락과 upload 실패 시 비밀 비노출 및 로컬 Debug ID 검증 분리가 정의되어 있는가? [Coverage, Plan §Failure and Recovery Paths]
- [x] CHK019 한 플랫폼 export만 실패하는 부분 성공을 전체 성공으로 간주하지 않는 기준이 정의되어 있는가? [Coverage, Plan §Failure and Recovery Paths]

## Acceptance Criteria and Assumptions

- [x] CHK020 lint, typecheck, config, 양 플랫폼 export, Debug ID와 secret 감사를 각각 객관적으로 판정할 수 있는가? [Measurability, Spec §SC-002–SC-006]
- [x] CHK021 원격 프로젝트의 존재와 ID는 확인된 사실이고 owner 및 환경·credential 준비는 별도 상태로 구분되는가? [Assumption, Spec §Assumptions]
- [x] CHK022 iOS 암호화 수출 규정 선언을 법적 확인 전 제외한다는 경계가 요구사항과 계획에서 유지되는가? [Dependency, Spec §FR-014]

## Notes

- 표준 깊이의 PR reviewer용 체크리스트다.
- 중점 영역은 빌드 계약의 완전성과 secret/source map 보안 경계다.
- 22개 항목을 명세·계획에 대조했으며 미해결 요구사항 공백은 발견되지 않았다.
