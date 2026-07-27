# Implementation Plan: 모의고사 답변 녹음 및 업로드

**Branch**: `feat/#9` | **Date**: 2026-07-27 | **Spec**: [spec.md](spec.md)

**Approval**: Draft plans MUST be approved before tasks or implementation begin.

**Input**: Feature specification from `/specs/001-record-upload-answer/spec.md`

## Summary

실제 서버에서 생성한 모의고사 세션의 각 답변 구간을 Expo 네이티브 오디오로 녹음하고,
문항별 제출 작업을 다음 문항 진행과 독립적으로 처리한다. 녹음 생명주기와 keyed
submission registry를 별도 상태 머신으로 분리해 중복 종료·중복 제출을 막고, 중단된 부분
녹음은 즉시 폐기한 뒤 같은 문항을 다시 녹음한다. 마지막 문항에서는 모든 문항의 업로드와
채점 요청이 성공할 때까지 완료를 확정하지 않는다.

## Technical Context

**Language/Version**: strict TypeScript 6.0, React 19.2, React Native 0.86

**Primary Dependencies**: Expo SDK 57, `expo-audio` 57, `expo-file-system` 57,
React Navigation 7, React hooks/reducer. 새 의존성은 추가하지 않는다.

**Storage**: 녹음 중 및 재시도 중에는 Expo cache의 m4a 파일, 실행 중 제출 상태는
`ExamSessionScreen` 수명에 한정된 메모리, 서버 측 저장소는 presigned URL이 가리키는 S3

**Testing**: `pnpm lint`, `pnpm exec tsc --noEmit`, iOS/Android 실기기 수동 검증.
자동 테스트 러너는 현재 없다.

**Target Platform**: Expo 57이 지원하는 iOS 및 Android 휴대폰·태블릿

**Project Type**: Expo React Native mobile application

**Performance Goals**: 녹음 시작·종료 상태를 1초 이내 표시하고, 100ms 간격 미터링으로
파형을 갱신하며, 이전 문항의 네트워크 작업이 다음 문항 UI와 녹음을 막지 않게 한다.

**Constraints**: 한 번에 활성 녹음기는 하나, 답변은 m4a/AAC-LC 44.1kHz mono 96kbps,
S3 PUT 한 번당 15초 제한, presigned URL 만료 준수, 문항별 최대 한 제출 작업, OS가 앱
프로세스를 종료한 뒤에도 이어지는 영속 백그라운드 업로드는 범위 밖이다. 모호한 submit의
자동 재-POST는 서버의 명확한 미접수 신호와 Answer Key/fileKey 멱등성 검증을 선행한다.

**Scale/Scope**: 정규 모의고사 11문항, 문항당 최대 60초·약 720KB, 활성 녹음 1개와
최대 11개의 실행 중/완료 제출 항목, 화면 3개와 feature/API 계층 중심의 변경

## Constitution Check

*GATE: Phase 0 시작 전 검사 결과 — 모두 통과.*

- [x] The specification is approved and separates facts, assumptions, scope, out-of-scope behavior, and open questions.
- [x] Acceptance criteria describe observable behavior and include failure or interruption paths.
- [x] The design uses Expo/React Native APIs and preserves strict TypeScript and existing architectural boundaries.
- [x] Existing shared UI, theme, navigation, API, mapper, and domain layers are reused where applicable.
- [x] At least two viable approaches were considered, or the plan explains why only one approach is practical.
- [x] The validation plan includes `pnpm lint`, `pnpm exec tsc --noEmit`, and relevant manual or device checks.
- [x] No secret or unapproved Jira write, commit, push, dependency addition, or other external side effect is required.

## Current Flow

1. `MockExamReady → MicrophoneTest → SoundTest` 순서로 기기 확인 화면을 지난다.
2. `SoundTestScreen`은 이미 존재하는 `createExamSession()` API를 사용하지 않고
   `createMockExamSession()`으로 만든 mock `examId`와 문항을 `ExamSession`에 전달한다.
3. `ExamSessionScreen`은 `directions → preparation → response`를 버튼으로 전환하지만,
   남은 시간은 초기값으로 고정되어 있고 실제 녹음이나 자동 종료가 없다.
4. response 화면의 24개 파형 막대는 고정 높이이며 마이크 입력과 연결되지 않는다.
   마이크 테스트에는 이미 100ms metering, dB 정규화, smoothing 파형이 있지만 hook과
   화면에 결합되어 시험 답변에서 재사용할 수 없다.
