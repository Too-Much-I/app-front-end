# Implementation Plan: 실제 채점 연동 통합 피드백

**Branch**: `005-unified-feedback-flow` | **Date**: 2026-07-30 | **Spec**: [spec.md](./spec.md)

**Status**: Awaiting user approval

## Summary

현재 정적 fixture로 채워지는 피드백 탭을 실제 시험 결과 화면으로 전환한다. 채점 완료 화면이 `examId`를 피드백 탭에 전달하고, 피드백 화면은 기존 요약/문항 API와 mapper를 사용한다. `examId`가 없으면 API를 호출하지 않고 `완료된 시험이 없어요` 빈 상태를 보여준다. 문제 상세는 사용자가 Q를 선택할 때 `retryCount=0`으로 지연 조회하며, 향후 다시 답변은 `totalRetryCount`를 다음 회차 키로 사용한다. 홈 최근 피드백 목카드는 유지하고 마이페이지 목 진입 카드와 피드백 fixture는 제거한다.

## Technical Context

**Language/Version**: strict TypeScript `~6.0.3`, React `19.2.3`

**Primary Dependencies**: Expo `~57.0.7`, React Native `0.86.0`, React Navigation 7, NativeWind 4, Reanimated 4, `react-native-svg@15.15.4`

**Data Source**: `GET /api/v1/exams/{examId}/summary`, `GET /api/v1/exams/{examId}/questions?questionNumber=&retryCount=`

**State**: route의 선택적 `examId`, 화면 remote-data 상태, 결과/문항 모드, 스크롤 ref/offset, 칠판 boolean

**Testing**: `pnpm lint`, `pnpm exec tsc --noEmit`, iOS Metro export와 수동 API/기기 검증

**Constraints**: 실제 이력 API 없음, 문제 상세는 최초 회차 `retryCount=0`, 파트 만점은 시험 형식 상수 `6/6/9/9/5`, 홈 최근 피드백 목카드는 유지

## Constitution Check

- [x] 실제 API 연동 명세와 주요 모호성이 사용자에게 승인되었다.
- [x] 기존 `apiFetch → Raw → mapper → domain` 경계를 그대로 사용한다.
- [x] React Native/Expo API, 공용 UI, safe area와 typed navigation을 유지한다.
- [x] 새 의존성 없이 기존 AbortController lifecycle 패턴을 재사용한다.
- [x] 빈 상태, 로딩, 오류, 재시도, 늦은 응답과 부분 점수를 다룬다.
- [x] 홈 목카드 유지와 마이페이지 목카드 제거 범위가 구분되어 있다.
- [x] lint, typecheck, 번들 및 수동 API 검증이 계획되어 있다.

## Current Flow

1. `GradingWaitScreen`은 완료된 `examId`를 가지고 있지만 매개변수 없이 `Feedback` 탭으로 이동한다.
2. `FeedbackScreen`은 `mockGradingResult`와 `mockQuestionDetails`를 직접 읽는다.
3. 요약 및 문제 상세 API와 mapper는 이미 구현되어 있으나 피드백 UI에서 사용하지 않는다.
4. 피드백 탭, 홈 목카드와 마이페이지 목카드는 매개변수 없이 피드백 화면으로 이동한다.
5. 파트 상태와 만점 40점은 fixture 전용 표현값이다.

## Target Data Flow

```text
GradingWait(examId)
  → Feedback route { examId }
  → getExamGradingResult(examId)
  → mapExamGradingResult
  → ExamGradingResult
  → part view model (max 6/6/9/9/5 + derived status)
  → result UI

Part Q 선택
  → getExamQuestionFeedback(examId, questionNumber, 0)
  → mapExamQuestionDetail
  → ExamQuestionDetail
  → question UI

Feedback route without examId
  → no API call
  → empty state → MockExam tab
```

## Design Options

### Option A — 화면 전용 native hooks + optional route param

- `Feedback` 탭 param을 `{ examId: string } | undefined`로 타입화한다.
- 화면 전용 hooks가 요약/문항 요청의 idle/loading/success/error와 AbortController를 관리한다.
- 장점: 기존 앱 패턴과 일치하며 Provider 추가가 없고 요청 취소가 명확하다.
- 비용: 간단한 remote-data 상태 코드를 직접 작성한다.

### Option B — TanStack Query Provider 추가

- App root에 QueryClientProvider를 추가하고 두 API를 query로 호출한다.
- 장점: 캐시, 재시도와 중복 제거가 내장된다.
- 비용: 이번 범위에 없는 전역 캐시 정책과 Provider lifecycle까지 결정해야 한다.

### Option C — 마지막 examId 전역/로컬 저장

- 피드백 탭이 param 없이도 최근 ID를 복원한다.
- 장점: 탭 재진입 편의성이 높다.
- 비용: 실제 이력/권한/삭제 계약 없이 오래된 결과를 최신처럼 보일 수 있고 승인된 빈 상태와 충돌한다.

## Decision

