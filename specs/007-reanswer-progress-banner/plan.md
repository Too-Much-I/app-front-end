# Implementation Plan: 피드백 기록과 재답변 성장 요약

**Branch**: `feat/#TMi-44` | **Date**: 2026-08-03 | **Spec**: [spec.md](./spec.md)

**Approval**: Draft — 이 계획은 사용자 승인 전이며, 승인 전에는 `tasks.md` 생성이나 구현을 시작하지 않는다.

**Input**: `specs/007-reanswer-progress-banner/spec.md`

## Summary

피드백 탭을 네이티브 기록 허브와 기존 WebView 상세로 분리한다. 기록 허브는 기본 `모의고사 기록` 탭에서 서버가 제공한 동일 척도의 최근 5개 평균 점수 추이와 등급별 배지를 보여주고, `다시 답변한 문제` 탭에서는 문제별 최초 완료 답변과 최신 완료 재답변의 달성률 차이를 평균해 `%p`로 요약한다. 완료된 재답변이 없을 때만 차트 일러스트가 포함된 CTA를 제공하고, 가장 최근 완료 시험의 파트별 피드백으로 이동한다.

이 기능에 필요한 전체 시험 이력과 재답변 이력을 현재 앱 API만으로 발견할 수 없으므로, 구현 착수 조건은 사용자 소유 범위가 보장된 두 서버 collection endpoint의 제공 및 계약 확정이다. 앱은 사용자 ID를 임의로 만들거나 기기 로컬 기록으로 대체하지 않는다.

## Technical Context

**Language/Version**: TypeScript 6.0 strict, React 19.2

**Primary Dependencies**: Expo 57, React Native 0.86, React Navigation 7 (`bottom-tabs`, `native-stack`), NativeWind 4, `react-native-webview` 13, `react-native-safe-area-context`; 새 의존성 없음

**Storage**: 서버가 소유하는 시험·답변·채점 이력. 앱 영속 저장소 추가 없음

**Testing**: 자동 테스트 러너 없음. `pnpm lint`, `pnpm exec tsc --noEmit`, 순수 계산 함수의 수동 fixture 검증, iOS/Android 기기 수동 검증

**Target Platform**: Expo가 지원하는 iOS/Android 휴대폰 및 태블릿

**Project Type**: React Native 모바일 앱 + 기존 웹 피드백 WebView 연동

**Performance Goals**: 기록 화면 전환과 탭 전환이 눈에 띄는 프레임 저하 없이 동작하고, 5점 추이 차트는 새 그래픽 의존성 없이 렌더링하며, 배너 장식 이미지는 384~512px 범위로 축소해 decode·메모리 비용을 제한한다.

**Constraints**: 서버 이력 계약 선행, 두 탭의 실패 격리, 사용자 식별정보를 클라이언트가 임의 전달하지 않음, `Raw* → mapper → domain` 경계 유지, 100점 환산 금지, WebView의 실제 `step=3` 계약 사용, 큰 글자·safe area·색각 접근성 지원

**Scale/Scope**: 피드백 탭의 네이티브 기록 허브 1개, 하위 탭 2개, 기존 WebView 상세 1개, 신규 서버 collection 계약 2개, 최신 5개 시험 추이, 전체 재답변 고유 문제 집계

## Constitution Check

*GATE: Phase 0 이전 및 Phase 1 설계 완료 후 재검토 — 모두 통과.*

- [x] 명세가 승인됐고 사실, 가정, 범위, 범위 밖 동작과 미해결 질문을 분리한다.
- [x] 수용 기준이 관찰 가능한 동작이며 로딩, 실패, 채점 대기, 비교 불가와 최근 시험 부재를 포함한다.
- [x] 설계가 Expo/React Native API, strict TypeScript, API·mapper·domain·typed navigation 경계를 보존한다.
- [x] 공용 `Text`/`Pressable`, theme token, NativeWind, `apiFetch<T>()`와 기존 WebView를 재사용한다.
- [x] 중첩 네이티브 스택, 단일 화면 모드 전환, 웹 중심 구현의 세 접근을 비교했다.
- [x] 검증 계획에 `pnpm lint`, `pnpm exec tsc --noEmit`, iOS/Android·접근성·태블릿 수동 검증을 포함한다.
- [x] 비밀, Jira 쓰기, 커밋, push, 의존성 추가나 승인되지 않은 외부 부작용이 필요하지 않다.

### Post-design re-check