5. 마지막 문항에서 `handleNextPhase`는 아무 동작도 하지 않아 완료 상태나 다음 화면이 없다.
6. `exam-answer-upload.ts`에는 업로드 URL 발급 → S3 PUT → submit 흐름과 PUT 재시도가
   구현되어 있지만 호출자가 없다. submit 실패 시 `fileKey`를 보존하지 않아 안전한 단계별
   재시도와 최종 완료 장벽을 만들 수 없다.
7. 도메인 문항은 `questionNumber`만 제공하지만 기존 업로드 함수는 `questionId: string`을
   받아 식별자 의미가 불명확하다.
8. `apiFetch()`는 자체 timeout signal로 호출자의 signal을 덮어써 화면 이탈 시 API 요청을
   취소할 수 없다.

## Design Options

### Option A - 화면 안에서 녹음과 fire-and-forget 업로드

`ExamSessionScreen`에서 recorder, timeout, 업로드 Promise를 직접 관리하고 기존
`uploadExamAnswer()`를 문항마다 호출한다.

- 장점: 파일 수와 초기 diff가 작다.
- 비용: 화면 phase, 네이티브 recorder, 파일 소유권, 네트워크 재시도가 하나의 컴포넌트에
  결합된다.
- 실패 모드: timeout과 버튼의 중복 stop, 이전 Promise가 다음 문항 식별자를 참조하는 race,
  submit 실패 시 재업로드와 고아 객체, 마지막 문항에서 오래된 Promise snapshot을 기다리는
  문제가 생긴다.

### Option B - 녹음 상태 머신 + keyed submission registry/runner

`useAnswerRecorder`가 권한·오디오 모드·단일 녹음·파일 확정/폐기만 소유하고,
`useAnswerSubmissions`가 불변 답변 키별 업로드·submit·재시도·파일 정리와 집계 상태를
소유한다. 화면 controller는 시험 phase와 두 상태 머신 사이의 이벤트만 연결한다.

- 장점: 중단 정책, single-flight, 단계별 재시도, 다음 문항 비차단 진행, 마지막 완료 장벽을
  각각 독립적으로 검증할 수 있다.
- 비용: reducer와 내부 contract가 추가되고 상태 전환을 명시적으로 유지해야 한다.
- 실패 모드: client 메모리 상태는 앱 프로세스 종료 후 복원되지 않는다. 이번 범위에서는
  OS 백그라운드 실행을 약속하지 않고 foreground 복귀 시 재개한다.

### Option C - 전역 영속 제출 큐와 OS 백그라운드 작업

Zustand/persistent storage와 플랫폼별 background task로 제출을 화면 밖과 앱 재실행 뒤에도
이어간다.

- 장점: 프로세스 종료 복구 가능성을 확장할 수 있다.
- 비용: iOS/Android 업로드 실행 보장이 다르고, 파일·자격 URL·세션 복구 정책 및 새 native
  구성이 필요하다.
- 실패 모드: 플랫폼별로 다른 완료 보장과 오래된 시험 작업 누수가 생기며 현재 승인 범위를
  크게 넘는다.

## Decision

Option B를 채택한다.

1. `SoundTestScreen`은 시험 시작 시 기존 `createExamSession()`을 호출하고, 성공한 실제
   `examId`와 문항만 `ExamSession`으로 넘긴다. 실패하면 시험을 시작하지 않고 재시도를
   제공한다.
2. `useAnswerRecorder`는 mic test와 별도 상태 머신으로 만든다. 두 기능은 background
   정책이 반대이므로 lifecycle 전체를 공용화하지 않는다. 녹음 옵션과 순수 metering 변환은
   `answer-audio.ts`로, smoothing과 막대 렌더링은 `AudioWaveform`으로 추출해 두 화면에서
   공유한다. 답변 recorder는 raw `meteringDb`만 노출하고 파형은 유효성 판정에 사용하지 않는다.
3. recorder는 cache의 m4a/AAC-LC mono 96kbps 파일을 만들고, native
   `record({ forDuration })`를 제한 시간의 hard cutoff로 사용한다. status event와 JS
   fallback이 모두 같은 generation별 terminal Promise로 들어가 stop/finalize를 한 번만
   수행한다.
4. preparation timer는 wall clock 기준으로, response timer와 파형은 recorder의 실제
   `durationMillis`와 metering을 기준으로 표시한다. prepare/permission/audio mode 설정이
   끝나 실제 record가 시작된 뒤에만 response 시간을 차감한다.