Option A를 선택한다. 실제 API 연결은 화면 전용 hooks와 기존 mapper로 제한한다. `examId`가 없는 경우는 네트워크 요청 없이 빈 상태를 보여준다. 요약 성공 뒤 파트 Q 목록은 `totalSolvedQuestions`와 정규 문제 구성을 사용하며, 문제 상세는 선택 시에만 호출한다. 파트 만점은 사용자가 확정한 시험 형식 상수 `6/6/9/9/5`를 feature metadata로 중앙화한다.

## Remote State and Failure Paths

- 요약: `idle | loading | success | error`; `examId` 변경 시 이전 요청 abort 및 상태 초기화.
- 문항: 선택 없음 또는 `loading | success | error`; 다른 Q/결과 화면 전환 시 이전 요청 abort.
- 요약 오류: 전체 결과 대신 재시도 버튼과 모의고사 이동 제공.
- 문항 오류: 선택 파트/Q를 유지하고 재시도 또는 결과로 돌아가기 제공.
- 늦은 응답: abort signal과 요청 key 일치 검증으로 현재 상태를 덮어쓰지 못하게 한다.
- 부분 응시: `totalSolvedQuestions` 이하 Q만 노출하고 없는 part score는 `점수 없음` 처리.
- 잘못된 점수: `0 ≤ score ≤ max`가 아니면 그래프 데이터에서 null 처리.
- 직접 탭 진입: `examId`가 없으므로 API 0회, 빈 상태 CTA는 `MockExam` 탭 이동.
- 다시 답변: 이번 작업에서 녹음 UI는 만들지 않지만 다음 AnswerKey는 `retryCount=totalRetryCount`; 전송 재시도는 동일 key 유지.

## Project Structure

```text
src/
├── features/exam/
│   ├── api/exam-question-feedback.ts       # AbortSignal 지원
│   ├── part-meta.ts                        # 파트 만점 상수
│   ├── use-exam-grading-result.ts          # 요약 remote state
│   └── use-exam-question-feedback.ts       # 문항 remote state
├── navigation/types.ts                     # optional Feedback param
└── screens/
    ├── feedback/
    │   ├── FeedbackScreen.tsx              # route + UI composition
    │   ├── feedback-assets.ts              # 실제 UI 사용 마스코트만
    │   ├── feedback-view-model.ts           # 실제 result 기반
    │   ├── mocks/feedback-result.ts         # 삭제
    │   └── components/
    │       ├── FeedbackEmptyState.tsx
    │       ├── FeedbackLoadingState.tsx
    │       ├── FeedbackErrorState.tsx
    │       └── QuestionFeedbackView.tsx
    ├── mock-exam/GradingWaitScreen.tsx      # examId 전달
    └── my-page/MyPageScreen.tsx             # 목 진입 카드 제거
```

## Validation Plan

1. param 없는 피드백 탭에서 API 호출 없이 빈 상태와 모의고사 CTA 확인.
2. 채점 완료 뒤 전달된 examId로 실제 요약 내용 확인.
3. Q 선택 시 query의 `retryCount=0`, 로딩/성공/오류/재시도 확인.
4. 빠른 Q 전환에서 늦은 응답이 현재 Q를 덮어쓰지 않는지 확인.
5. 문제 상세 복귀 위치와 칠판 boolean 유지 확인.
6. 부분 응시/누락 점수와 `6/6/9/9/5` 그래프 정규화 확인.
7. 마이페이지 목 카드 제거 및 홈 최근 피드백 목카드 유지 확인.
8. `pnpm lint`, `pnpm exec tsc --noEmit`, iOS Metro export 실행.

## Developer Explain-Back

- [ ] `examId → summary mapper → result UI` 흐름을 설명할 수 있다.
- [ ] Q 선택과 `retryCount=0`, abort, 늦은 응답 방지를 설명할 수 있다.
- [ ] 파트 만점 `6/6/9/9/5`가 fixture가 아닌 시험 형식 메타데이터인 이유를 설명할 수 있다.
- [ ] param 없는 빈 상태와 홈 목카드 유지 범위를 설명할 수 있다.
- [ ] 다시 답변과 전송 재시도의 retryCount 차이를 설명할 수 있다.

## Post-Design Constitution Check

- [x] 실제 API boundary와 mapper가 UI로 누출되지 않는다.
- [x] navigation param과 화면 상태가 strict TypeScript로 표현된다.
- [x] 요청 취소, 빈 상태, 오류/재시도와 접근성 레이블이 설계에 포함된다.
- [x] 범위 밖 이력 저장, 홈 목카드 제거와 다시 답변 녹음 구현을 추가하지 않는다.
- [x] 검증 및 롤백 범위가 파일 단위로 분리되어 있다.

## Complexity Tracking

헌법 위반은 없다. TanStack Query가 설치되어 있지만 앱에 Provider/캐시 정책이 없으므로 이번 두 요청만을 위해 전역 인프라를 추가하지 않고 기존 effect/AbortController 패턴을 따른다.
