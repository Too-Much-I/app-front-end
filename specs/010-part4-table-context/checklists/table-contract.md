# Table Contract Requirements Checklist: Part 4 구조화 표 렌더링

**Purpose**: PR 구현 전에 동적 표 계약, 표시 완전성, 복구 및 접근성 요구사항이 충분히 명확한지 검증
**Created**: 2026-08-07
**Feature**: [spec.md](../spec.md)

**Note**: 구현 동작이 아니라 요구사항 문장의 완전성·명확성·일관성을 검증한다.

## Requirement Completeness

- [x] CHK001 title, subtitles, metadata, columns/items, notes 각각의 표시 요구가 모두 정의되어 있는가? [Completeness, Spec §FR-002]
- [x] CHK002 live reading, Q8~Q10, 재답변의 모든 표 소비 지점이 범위에 명시되어 있는가? [Coverage, Spec §FR-014–FR-015]
- [x] CHK003 원격 이미지 제거 범위와 일반 문제 이미지의 제외 범위가 함께 정의되어 있는가? [Completeness, Spec §FR-001, §FR-022]
- [x] CHK004 공개 규격에 없는 내부 필드가 범위 밖임이 명시되어 있는가? [Scope, Spec §Out of Scope]

## Requirement Clarity

- [x] CHK005 cell 조회 순서와 key 기준이 `columns`를 기준으로 구체적으로 명시되어 있는가? [Clarity, Spec §FR-003–FR-004]
- [x] CHK006 null, 누락, 빈 문자열, 0, false 각각의 표시 의미가 구분되어 있는가? [Clarity, Spec §FR-006–FR-008]
- [x] CHK007 status badge와 strike-through의 적용 경계가 모호하지 않게 정의되어 있는가? [Clarity, Spec §FR-009–FR-010]
- [x] CHK008 "알 수 없는 값"의 범주와 fallback 결과가 열린 문자열 계약으로 구체화되어 있는가? [Clarity, Spec §FR-011]

## Requirement Consistency

- [x] CHK009 행 필터링 금지와 malformed row의 부분 복구 요구가 서로 일관되는가? [Consistency, Spec §FR-005, §FR-012–FR-013]
- [x] CHK010 표시 문자열 보존 요구와 value type별 재파싱 금지가 모든 표시 경로에서 일관되는가? [Consistency, Spec §FR-008, §FR-014–FR-015]
- [x] CHK011 표 전체 오류의 진행 차단과 cell 단위 오류의 fallback 유지 경계가 일관되게 정의되어 있는가? [Consistency, Spec §FR-012–FR-016]
- [x] CHK012 표 ready, app 활성 상태, timer와 준비 완료 action의 전환 규칙이 충돌하지 않는가? [Consistency, Spec §FR-017–FR-018]

## Scenario and Edge-Case Coverage

- [x] CHK013 missing, misplaced, invalid, conflicting Part 4 표의 exception 경로가 문서화되어 있는가? [Coverage, Spec §Edge Cases, §FR-016]
- [x] CHK014 duplicate column, missing cell, extra cell과 unknown scope의 처리 요구가 포함되어 있는가? [Coverage, Spec §Edge Cases, §FR-011–FR-013]
- [x] CHK015 재답변의 단일 문제 상세 응답에 표가 없을 때의 복구 경로가 정의되어 있는가? [Recovery, Spec §FR-015–FR-016]
- [x] CHK016 timer 만료와 사용자 완료가 동시에 발생하는 경쟁 조건이 요구사항에 포함되어 있는가? [Coverage, Spec §FR-018]

## Non-Functional Requirements and Measurability

- [x] CHK017 휴대폰·태블릿·큰 글자에서 가로/세로 전체 접근 요구가 객관적으로 검증 가능한가? [Measurability, Spec §FR-019–FR-020, §SC-008]
- [x] CHK018 column header, 빈 값과 상태를 보조 기술로 구분하는 접근성 요구가 명시되어 있는가? [Coverage, Spec §FR-021]
- [x] CHK019 reference JSON의 표·행·경계값 수량을 사용한 완료 기준이 측정 가능한가? [Acceptance Criteria, Spec §SC-001–SC-007]
- [x] CHK020 backend가 Q8 session과 각 Part 4 question detail에 tableContext를 제공한다는 의존성이 명시되어 있는가? [Dependency, Spec §Assumptions, Plan §Integration dependency]

## Notes

- Focus: API/table contract completeness and responsive/accessibility coverage.
- Depth: Standard PR-review gate.
- Audience/timing: 구현자와 reviewer가 코드 변경 전 사용하는 요구사항 품질 점검.
- 20개 항목 모두 spec, plan과 contract 문서에서 근거를 확인해 완료 처리했다.