5. AppState 이탈과 정상 종료가 경쟁하면 generation에 먼저 기록된 terminal intent를 따른다.
   inactive/background가 먼저면 부분 파일을 폐기하고 같은 문항 전체 시간을 다시 녹음한다.
   사용자 완료·native 제한 시간이 먼저 finalize를 확정했다면 뒤이은 AppState 변화가 이를
   discard로 덮지 않으며, stop과 파일 검증이 성공하면 registry에 등록한다. screen
   blur/unmount로 controller 자체가 dispose되면 ownership 이전 전 파일은 정리한다.
6. 확정된 URI는 `{ examId, questionNumber, retryCount }` 키와 함께 submission registry로
   소유권을 이전한다. 초기 응시와 중단 후 재녹음은 모두 `retryCount = 0`이며 네트워크
   재시도 때문에 이 값을 증가시키지 않는다.
7. 기존 모놀리식 업로드 파일은 upload URL endpoint, S3 transfer, submit endpoint,
   registry/runner orchestration으로 분리한다. PUT 성공 후 `fileKey`를 보존해 submit 재시도는
   같은 파일 키로만 수행한다.
8. submit 응답이 유실된 모호한 실패에서는 `getExamQuestionStatus`로 먼저 조정하고,
   `PENDING/PROCESSING/COMPLETED`이면 접수 성공, `FAILED`이면 처리 실패로 확정한다. 현재
   status 타입에는 명시적인 미접수 값이 없으므로 불명확한 조회 실패에서 자동 재-POST하지
   않는다. 같은 `(examId, questionNumber, retryCount, fileKey)`의 반복 submit을 멱등 처리하고
   명확한 미접수 신호를 반환하는 서버 contract가 통합 검증된 뒤에만 자동 재-submit한다.
9. 다음 문항 전환은 유효 파일을 registry에 등록한 시점에 허용한다. 파일이 없거나 0 byte면
   현재 문항에 머물러 전체 답변 시간을 다시 녹음한다. 파일은 유효하지만 등록이 실패하면
   재녹음하지 않고 같은 파일의 등록을 재시도한다. 실제 네트워크 작업은 인앱
   background에서 계속되며 AppState suspension 뒤에는 foreground에서 재개한다.
10. registry는 FIFO가 아니며 문항 key별 job과 single-flight runner를 보관한다. 한 job의
    retry wait가 다른 job을 막지 않는다. 마지막 문항은 등록 뒤 `awaitingSubmissions`로
    전환한다. 예상 답변 수와 성공 항목 수가 같을 때만 `completed`가 되며, 소진된 실패가
    있으면 해당 단계부터 수동 재시도할 수 있다. 별도 결과/피드백 화면 추가는 하지 않는다.
11. 로컬 파일은 submit 접수 성공 뒤 삭제한다. 재시도 가능한 실패에서는 유지하고,
    중단·screen leave·session dispose에서는 실행 중 파일 읽기가 끝난 뒤 best-effort로
    삭제한다.
12. `apiFetch`는 내부 timeout과 호출자 cancellation signal을 합성해 화면 이탈 시 endpoint
    요청과 retry wait를 함께 중단할 수 있게 한다.

## Failure and Recovery Paths

| Failure or interruption | Required state/result | Recovery |
|---|---|---|
| 마이크 권한 없음 | response를 시작하지 않고 `permission-denied` | 설정 이동 또는 권한 재확인 후 같은 문항 시작 |
| prepare/record 실패 | 제출 항목을 만들지 않고 `recording-error` | cleanup 후 같은 문항 재시도 |
| finalize intent 전 app inactive/background 또는 recorder reset | 부분 파일 삭제, `interrupted` | foreground에서 같은 문항 전체 시간 재녹음 |
| finalize intent 후 app inactive/background | finalize 유지, 유효 파일 검증 | registry 등록 후 foreground에서 진행 상태 복구 |
| 사용자 완료와 native timeout 경쟁 | 같은 terminal Promise 결과 하나 | 첫 terminal intent만 확정하고 중복 이벤트 무시 |
| URI 없음·파일 없음·0 byte | recording finalization 실패, 현재 문항 유지 | 업로드하지 않고 전체 시간으로 같은 문항 재시도 |
| upload URL/PUT 일시 실패 | `retry-wait(upload)`, 로컬 파일 유지 | 만료 전 URL 재사용, 만료 후 새 URL로 유한 backoff |
| upload 4xx 등 비재시도 오류 | `failed(upload)` | 다음 문항은 진행, 마지막 장벽에서 수동 재시도 |
| submit timeout/응답 유실 | `submission-unknown`, `fileKey` 유지 | 문항 상태 조정; 서버 멱등성/미접수 계약 확인 전 재-POST 금지 |
| submit 접수 후 채점 `FAILED` | `failed(submit)` | 자동 중복 submit하지 않고 마지막 장벽에서 오류 표시 |
| 이전 제출 중 다음 녹음 시작 | 두 상태 머신 독립 | recorder는 새 URI, registry는 불변 답변 key 유지 |
| 마지막 문항에 pending/failed 존재 | `awaitingSubmissions` | 성공까지 대기하거나 실패 항목을 단계별 재시도 |
| 화면/session 이탈 | controller dispose, 요청·timer 취소 | native/network 정리 후 소유 중인 임시 파일 삭제 |