- [x] [data-model.md](./data-model.md)가 원본 응답과 정규화된 domain, 계산 상태를 분리한다.
- [x] [history-api-contract.md](./contracts/history-api-contract.md)가 서버 선행 조건과 사용자 소유 범위를 명시하며 로컬 fallback을 금지한다.
- [x] [feedback-navigation-contract.md](./contracts/feedback-navigation-contract.md)가 semantic native params와 웹 query/message 경계를 분리한다.
- [x] [quickstart.md](./quickstart.md)가 정상·오류·중단·접근성 검증을 포함한다.

## Current Flow

1. `MainTabNavigator`는 `Feedback` 탭에 `FeedbackScreen` WebView 화면을 직접 연결한다.
2. 홈과 마이페이지는 파라미터 없이 `Feedback`을 열며, 현재 화면은 `examId`가 없으면 “확인할 피드백이 없음” 안내만 표시한다.
3. 채점 완료 화면은 `examId`를 탭 파라미터로 전달해 `/app-exam-screen?examId=...` 종합 피드백을 연다.
4. 웹에서 `REANSWER_REQUESTED` 메시지를 보내면 앱은 루트 `Reanswer` 화면을 열고, 재답변 채점 완료 후 `examId`, `questionNumber`, `retryCount`를 다시 `Feedback` 탭으로 전달한다.
5. `FeedbackScreen`은 route params를 1회 소비한 뒤 지우고 WebView URL을 자체 state로 보존한다. 웹이 이미 보내는 navigation-state 메시지와 native back 메시지 계약은 아직 연결하지 않는다.
6. 앱 API는 이미 알고 있는 한 시험 summary 또는 한 문제/회차만 조회한다. 현재 사용자에게 속한 완료 시험 목록, 최신 완료 시험, 재답변 문제 목록을 발견할 계약은 없다.
7. 단건 질문 API의 웹 응답에는 과거 회차 점수가 있으나 앱 mapper는 이를 이력 탐색용으로 보존하지 않으며, 모든 시험과 문제 ID를 알 방법도 없다.

## Target Data and State Flow

1. 파라미터 없는 `Feedback` 진입은 `FeedbackHistory`를 열고 `모의고사 기록`을 기본 선택한다.
2. `useExamHistory`는 시험 이력 endpoint를 호출하고 mapper가 날짜, 점수 척도, 등급과 최신 완료 시험 대상을 정규화한다. 최근 5개 trend point는 `MockExamTrendCard`가 텍스트 요약과 5점 선 그래프로 표시한다.
3. `useReanswerHistory`는 재답변 이력 endpoint를 별도로 호출한다. mapper가 `(examId, questionNumber)`별 회차를 정렬·검증하고 pending과 completed를 구분한다.
4. 순수 계산 함수는 각 고유 문제의 `retryCount=0` 완료 회차와 가장 큰 `retryCount>0` 완료 회차를 비교한다. 유효한 비율 차이를 중간 반올림 없이 평균하고 표시 단계에서만 `%p` 소수 첫째 자리로 반올림한다.
5. 비교 가능한 기록이 있으면 읽기 전용 `View` 배너를 표시한다. 완료 기록이 없고 pending도 없으면 공용 `Pressable` CTA를 표시한다. pending만 있거나 완료 데이터가 비교 불가능하면 각각 별도 상태를 표시한다.
6. CTA는 시험 이력의 `latestCompletedExamId`를 `FeedbackWeb`의 `initialSection: "part-feedback"`으로 전달한다. WebView URL builder만 이를 실제 `step=3`으로 변환한다.
7. 시험 기록 선택, 채점 완료, 재답변 완료도 명시적인 typed `FeedbackWeb` params로 상세를 연다. 웹 내부에서 먼저 뒤로갈 수 있으면 native back이 `FEEDBACK_GO_BACK`을 보내고, 웹 첫 단계에서만 stack pop으로 기록 허브에 돌아간다.

## Design Options

### Option A - 네이티브 기록 허브 + 중첩 Feedback stack

`FeedbackHistory`와 `FeedbackWeb`을 전용 native stack에 둔다. 기록·탭·배너·차트는 React Native로 구현하고 기존 상세 WebView는 유지한다.

- 장점: 기록과 상세의 route 수명이 분리되고 표준 pop 동작을 얻는다. safe area, 큰 글자, 태블릿과 접근성을 앱에서 통제할 수 있다. 상세 웹 구현을 재사용한다.
- 비용: 기존 direct tab params를 nested params로 옮기고 모든 caller를 갱신해야 한다. native/web 뒤로가기 메시지 상태를 연결해야 한다.
- 실패 모드: nested params 누락, stale WebView navigation state, 서버 두 endpoint의 부분 실패. typed params, focus 시 상태 초기화, 탭별 독립 retry로 완화한다.

### Option B - 기존 `FeedbackScreen` 단일 화면에서 모드 전환

