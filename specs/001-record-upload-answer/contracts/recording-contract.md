# Internal Contract: Answer Recording

## Responsibility

`useAnswerRecorder`는 실제 답변 하나의 권한, global audio mode, native recorder,
single-flight 종료, 파일 검증 및 interruption 폐기만 담당한다. 시험 문항 전환과 네트워크
제출은 담당하지 않는다.

## Input

```ts
interface AnswerKey {
  examId: string;
  questionNumber: number;
  retryCount: number;
}

interface StartAnswerRecordingInput {
  key: AnswerKey;
  maxDurationMs: number;
}
```

Rules:

- `start`는 이전 terminal cleanup이 끝난 뒤 실행한다.
- key와 duration은 start generation에 복사해 render 이후 변경되지 않는다.
- 권한과 audio mode/prepare가 준비된 뒤 native record가 시작되어야 성공을 반환한다.

## Observable State

```ts
type AnswerRecordingStatus =
  | "idle"
  | "preparing"
  | "recording"
  | "finalizing"
  | "interrupted"
  | "permission-denied"
  | "error";

interface AnswerRecordingState {
  status: AnswerRecordingStatus;
  elapsedMs: number;
  remainingMs: number;
  meteringDb: number | null;
  canAskPermissionAgain: boolean;
}
```

`meteringDb`는 파형 표시만 위한 값이며 무음 판정이나 제출 유효성 판단에 사용하지 않는다.
마이크 테스트와 답변 화면은 같은 `AudioWaveform` 표현 컴포넌트를 사용하지만 recorder
lifecycle과 AppState 정책은 공유하지 않는다.

## Commands and Results

| Command | Result | Contract |
|---|---|---|
| `start(input)` | started or typed failure | native record가 실제 시작된 뒤 started |
| `finish(user or timeout)` | FinalizedAnswer | 같은 generation에서 항상 같은 terminal Promise |
| `discard(reason)` | void | stop → mode restore → partial delete, registry event 없음 |
| `resetForRetry()` | idle | interrupted/error 정리 완료 뒤 같은 key의 새 generation 허용 |
| `dispose()` | void | start 무효화, terminal cleanup 시작, state dispatch 중단 |

`FinalizedAnswer`는 `key`, `generationId`, `audioFileUri`, `durationMs`를 포함한다.

## Native Recording Configuration

- container/codec: m4a / AAC-LC
- sample rate: 44,100 Hz
- channels: 1
- bitrate: 96,000 bps
- directory: cache
- metering interval: 100ms
- recording audio mode: recording allowed, no background recording, silent-mode playback allowed,
  do-not-mix interruption, no background playback, no earpiece routing
- playback restore: recorder stop 뒤 recording disabled, silent-mode playback allowed

## Interruption Contract

다음 중 하나가 preparing/recording 중 finalize intent보다 먼저 발생하면 정상 finalize가 아니라 discard다.

- AppState `active → inactive`
- AppState `active/inactive → background`
- media services reset
- native recording status error
- recording 상태에서 예상하지 않은 recorder stop
- screen blur/unmount before URI ownership transfer

Foreground 복귀는 자동 resume하지 않는다. UI controller가 interrupted state와 같은 문항
재녹음 action을 보여주고, 사용자가 선택하면 전체 제한 시간으로 새 generation을 시작한다.

사용자 완료 또는 native 제한 시간이 먼저 finalize intent를 기록했다면 이후 AppState
inactive/background는 이를 discard로 변경하지 않는다. stop과 파일 검증에 성공하면 registry로
ownership을 이전한다. 다만 screen blur/unmount로 controller가 dispose되면 이전되지 않은
파일을 정리하며, native stop·URI·파일 검증 실패는 같은 문항 재녹음으로 복구한다.

## Ownership and Race Invariants

- audio mode restore는 해당 generation이 mode ownership을 가진 경우에만 수행한다.
- 사용자 finish, native duration finish, fallback timer가 경쟁해도 stop은 한 번이다.
- finalize와 AppState discard가 경쟁하면 먼저 기록된 terminal intent만 실행한다.
- registry registration이 URI ownership을 인수한 뒤 recorder cleanup은 그 파일을 삭제하지 않는다.
- cleanup 단계 하나가 실패해도 이후 stop/mode restore/file inspection/delete를 계속 시도한다.
