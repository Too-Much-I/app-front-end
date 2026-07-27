# Quickstart Validation: 모의고사 답변 녹음 및 업로드

## Prerequisites

- pnpm 11.12.0
- iOS와 Android 실기기 또는 각 플랫폼에서 microphone/audio interruption을 재현할 수 있는 환경
- 기기에서 접근 가능한 application API base URL
- upload URL, S3 PUT, submit, question status를 확인할 수 있는 test backend
- 마이크 권한과 네트워크 상태를 변경할 수 있는 기기 설정

`localhost`는 실기기에서 개발 머신을 가리키지 않는다. `.env.local`에는 기기가 접근 가능한
LAN 주소 또는 test server 주소를 사용한다. `EXPO_PUBLIC_*` 값은 공개 값으로 취급한다.

## Setup and Static Validation

```sh
pnpm install
cp .env.local.example .env.local
pnpm lint
pnpm exec tsc --noEmit
pnpm start
```

구현 후 `git diff --check`도 실행한다. 새 dependency와 lockfile 변경이 없어야 한다.

## Scenario 1 — Happy Path

1. 마이크/음향 테스트를 통과하고 시험 시작을 누른다.
2. 서버에서 실제 exam session이 한 번만 생성되는지 확인한다.
3. 한 문항을 제한 시간 전에 완료한다.
4. 답변 중 파형이 실제 마이크 입력에 100ms 간격으로 반응하는지 확인한다.
5. 다음 문항은 즉시 진행되고 이전 답변은 별도로 처리되는지 확인한다.
6. backend에서 같은 examId/questionNumber/retryCount=0으로 upload URL, PUT, submit 순서를 확인한다.
7. 11개 문항을 완료하고 마지막 processing barrier가 모든 submit 성공 뒤 completed가 되는지 확인한다.

Expected:

- 문항마다 finalized file과 Submission Job이 정확히 하나다.
- 준비/안내 음성은 답변 파일에 포함되지 않는다.
- 마이크 테스트와 답변 파형은 같은 metering 반응을 사용하되 서로 다른 bar layout을 유지한다.
- 답변 시작/종료 상태는 1초 안에 갱신된다.
- 성공한 답변의 local cache file은 삭제된다.

## Scenario 2 — Finish Race

1. 답변 제한 시간이 끝나는 순간 완료 버튼을 연속해서 누른다.
2. native finish event, fallback timeout, 버튼 event를 모두 발생시킨다.

Expected:

- native stop, finalized URI, registry registration, submit 흐름이 각각 한 번이다.
- 다음 문항에는 새 URI와 새 Answer Key가 연결된다.

## Scenario 3 — Interruption and Same-Question Retry

iOS와 Android에서 각각 다음을 시험한다.

- Home/background 전환
- iOS inactive/control center
- 전화 또는 알람
- screen lock
- headset/Bluetooth route 변화
- prepare 직후 즉시 화면 이탈

Expected:

- finalize intent 전에 중단된 현재 부분 녹음은 submission registry에 들어가지 않고 삭제된다.
- foreground 복귀 뒤 자동 녹음 재개가 없다.
- 같은 문항과 retryCount=0으로 전체 답변 시간을 다시 시작할 수 있다.
- 이전 문항의 registry job은 현재 interruption과 독립적으로 유지된다.

완료 버튼을 먼저 누른 직후 background로 이동하는 반대 순서도 별도로 시험한다.

Expected:

- 먼저 기록된 finalize intent를 AppState event가 discard로 바꾸지 않는다.
- stop과 파일 검증이 성공하면 같은 답변을 registry에 등록하고 foreground 복귀 후 진행한다.
- stop 또는 파일 검증이 실패한 경우에만 같은 문항 재녹음을 안내한다.

## Scenario 4 — Permission and File Failures

1. 시험 전후에 microphone permission을 거부·철회한다.
2. can-ask-again true/false 상태를 각각 확인한다.
3. no URI, missing file, zero-byte file을 개발 환경에서 유도한다.

Expected:

- response 시간이 recorder 시작 전에 줄지 않는다.
- 제출 성공으로 표시하거나 registry에 invalid file을 넣지 않고 현재 문항을 유지한다.
- 설정 이동 또는 같은 문항 재시도 행동을 제공한다.
- 열린 recorder와 recording audio mode가 남지 않는다.

## Scenario 5 — Stage-Aware Network Retry

각 단계를 독립적으로 실패시킨다.

1. upload URL GET의 timeout/5xx/4xx
2. S3 PUT의 timeout, 5xx, 403, presigned expiry
3. submit POST의 timeout/5xx
4. question status 조회 실패

Expected:

