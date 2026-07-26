<!--
Sync Impact Report
- Version change: template → 1.0.0
- Added principles:
  - I. 승인 기반 Spec First
  - II. React Native 우선과 계층 경계
  - III. 사용자 관점의 품질
  - IV. 검증과 안전
  - V. 개발자 주도권과 추적성
- Added sections:
  - 기술 및 제품 제약
  - 개발 워크플로와 품질 게이트
- Templates updated:
  - ✅ .specify/templates/spec-template.md
  - ✅ .specify/templates/plan-template.md
  - ✅ .specify/templates/tasks-template.md
- Runtime guidance updated:
  - ✅ AGENTS.md
- Deferred items: none
-->
# App Front End Constitution

## Core Principles

### I. 승인 기반 Spec First

Jira 이슈와 사용자 요청은 요구사항의 입력이며 곧바로 구현 명령으로 간주하지 않는다.
기능 구현 전에 확인된 사실, 가정, 범위, 범위 밖, 수용 기준 및 미해결 질문을 명세에
기록해야 한다. 제품 동작이나 범위를 바꾸는 불확실성은 임의로 결정하지 않고 사용자에게
질문해야 한다. 사용자가 명세를 승인하기 전에는 기술 계획으로, 기술 계획을 승인하기
전에는 태스크 생성이나 구현으로 진행해서는 안 된다.

### II. React Native 우선과 계층 경계

애플리케이션 코드는 Expo 및 React Native API를 우선하고 브라우저 전용 API를 새로
도입해서는 안 된다. strict TypeScript를 유지하며 `Raw* → mapper → domain type` 경계,
`apiFetch<T>()` API 경계, typed navigation 경계를 보존해야 한다. 화면은 공유 UI, theme,
feature 계층의 기존 추상화를 재사용하며 예외적인 중복이나 새 의존성은 계획에서 근거를
제시해야 한다.

### III. 사용자 관점의 품질

수용 기준은 구현 세부사항이 아니라 사용자가 관찰할 수 있는 동작으로 작성해야 한다.
화면 변경은 safe area, 접근성, 휴대폰과 태블릿의 반응형 레이아웃, iOS와 Android의
동작 차이를 함께 고려해야 한다. 오류와 중단 경로는 정상 경로와 동일하게 명세 및 계획에
포함하고, 기능 단위로 독립 검증 가능한 사용자 시나리오를 제공해야 한다.

### IV. 검증과 안전

모든 코드 변경은 최소한 `pnpm lint`와 `pnpm exec tsc --noEmit`을 실행해야 한다.
테스트 러너가 없는 영역은 관련 수동 또는 기기 검증 절차를 계획과 결과에 명시해야 한다.
실패한 검사는 숨기지 않고 원인과 변경 범위와의 관련성을 보고해야 한다. 비밀을 클라이언트
코드나 저장소에 기록해서는 안 되며, Jira 수정, 외부 메시지, push, commit 같은 외부 또는
영속 작업은 사용자의 명시적 승인 없이는 수행해서는 안 된다.

### V. 개발자 주도권과 추적성

구현 계획은 현재 코드 흐름, 고려한 대안, 선택 이유, 데이터 및 상태 전환, 실패 경로와
검증 방법을 설명해야 한다. 구현 후에는 변경된 파일과 흐름을 개발자가 다시 설명하고
검토할 수 있는 요약을 제공해야 한다. 명세, 계획, 태스크, 코드와 커밋은 Jira 이슈 키 또는
동등한 작업 식별자를 통해 추적 가능해야 하며, 커밋은 하나의 논리적 변경만 포함해야 한다.

## 기술 및 제품 제약

- 패키지 관리는 저장소에 고정된 pnpm을 사용하고 npm 또는 Yarn lockfile을 만들지 않는다.
- 일반 스타일은 NativeWind를 사용하고 공유 가능한 값은 `src/theme/` 토큰을 재사용한다.
- React Native의 기본 `Text`와 `Pressable` 대신 저장소의 공유 UI 컴포넌트를 사용한다.
- 네비게이션 변경은 `src/navigation/types.ts`에 타입을 먼저 정의한다.
- 정적 네이티브 asset은 URL 문자열이 아니라 정적 `require()` 또는 import로 번들링한다.
- Expo SDK 호환성이 검증되지 않은 의존성은 추가하지 않는다.
- 세부 운영 규칙과 명령은 저장소 루트의 `AGENTS.md`를 따른다.

## 개발 워크플로와 품질 게이트

1. **Issue intake**: Jira 이슈를 읽기 전용으로 가져와 사실, 가정, 모호한 부분 및 수용
   기준을 분리한다. Jira 상태나 댓글은 이 단계에서 변경하지 않는다.
2. **Specify gate**: `spec.md`에 사용자 시나리오, 범위, 범위 밖, edge case 및 측정 가능한
   완료 조건을 작성하고 사용자 승인을 받는다.
3. **Plan gate**: 저장소를 조사해 현재 흐름과 최소 두 가지 대안을 비교하고 선택된 설계를
   기록한 뒤 사용자 승인을 받는다.
4. **Task gate**: 태스크를 독립적으로 검토 가능한 단위로 나누고 각 태스크에 파일 경로와
   검증 방법을 포함한다. 큰 기능은 한 번에 전체 구현하지 않고 승인된 단계만 수행한다.
5. **Implementation gate**: 구현 후 명세, 계획, 태스크와 diff의 일치 여부를 검사하고 lint,
   typecheck 및 관련 검증을 실행한다.
6. **Delivery gate**: 개발자가 변경의 데이터 및 상태 흐름과 trade-off를 설명할 수 있을 때
   명시적 요청을 받아 커밋, push 및 Jira 상태 변경을 수행한다.

## Governance

이 Constitution은 이 저장소의 Spec-Driven Development 품질 게이트를 정의하며
`AGENTS.md`의 실행 규칙과 함께 적용한다. 두 문서가 충돌하면 구현 전에 충돌을 명시하고
더 엄격한 안전 및 승인 규칙을 우선 적용한 뒤 문서를 동기화해야 한다.

원칙의 제거, 의미 변경 또는 승인 게이트 완화는 MAJOR 버전 변경이다. 새 원칙이나 필수
섹션 추가는 MINOR, 의미를 바꾸지 않는 명확화는 PATCH 버전 변경이다. Constitution 수정은
영향받는 Spec Kit 템플릿과 `AGENTS.md`를 함께 검토하고 Sync Impact Report를 갱신해야 한다.
모든 명세, 계획, 코드 리뷰는 적용되는 원칙을 확인해야 하며 예외는 계획의 Complexity
Tracking에 이유와 기각한 단순 대안을 기록해야 한다.

**Version**: 1.0.0 | **Ratified**: 2026-07-27 | **Last Amended**: 2026-07-27
