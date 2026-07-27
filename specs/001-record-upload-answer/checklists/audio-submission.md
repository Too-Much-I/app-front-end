# Audio and Submission Requirements Checklist: 모의고사 답변 녹음 및 업로드

**Purpose**: 답변 파형, 녹음 복구, 문항별 제출 및 서버 통합 요구사항이 구현 태스크로 분해될 만큼 명확한지 검토
**Created**: 2026-07-27
**Feature**: [spec.md](../spec.md)

**Note**: 이 체크리스트는 구현 동작이 아니라 spec·plan·contract에 작성된 요구사항의 품질을 검증한다.

## Requirement Completeness

- [x] CHK001 답변 녹음 시작, 정상 종료, 파일 확정, 등록, 제출의 전체 단계가 요구사항에 정의되어 있는가? [Completeness, Spec §FR-001–FR-007]
- [x] CHK002 유효 파일이 없는 경우 현재 문항 유지와 전체 시간 재녹음 요구사항이 정의되어 있는가? [Coverage, Spec §FR-009, Plan §Decision 9]
- [x] CHK003 유효 파일은 있지만 registry 등록에 실패한 경우 재녹음하지 않고 등록을 재시도한다는 소유권 요구사항이 정의되어 있는가? [Completeness, Plan §Decision 9]
- [x] CHK004 마지막 문항의 등록 수, 성공 수, pending 및 failed 상태를 모두 포함한 완료 장벽이 정의되어 있는가? [Completeness, Contract §Completion barrier]

## Waveform and Accessibility Clarity

- [x] CHK005 파형이 실제 마이크 metering에 반응해야 한다는 요구사항이 명확히 정의되어 있는가? [Clarity, Spec §US1 Acceptance 1, FR-016]
- [x] CHK006 파형이 무음 판정이나 답변 유효성 기준이 아니라 표시 전용이라는 경계가 정의되어 있는가? [Clarity, Spec §FR-016]
- [x] CHK007 파형을 볼 수 없는 사용자도 녹음 상태를 이해할 수 있도록 별도 텍스트 상태 요구사항이 정의되어 있는가? [Accessibility, Spec §FR-016]
- [x] CHK008 마이크 테스트와 답변 녹음이 공유하는 표현 로직과 공유하지 않는 lifecycle 정책의 경계가 일관되게 설명되어 있는가? [Consistency, Plan §Decision 2, Recording Contract §Observable State]

## Interruption and Race Coverage

- [x] CHK009 AppState interruption과 정상 종료가 경쟁할 때 먼저 기록된 terminal intent를 따른다는 순서 규칙이 정의되어 있는가? [Clarity, Plan §Decision 5]
- [x] CHK010 interruption이 finalize보다 먼저인 경우 부분 파일 폐기와 사용자 주도 재녹음 요구사항이 정의되어 있는가? [Recovery, Spec §FR-012, Recording Contract §Interruption Contract]
- [x] CHK011 finalize가 AppState 변화보다 먼저인 경우 유효 파일을 보존·등록한다는 요구사항이 정의되어 있는가? [Recovery, Plan §Decision 5]
- [x] CHK012 완료 버튼, native 제한 시간 및 fallback timer의 경쟁에서 단일 종료 결과를 요구하는 기준이 정의되어 있는가? [Concurrency, Spec §FR-004, SC-002]
- [x] CHK013 screen dispose와 AppState background의 서로 다른 파일 정리·복구 경계가 정의되어 있는가? [Consistency, Recording Contract §Interruption Contract]

## Submission and Retry Consistency

- [x] CHK014 submission registry가 FIFO가 아니며 한 문항의 retry wait가 다른 문항 처리를 막지 않는다는 요구사항이 정의되어 있는가? [Clarity, Submission Contract §Registry rules]
- [x] CHK015 Answer Key와 network attempt가 구분되고 transport retry가 retryCount를 바꾸지 않는다는 규칙이 정의되어 있는가? [Consistency, Submission Contract §Identity]
- [x] CHK016 fileKey 유무에 따라 upload 또는 submit 단계부터 복구한다는 요구사항이 정의되어 있는가? [Recovery, Submission Contract §Client Registry Contract]
- [x] CHK017 자동 재시도 중과 재시도 소진 후 실패 상태에 서로 다른 사용자 안내와 행동이 정의되어 있는가? [Coverage, Spec §US3 Acceptance 3/5, Plan §Failure and Recovery Paths]

## Dependencies and Acceptance Quality

- [x] CHK018 submit 응답 유실 시 positive status, FAILED, 불명확한 조회 실패를 구분하는 요구사항이 정의되어 있는가? [Completeness, Submission Contract §Ambiguous Submit Reconciliation]
- [x] CHK019 자동 재-POST에 필요한 서버 멱등성과 명확한 미접수 신호가 외부 통합 의존성으로 명시되어 있는가? [Dependency, Spec §Integration Dependencies]
- [x] CHK020 서버 계약이 검증되지 않았을 때 자동 재-POST를 금지하고 feature completion을 통과시키지 않는 기준이 명시되어 있는가? [Acceptance Criteria, Plan §Integration Gate]
- [x] CHK021 process kill 이후 복원이 범위 밖이고 인앱 background의 의미가 다음 문항 중 비차단 실행과 foreground 재개로 한정되어 있는가? [Scope, Submission Contract §Cancellation Contract]
- [x] CHK022 성공률, 중복 0건, 1초 상태 반영 및 양 플랫폼 검증 기준이 객관적으로 측정 가능하게 정의되어 있는가? [Measurability, Spec §SC-001–SC-006]

## Notes

- 모든 항목은 2026-07-27 갱신된 spec, plan, data model 및 internal contracts에서 근거를 확인했다.
- server idempotency와 명확한 미접수 응답은 문서화되었지만 실제 통합 환경 검증은 구현 완료 조건으로 남는다.