- retryable 오류만 bounded backoff로 재시도한다.
- PUT retry가 이미 내부에서 수행되면 바깥 runner가 중첩 6회 loop를 만들지 않는다.
- 다음 문항은 진행 가능하다.
- fileKey가 생긴 뒤에는 upload가 아니라 submit/status 단계에서 재개한다.
- local file은 최종 submit 접수 전까지 유지된다.

## Scenario 6 — Ambiguous Submit

1. 서버가 submit을 접수한 뒤 client 응답만 끊는다.
2. client가 같은 Answer Key로 question status를 조회하는지 확인한다.
3. status가 `PENDING` 또는 `PROCESSING`이면 POST를 중복 호출하지 않는지 확인한다.
4. 현재 status contract가 어떤 응답을 명확한 미접수로 표현하는지 확인한다.
5. backend가 같은 tuple/fileKey의 반복 submit을 하나로 처리하고 기존 상태를 반환하는지 확인한다.
6. 같은 Answer Key에 다른 fileKey가 오면 conflict로 거부하는지 확인한다.

Expected:

- retryCount가 증가하지 않는다.
- 같은 답변의 중복 채점이 없다.
- 결과가 불명확한 동안 fileKey와 local file을 유지한다.
- 미접수 신호와 서버 멱등성이 확인되기 전에는 client가 자동 재-POST하지 않는다.

## Scenario 7 — Final Barrier and Manual Recovery

1. 마지막 문항까지 하나의 이전 job을 pending으로 유지한다.
2. 마지막 답변을 종료한다.
3. pending 상태에서 completed로 이동하지 않는지 확인한다.
4. 하나의 job을 terminal failed로 만들고 retry action을 실행한다.

Expected:

- registry의 registered count와 expected question count가 모두 맞아야 완료된다.
- 실패 job은 fileKey 유무에 따라 submit 또는 upload 단계부터 이어간다.
- 모든 job 성공 뒤에만 completed가 된다.

## Scenario 8 — Disposal

1. S3 PUT 또는 retry wait 중 시험 화면을 이탈한다.
2. 화면을 다시 mount하거나 다른 audio 화면을 연다.

Expected:

- active request와 wait timer가 취소된다.
- unmount 뒤 React state update가 없다.
- native file read가 끝난 뒤 registry 소유의 남은 임시 파일이 정리된다.
- stale cleanup이 새 화면의 global audio mode를 덮어쓰지 않는다.

## Platform-Specific Checks

### iOS

- 녹음 종료 뒤 문제/안내 음성이 speaker로 정상 재생되고 earpiece로 라우팅되지 않는다.
- silent switch 상태에서도 앱 안내 음성이 정책대로 재생된다.
- interruption 뒤 recorder가 자동 resume한 것처럼 보여도 답변 상태는 interrupted로 유지된다.

### Android

- RECORD_AUDIO 거부와 다시 묻지 않음 상태를 구분한다.
- 전화/알람/audio focus 변화 중 partial file이 제출되지 않는다.
- iOS 전용 background upload 동작에 의존하지 않고 foreground 복귀에서 registry runner가 재개된다.

## Completion Evidence

- `pnpm lint` 결과
- `pnpm exec tsc --noEmit` 결과
- iOS/Android 기기와 OS version
- 각 실패 단계의 screen recording 또는 로그
- 문항별 `(examId, questionNumber, retryCount, fileKey)` request trace
- duplicate submit 0건과 final barrier 성공 기록

## Validation Record — 2026-07-27

### Completed in this workspace

- `pnpm lint`: exit 0. 변경 범위 밖인 `src/screens/home/HomeScreen.tsx:69`의 기존 미사용
  `DebugGrid` warning 1건이 남아 있다.
- `pnpm exec tsc --noEmit`: exit 2. 같은 기존 `DebugGrid`의 TS6133 한 건만 보고했으며 해당
  파일은 이번 diff에 포함되지 않는다.
- `pnpm exec tsc --noEmit --noUnusedLocals false`: exit 0. 위 기존 미사용 선언 검사를 제외한
  strict TypeScript 검증은 통과했다.
- `git diff --check`: exit 0.
- `package.json`과 `pnpm-lock.yaml` 변경 없음.
- iOS booted simulator와 ADB attached device를 조회했으나 연결된 기기가 없었다.
- `.env.local`에 `EXPO_PUBLIC_API_BASE_URL`이 구성되어 있지 않았다.

### Not executable in this workspace

- Scenario 1–8의 마이크 녹음, AppState/audio interruption, 실제 S3 PUT과 submit/status trace는
  연결된 iOS/Android 기기와 test backend가 없어 실행하지 못했다.
- 서버의 동일 Answer Key/fileKey 멱등 처리와 명확한 미접수 응답도 확인하지 못했다. 따라서
  client는 `submission-unknown` 상태에서 status reconciliation만 수행하고 자동 submit
  재-POST는 활성화하지 않은 상태다.
