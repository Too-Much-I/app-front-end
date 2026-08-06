# Implementation Plan: 모의고사 답변 녹음 및 업로드

**Branch**: `feat/#9` | **Date**: 2026-07-28 | **Spec**: [spec.md](spec.md)

**Approval**: Draft plans MUST be approved before tasks or implementation begin.

**Input**: Feature specification from `/specs/001-record-upload-answer/spec.md`

## Summary

실제 서버에서 생성한 모의고사 세션의 각 답변 구간을 Expo 네이티브 오디오로 녹음하고,
문항별 제출 작업을 다음 문항 진행과 독립적으로 처리한다. 녹음 생명주기와 keyed
submission registry를 별도 상태 머신으로 분리해 중복 종료·중복 제출을 막고, 중단된 부분
녹음은 즉시 폐기한 뒤 같은 문항을 다시 녹음한다. S3 PUT과 서버 고지는 독립된 단계로
재시도하고 각각 jitter를 적용한다. 서버에 없는 문항 상태 조회와 URL 재발급 가정을 제거하며,
최종 실패 화면에는 `public/mascots/error.png`와 홈 이동을 제공한다.

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
프로세스를 종료한 뒤에도 이어지는 영속 백그라운드 업로드는 범위 밖이다. S3 PUT은 기존
presigned URL로 최초 요청 이후 최대 5회, 서버 고지는 같은 Answer Key/fileKey로 최대 3회
추가 재시도한다. 서버는 동일한 고지를 중복 채점 없이 처리해야 한다.

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

1. 답변 녹음과 문항별 submission registry, 다음 문항 비차단 진행 및 마지막 완료 장벽은
   이미 구현되어 있다.
2. `uploadAnswerAudio()`는 S3 PUT을 같은 URL로 최대 5회 추가 재시도하지만 대기 시간이
   `1s, 2s, 4s, 8s, 16s`로 고정되어 있다.
3. runner의 바깥 upload loop는 URL 발급과 PUT을 함께 반복한다. 따라서 PUT 403/만료 또는
   일부 오류 뒤 같은 URL을 보존하지 않고 upload URL endpoint를 다시 호출할 수 있다.
4. 서버 고지 실패는 `submission-unknown → reconciling`으로 전환해 실제 서버에 없는
   `questions/status` endpoint를 호출한다. 고지 자체의 bounded retry는 없다.
5. `SubmissionJob`은 PUT 성공 뒤의 `fileKey`만 보존하고 PUT 전의 upload URL과 만료 시각은
   보존하지 않아 같은 target으로 runner를 재개할 수 없다.
6. 최종 실패 UI는 문항별 작은 오류 카드와 상태 조회/단계 재시도 버튼만 제공하며,
   `public/mascots/error.png`와 홈 이동 경로가 없다.
7. 현재 `navigation.popToTop()`은 MockExam stack의 준비 화면으로만 돌아가므로 홈 tab 이동은
   상위 tab navigator에 명시적으로 전달해야 한다.

## Design Options

### Option A - 현재 status reconciliation과 URL 재호출 유지

서버 고지 응답이 불명확하면 status endpoint를 조회하고 PUT 오류 뒤 upload URL endpoint를
다시 호출한다.

- 장점: 현재 상태 머신 변경이 가장 작다.
- 비용: 존재하지 않는 endpoint와 재발급 계약을 계속 가정한다.
- 실패 모드: 모든 고지 실패가 status 404로 끝나며, PUT 재시도가 새 URL/fileKey를 만들어
  같은 답변의 서버 객체가 갈라질 수 있다.

### Option B - 기존 registry에서 upload target과 고지를 단계별 재시도

현재 keyed registry를 유지하되 최초 upload target을 job에 보존한다. S3 PUT은 같은 target으로
5회, 고지는 같은 fileKey로 3회 추가 재시도하고 두 backoff 모두 jitter를 적용한다.

- 장점: 실제 서버 계약만 사용하며 PUT과 고지 실패가 서로의 단계를 반복하지 않는다.
- 비용: job 필드와 stage 전환, 수동 복구 조건을 갱신해야 한다.
- 실패 모드: presigned URL이 만료되면 재발급 없이 terminal failure가 되며, process kill 뒤
  메모리 job은 복원되지 않는다.

### Option C - S3 PUT만 완료 기준으로 두고 고지는 best-effort 처리

S3 PUT 2xx에서 job을 성공 처리하고 고지 응답은 기다리지 않는다.

- 장점: 클라이언트 상태가 가장 단순하다.
- 비용: 고지가 유실되면 서버가 채점을 시작하지 못한다.
- 실패 모드: 사용자에게 성공으로 보였지만 결과가 생성되지 않는 답변이 생긴다.

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
7. 최초 upload URL 응답의 `uploadUrl`, `fileKey`, 만료 시각을 PUT 전에 job에 저장한다.
   S3 PUT은 같은 target으로만 최초 요청 이후 최대 5회 추가 재시도하고, 만료 뒤에는 새 URL을
   요청하지 않고 terminal upload failure로 끝낸다.
8. S3와 서버 고지의 고정 delay는 equal jitter가 적용된 exponential backoff로 바꾼다.
   S3 base는 `1s, 2s, 4s, 8s, 16s`, 고지 base는 `1s, 2s, 4s`이며 실제 대기는 base의
   50~100%다. caller abort는 모든 wait와 요청을 즉시 중단한다.