## Developer Explain-Back

- [x] The affected files and their responsibilities can be explained.
- [x] The changed data and state transitions can be described in order.
- [x] The selected tradeoffs and rejected alternatives can be explained.
- [x] The validation and rollback approach can be explained.

## Project Structure

### Documentation (this feature)

```text
specs/001-record-upload-answer/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── recording-contract.md
│   └── submission-contract.md
└── tasks.md                 # $speckit-tasks에서만 생성
```

### Source Code (repository root)

```text
src/
├── features/exam/
│   ├── api/
│   │   ├── exam-answer-upload-url.ts    # upload URL endpoint
│   │   └── exam-answer-submit.ts        # submit endpoint
│   ├── answer-audio.ts                  # shared recording options/audio modes/pure metering
│   ├── upload-answer-audio.ts           # S3 PUT + bounded retry
│   ├── use-answer-recorder.ts           # native recording lifecycle
│   └── use-answer-submissions.ts        # keyed registry/runners/reducer/final barrier
├── lib/api/client.ts                    # caller cancellation + timeout composition
├── screens/mock-exam/
│   ├── ExamSessionScreen.tsx            # state wiring and presentation
│   ├── MicrophoneTestScreen.tsx          # shared AudioWaveform consumer
│   ├── SoundTestScreen.tsx              # real session creation
│   ├── components/
│   │   ├── AudioWaveform.tsx             # shared metering smoothing/presentation
│   │   ├── ExamAnswerStatus.tsx         # interrupted/pending/failed/completed UI
│   │   └── ExamTimerCard.tsx
│   └── hooks/
│       ├── use-exam-session-controller.ts
│       └── use-microphone-test.ts        # keeps mic-test-specific lifecycle/playback
└── types/exam.ts                        # answer/submission domain types as needed

docs/
└── answer-audio-recording-format.md     # resolved retry/lifecycle notes
```

**Structure Decision**: 기존 단일 Expo 앱 구조를 유지한다. 네이티브/도메인 작업은
`src/features/exam/`, endpoint는 `api/`의 one-endpoint-per-file 규칙, 시험 phase와
화면 이벤트 연결은 screen hook, 사용자 표현은 screen component에 둔다.

## Post-Design Constitution Check

- [x] Approved spec and all selected product policies are reflected in state transitions.
- [x] Expo-native recording and file APIs are used; browser-only recorder code is not reused.
- [x] Strict TypeScript boundaries and `apiFetch<ApiEnvelope<T>>` endpoint pattern are preserved.
- [x] Existing UI primitives, theme, navigation types, session mapper, timing metadata, and APIs are reused.
- [x] Microphone test and answer recording share only policy-free audio/metering presentation; their opposite interruption policies remain isolated.
- [x] Three approaches and their failure modes are documented.
- [x] Validation covers lint, typecheck, race cases, network failures, and both native platforms.
- [x] No new dependency, Jira write, commit, push, secret, or unapproved external mutation is required.

**Integration Gate**: server idempotency와 명확한 미접수 응답은 client 구현으로 만들 수 없는
외부 계약이다. client는 안전한 `submission-unknown` fallback을 구현하되, test backend에서
이 계약이 확인되지 않으면 자동 재-submit과 feature completion evidence를 통과시키지 않는다.

## Complexity Tracking

Constitution 위반 없음. 별도 예외 정당화가 필요하지 않다.