한 화면이 route params와 local state를 조합해 기록 허브 또는 WebView 상세를 조건부 렌더링한다.

- 장점: navigator 파일과 route 계층 변경이 적다.
- 비용: 1회용 재답변 params, 탭 재선택, 기록 복귀, WebView URL state가 한 컴포넌트에 결합된다.
- 실패 모드: 상세를 본 뒤 params를 지웠을 때 잘못된 모드로 돌아가거나, 이전 시험 URL이 다음 진입에 남을 수 있다. 현재도 URL 보존을 위한 복잡성이 있어 확장 시 취약하다.

### Option C - 기록 UI까지 웹에서 구현

앱은 기존 WebView shell을 유지하고 웹 저장소가 기록 탭과 배너를 소유한다.

- 장점: 피드백 경험을 한 웹 코드베이스에 모을 수 있다.
- 비용: TMI-44의 변경이 별도 저장소와 배포에 의존하고, 앱의 공용 UI·safe area·접근성 검증을 직접 적용하기 어렵다. `examId` 없는 새 웹 route와 앱-웹 계약도 추가해야 한다.
- 실패 모드: 앱과 웹 배포 버전 차이로 빈 화면 또는 미지원 메시지가 발생할 수 있다.

## Decision

Option A를 선택한다. 기록 허브는 앱 탭의 안정적인 root이고, 상세 피드백은 기존 WebView가 이미 완성된 도메인 경험을 제공한다. 중첩 stack은 두 책임을 route로 분리하면서 채점 완료와 재답변 완료의 direct detail 진입도 보존한다. Option B는 현재의 1회용 params 복잡성을 더 키우고, Option C는 범위와 배포 의존성을 불필요하게 넓히므로 선택하지 않는다.

## Failure and Recovery Paths

- **시험 이력만 실패**: `모의고사 기록` 탭에 오류와 다시 시도 동작을 표시한다. 재답변 이력 요청은 취소하거나 실패로 덮지 않는다.
- **재답변 이력만 실패**: 재답변 없음 CTA를 표시하지 않고 오류와 다시 시도 동작을 표시한다. 모의고사 기록은 계속 사용할 수 있다.
- **화면 이탈 또는 연속 재시도**: 요청마다 `AbortController`를 소유하고 abort된 응답 및 이전 요청의 늦은 결과를 무시한다.
- **pending 재답변만 존재**: 성장값 계산과 CTA를 모두 숨기고 채점 대기 상태를 표시한다.
- **완료 재답변은 있으나 비교 불가**: 누락·비정상 점수 또는 만점 불일치 항목을 제외한다. 비교 가능한 문제가 0개면 데이터 확인 불가 상태와 retry를 표시하고 첫 재답변 CTA로 오인하지 않는다.
- **일부만 비교 불가**: 유효한 문제만 분모와 평균에 포함하고 제외 수를 domain에 보존한다. 잘못된 값을 0점으로 대체하지 않는다.
- **최근 완료 시험 없음**: 재답변 CTA 대신 모의고사 시작 안내를 표시하며 실행 불가능한 파트 피드백 이동은 제공하지 않는다.
- **CTA 대상 시험 접근 불가**: WebView/API 오류를 실제 empty로 바꾸지 않는다. 기록을 다시 불러오거나 history로 돌아가는 복구 동작을 제공한다.
- **`EXPO_PUBLIC_WEB_BASE_URL` 없음**: 네이티브 안내에서 설정 누락을 명시하고 잘못된 URL을 열지 않는다.
- **WebView load 실패**: 상세 화면 안에서 다시 로드와 기록으로 돌아가기 동작을 제공한다.
- **malformed/unknown WebView message**: 예외를 화면에 전파하지 않고 무시한다. `REANSWER_REQUESTED`는 현재 exam과 일치하고 필드가 유효할 때만 처리한다.
- **웹 내부 뒤로가기 상태 미수신**: 첫 상태를 보수적으로 native pop 가능으로 두되, 지원 메시지 수신 후에는 웹이 알린 상태를 따른다. 중복 back 요청은 ref guard로 막는다.
- **서버 계약 또는 사용자 소유 범위 미확정**: 구현을 중단한다. 앱 로컬 registry, 임의 user ID/header 또는 N+1 상세 순회로 우회하지 않는다.

## Validation Strategy