9. 다음 문항 전환은 유효 파일을 registry에 등록한 시점에 허용한다. 파일이 없거나 0 byte면
   현재 문항에 머물러 전체 답변 시간을 다시 녹음한다. 파일은 유효하지만 등록이 실패하면
   재녹음하지 않고 같은 파일의 등록을 재시도한다. 실제 네트워크 작업은 인앱
   background에서 계속되며 AppState suspension 뒤에는 foreground에서 재개한다.
10. registry는 FIFO가 아니며 문항 key별 job과 single-flight runner를 보관한다. 한 job의
    retry wait가 다른 job을 막지 않는다. PUT 2xx 뒤 서버 고지는 같은 tuple로 최대
    3회 추가 재시도한다. 고지 실패 때 PUT을 다시 실행하거나 status API를 조회하지 않는다.
11. 로컬 파일은 S3 PUT 성공 뒤 삭제한다. PUT 전 재시도 가능한 실패에서는 유지하고,
    중단·screen leave·session dispose에서는 실행 중 파일 읽기가 끝난 뒤 best-effort로
    삭제한다. 고지 재시도는 Answer Key만 사용한다.
12. `apiFetch`는 내부 timeout과 호출자 cancellation signal을 합성해 화면 이탈 시 endpoint
    요청과 retry wait를 함께 중단할 수 있게 한다.
13. 최종 barrier에서 모든 pending job이 끝났는데 failed job이 있으면
    `ExamAnswerStatus`가 `public/mascots/error.png`, 오류 설명과 홈 버튼을 표시한다.
    retryable failure가 하나라도 있으면 수동 재시도도 함께 제공하고, 일반 4xx만 있으면 홈
    버튼만 제공한다.
14. 홈 버튼은 registry를 dispose하고 MockExam stack을 `MockExamReady`로 정리한 뒤 상위
    `MainTab`의 `Home` route로 이동한다. 뒤로 돌아왔을 때 실패한 시험 화면이나 timer가
    남지 않게 하며 navigation param type은 기존 `MainTabParamList`를 재사용한다.

## Failure and Recovery Paths

| Failure or interruption | Required state/result | Recovery |
|---|---|---|
| 마이크 권한 없음 | response를 시작하지 않고 `permission-denied` | 설정 이동 또는 권한 재확인 후 같은 문항 시작 |
| prepare/record 실패 | 제출 항목을 만들지 않고 `recording-error` | cleanup 후 같은 문항 재시도 |
| finalize intent 전 app inactive/background 또는 recorder reset | 부분 파일 삭제, `interrupted` | foreground에서 같은 문항 전체 시간 재녹음 |
| finalize intent 후 app inactive/background | finalize 유지, 유효 파일 검증 | registry 등록 후 foreground에서 진행 상태 복구 |
| 사용자 완료와 native timeout 경쟁 | 같은 terminal Promise 결과 하나 | 첫 terminal intent만 확정하고 중복 이벤트 무시 |
| URI 없음·파일 없음·0 byte | recording finalization 실패, 현재 문항 유지 | 업로드하지 않고 전체 시간으로 같은 문항 재시도 |
| 최초 upload target 요청 실패 | `failed(upload)` 또는 API 오류 | 새 URL 재발급으로 추정하지 않고 최종 장벽에서 오류 표시 |
| S3 PUT timeout/network/408/429/5xx | `retry-wait(upload)`, URL·로컬 파일 유지 | 같은 URL로 jittered backoff, 최대 5회 추가 |
| S3 PUT 4xx·URL 만료 | `failed(upload)`, 로컬 파일 유지 | 자동/수동 재발급 없이 홈 이동 제공 |
| 서버 고지 timeout/network/408/429/5xx | `retry-wait(notifying)`, fileKey 유지 | PUT 없이 같은 고지를 jittered backoff, 최대 3회 추가 |
| 서버 고지 일반 4xx 또는 처리 `FAILED` | `failed(notify)` | 자동 재시도 없이 error 이미지와 홈 이동 표시 |
| 고지 재시도 소진 | `failed(notify)` | error 이미지, 수동 고지 재시도와 홈 이동 표시 |
| 이전 제출 중 다음 녹음 시작 | 두 상태 머신 독립 | recorder는 새 URI, registry는 불변 답변 key 유지 |
| 마지막 문항에 pending/failed 존재 | `submission-barrier` | pending 종료까지 대기한 뒤 완료 또는 최종 실패 UI |
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
│   │   ├── exam-answer-submit.ts        # upload-complete notification endpoint
│   │   └── exam-question-status.ts      # remove: backend endpoint does not exist
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
│   │   ├── ExamAnswerStatus.tsx         # pending/error mascot/retry/home/completed UI
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

**Integration Gate**: 동일한 `(examId, questionNumber, retryCount, fileKey)` 고지가 중복 채점
작업을 만들지 않는 서버 멱등성은 client 구현으로 만들 수 없는 외부 계약이다. test backend에서
이 계약이 확인되지 않으면 응답 유실 재시도를 안전하다고 간주할 수 없고 feature completion
evidence를 통과시키지 않는다.

## Complexity Tracking

Constitution 위반 없음. 별도 예외 정당화가 필요하지 않다.