1. fixture로 중복 회차, pending 최신 회차, 다른 만점, 0·음수·NaN·초과 점수, 음수 평균과 negative zero를 계산식과 대조한다.
2. 시험 이력과 재답변 이력의 loading/ready/error/retry를 독립적으로 전환해 다른 탭 상태가 유지되는지 확인한다.
3. 채점 완료, 시험 기록 선택, 빈 재답변 CTA, 재답변 완료의 네 진입점이 올바른 `FeedbackWeb` params와 URL을 만드는지 확인한다.
4. 웹 2·3단계 및 문제별 회차에서 iOS back gesture와 Android hardware back이 웹 내부 단계부터 소비되고 첫 단계에서 history로 pop되는지 확인한다.
5. 작은 휴대폰, 태블릿, 큰 글자와 VoiceOver/TalkBack에서 탭·등급 문자·배너 문구가 잘리지 않고, 읽기 전용 배너가 버튼으로 안내되지 않는지 확인한다.
6. `pnpm lint`와 `pnpm exec tsc --noEmit`을 실행하고 실패가 있으면 변경 범위와 관련성을 보고한다.

## Developer Explain-Back

- [ ] `FeedbackStackNavigator`, history screen, WebView detail, API/mapper/hooks와 순수 계산 함수의 책임을 설명할 수 있다.
- [ ] 서버 collection 응답이 탭별 request state를 거쳐 trend와 재답변 요약으로 변환되는 순서를 설명할 수 있다.
- [ ] `%p` 계산, 고유 문제 식별, latest completed 선택과 invalid/pending 제외 규칙을 예제로 설명할 수 있다.
- [ ] native semantic route가 웹 `step=3`과 back/message 계약으로 변환되는 경계를 설명할 수 있다.
- [ ] 선택한 중첩 stack의 이점과 단일 화면·웹 중심 대안을 기각한 이유를 설명할 수 있다.
- [ ] lint/typecheck, fixture와 기기별 수동 검증 및 문제 발생 시 rollback 단위를 설명할 수 있다.

## Project Structure

### Documentation (this feature)

```text
specs/007-reanswer-progress-banner/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── history-api-contract.md
    └── feedback-navigation-contract.md
```

`tasks.md`는 계획 승인 후 `/speckit-tasks` 단계에서만 생성한다.

### Source Code (repository root)

```text
src/
├── navigation/
│   ├── FeedbackStackNavigator.tsx          # history/detail 중첩 stack
│   ├── MainTabNavigator.tsx                # Feedback tab에 stack 연결
│   └── types.ts                            # nested typed params와 semantic section
├── screens/
│   ├── feedback/
│   │   ├── FeedbackWebScreen.tsx           # 기존 FeedbackScreen의 WebView 상세 책임
│   │   ├── components/                     # WebView loading/error와 message/back 보조 UI
│   │   └── history/
│   │       ├── FeedbackHistoryScreen.tsx   # 두 탭과 독립 request state 조합
│   │       └── components/
│   │           ├── FeedbackHistoryTabs.tsx
│   │           ├── MockExamTrendCard.tsx
│   │           ├── MockExamHistoryItem.tsx
│   │           ├── GradeBadge.tsx
│   │           ├── ReanswerProgressBanner.tsx
│   │           └── HistoryStatusView.tsx
│   ├── mock-exam/GradingWaitScreen.tsx     # 채점 완료 direct detail caller
│   └── reanswer/ReanswerScreen.tsx          # 재답변 완료 question detail caller
├── features/exam/
│   ├── api/
│   │   ├── exam-history.ts                 # 시험 이력 endpoint
│   │   └── exam-reanswer-history.ts        # 재답변 이력 endpoint
│   ├── map-exam-history.ts
│   ├── map-exam-reanswer-history.ts
│   ├── use-exam-history.ts
│   ├── use-reanswer-history.ts
│   ├── reanswer-progress.ts                # 순수 달성률 계산/표시 값
│   └── toeic-speaking-level.ts             # level→grade band 단일 mapping
├── types/exam.ts                            # raw/domain 이력 타입
└── theme/
    ├── tokens.js                            # grade badge와 banner 의미 token
    └── index.ts                             # JS style용 typed token export

public/icons/chart.png                       # 원본 입력; 구현 시 최적화된 정적 asset으로 교체
```

홈·마이페이지의 파라미터 없는 피드백 진입점도 nested history root 계약에 맞춰 확인한다. 실제 파일명과 컴포넌트 분리는 태스크 생성 시 기존 변경과 충돌 여부를 다시 확인하되, 계층 책임은 위 구조를 유지한다.

**Structure Decision**: 단일 Expo 앱 구조를 유지한다. history UI는 screen 계층, 서버 정규화와 계산은 `features/exam`, route 계약은 `navigation`, 공용 색은 `theme`에 둔다. 백엔드 코드는 이 저장소에 추가하지 않고 필요한 외부 계약만 문서화한다.

## Complexity Tracking

Constitution 위반 없음. 새 상태 관리 provider, 차트 패키지, 로컬 DB 또는 별도 native module을 추가하지 않는다.
