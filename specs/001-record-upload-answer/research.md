# Phase 0 Research: 모의고사 답변 녹음 및 업로드

## Decision 1 — 녹음 생명주기는 답변 전용 hook으로 분리한다

**Decision**: `src/features/exam/use-answer-recorder.ts`를 Expo-native로 새로 구현하고,
마이크 테스트 hook의 상태 머신은 재사용하지 않는다. 두 recorder는 공통 녹음 옵션과
순수 metering 변환을 `answer-audio.ts`에서 사용하고, 100ms smoothing과 막대 표현은
`AudioWaveform` 컴포넌트로 공유한다.

**Rationale**: 마이크 테스트는 background에서 같은 3초 파일을 이어가지만 실제 답변은
승인된 정책에 따라 어떤 inactive/background 전환도 부분 녹음 폐기와 같은 문항 재녹음으로
이어져야 한다. 두 정책을 하나의 configurable hook에 넣으면 이미 검증된 mic test를
회귀시키고 파일 소유권이 복잡해진다. generation guard, single-flight stop, audio-mode
ownership 같은 패턴만 답변 hook에 맞게 적용한다.

파형은 recorder가 노출하는 `meteringDb`의 표현일 뿐이며 무음 판정이나 파일 유효성에
사용하지 않는다. 따라서 mic test와 답변이 같은 입력 반응을 보이면서도 서로 다른 상태
정책을 유지할 수 있다.

**Alternatives considered**:

- 마이크 테스트 hook을 일반화: 중복은 줄지만 상반된 pause/resume와 discard 정책 때문에 기각
- 전역 imperative recorder service: 여러 화면에서 recorder를 공유할 때는 유효하지만 현재는
  하나의 mounted exam screen만 사용하므로 기각

## Decision 2 — m4a/AAC mono 96kbps와 cache 파일을 유지한다

**Decision**: `RecordingPresets.HIGH_QUALITY`를 기반으로 44.1kHz, 1 channel, 96kbps,
metering enabled, cache directory를 사용하고 `audio/mp4`로 업로드한다.

**Rationale**: 기존 포맷 결정 문서와 현재 S3 upload header가 이 계약을 사용한다. iOS와
Android가 같은 포맷을 만들며, 60초 약 720KB로 15초 PUT 제한 안에서 음성 품질과 전송량의
균형이 맞는다.

**Alternatives considered**:

- LOW_QUALITY: Android만 3gp/AMR-NB가 되어 플랫폼별 품질이 달라지므로 기각
- WAV/PCM: Android MediaRecorder 제약, 파일 크기, 새 native dependency 때문에 기각

## Decision 3 — native duration cap과 generation terminal Promise를 함께 사용한다

**Decision**: `record({ forDuration: speakTimeSec })`를 native hard cutoff로 사용하고 native
finish event, 사용자 완료, JS fallback timer를 모두 같은 generation의 terminal Promise로
합친다. 표시 시간은 실제 `record()` 호출 직후 저장한 `startedAtMs`와 현재 시각의 wall-clock
차이로 계산한다.

**Rationale**: JS thread 지연에도 녹음 제한을 native에서 지킬 수 있고, timeout과 버튼이
동시에 들어와도 stop·URI 확정·audio mode 복원이 한 번만 실행된다. 실제 record가 시작된
뒤에만 답변 시간이 감소하므로 permission/prepare 대기가 사용자의 시간을 소모하지 않는다.

**Alternatives considered**:

- JS `setTimeout`만 사용: 구현은 단순하지만 JS stall에서 제한 시간을 넘길 수 있어 기각
- permission 또는 prepare 시작부터 wall-clock 측정: 실제 녹음 전부터 답변 시간을 소모하므로 기각

## Decision 4 — 정상 종료와 active 이탈은 먼저 확정된 terminal intent를 따른다

**Decision**: AppState가 `inactive` 또는 `background`가 되거나 recorder가 예기치 않게
정지한 시점에 finalize intent가 아직 없으면 discard로 확정하고 부분 파일을 삭제한다.
사용자 완료나 native 제한 시간이 먼저 finalize를 확정했다면 뒤이은 AppState 변화는 이를
덮지 않고 stop과 파일 검증을 마친다. screen blur/unmount로 controller가 dispose되면 registry로
ownership이 이전되지 않은 파일을 정리한다.

**Rationale**: Expo는 background/interruption에서 native recorder를 pause하고 foreground에
자동 resume할 수 있으므로 녹음 중 interruption은 즉시 `interrupted`로 고정해야 한다.
반면 사용자가 이미 답변 완료를 확정한 파일을 뒤늦은 AppState event 때문에 버리면 정상
답변을 불필요하게 다시 받아야 한다. generation별 terminal intent와 single-flight Promise가
두 event의 순서를 고정한다. iOS와 Android의 interruption callback 차이는 실기기에서 검증한다.

**Alternatives considered**:

- 같은 파일 pause/resume: mic test에는 적합하지만 실제 답변 정책과 충돌
- 부분 파일 제출: 명세에서 명시적으로 기각

## Decision 5 — 제출은 불변 답변 키별 registry와 stage runner로 관리한다

**Decision**: `{ examId, questionNumber, retryCount }`를 key로 하는 reducer/runner를 두고
최초 upload URL 발급, S3 PUT, 서버 고지를 분리한다. 발급받은 `uploadUrl`, `fileKey`, 만료
시각은 PUT 전에 job에 고정해 S3 재시도가 URL 발급 API를 다시 호출하지 않게 한다. registry
등록은 기존 key에 대해 idempotent하며 각 key는 한 runner만 가진다. registry는 FIFO가 아니고
한 job의 retry wait가 다른 job을 막지 않는다.

**Rationale**: 현재 outer upload loop는 S3 PUT 실패 뒤 upload URL endpoint를 다시 호출해
서버에 없는 재발급 동작을 가정한다. upload target을 job에 보존하면 같은 presigned URL로만
PUT을 재시도하고, PUT 성공 뒤 고지 실패는 같은 `fileKey`에서 이어갈 수 있다. 다음 문항도
이전 문항의 네트워크 완료를 기다리지 않는다.

**Alternatives considered**:

- 기존 `uploadExamAnswer()` fire-and-forget: 가장 작은 diff지만 중복 submit, orphan file,
  cancellation 및 final barrier 문제로 기각
- 단일 FIFO queue: 앞 job의 retry wait가 뒤 문항 제출을 막으므로 기각
- 전역 영속 registry: process death 복구 범위와 플랫폼별 background scheduler가 필요해 기각

## Decision 6 — retryCount와 network attempt를 분리한다

**Decision**: 최초 응시와 중단 후 같은 문항 재녹음은 `retryCount = 0`을 유지한다.
네트워크 재시도 횟수는 registry entry의 별도 stage attempt로만 관리한다.

**Rationale**: `retryCount`는 서버의 답변 회차 식별자이며 transport retry가 아니다. 이를
증가시키면 동일 답변이 새 응시로 기록되고 S3 고아 객체나 중복 채점이 생긴다.

**Alternatives considered**:

- 네트워크 실패마다 retryCount 증가: 중복 회차를 만들므로 기각

## Decision 7 — 서버 고지는 동일 요청을 최대 3회 재시도한다

**Decision**: S3 PUT 2xx 뒤 서버 고지의 network error, timeout, 408, 429, 5xx는 동일한
`(examId, questionNumber, retryCount)`로 최대 3회 추가 재시도한다. PUT은 다시 하지
않고 존재하지 않는 question status endpoint도 조회하지 않는다. 일반 4xx와 명시적인 처리
실패는 terminal failure로 둔다.

**Rationale**: 서버 고지는 채점 시작에 필요한 단계이므로 전달 성공은 확인해야 하지만,
S3에 이미 저장된 파일을 다시 올릴 이유는 없다. 응답 유실은 서버가 요청을 받았을 수도
있으므로 동일 고지는 서버에서 중복 작업 없이 처리되는 계약이 필요하다. 이 계약 아래에서는
별도 상태 조회 없이 같은 요청을 재전송하는 것이 가장 단순하다.

**Integration prerequisite**: 서버는 동일한 tuple 고지를 여러 번 받아도 채점 작업을
하나만 만들고 이미 접수된 요청에는 성공으로 해석 가능한 응답을 반환해야 한다.

**Alternatives considered**:

- question status 조회: 실제 endpoint가 없어 기각
- 고지 실패 시 S3 PUT부터 재실행: 불필요한 전송이며 단계 책임을 섞으므로 기각
- 고지를 한 번만 best-effort로 전송: 고지 유실 시 채점이 시작되지 않아 기각

## Decision 8 — 인앱 background retry만 보장한다

**Decision**: 여기서 background retry는 다음 문항 진행 중 비차단 처리와 AppState foreground
복귀 후 재개를 뜻한다. upload는 foreground session type을 사용하고 process kill 이후의
자동 복구는 범위 밖으로 둔다.

**Rationale**: Expo FileSystem의 OS background 동작은 iOS/Android가 다르고 JS retry timer와
registry state는 process kill을 견디지 못한다. 영속 보장을 암시하지 않는 것이 플랫폼 일관성과
현재 범위에 맞다.

**Alternatives considered**:

- iOS background upload에 의존: Android와 보장이 달라 기각
- native background scheduler와 persisted registry: 별도 기능으로 계획해야 하므로 기각

## Decision 9 — 파일은 S3 PUT 성공 뒤 삭제할 수 있다

**Decision**: finalized URI는 registry가 소유하고 S3 PUT 2xx 뒤 best-effort `delete()`로
제거한다. 이후 서버 고지 재시도에는 `fileKey`만 사용한다. PUT이 끝나기 전의 retryable/failed
상태에서는 파일을 보존하고 interrupted partial은 즉시 삭제한다.

**Rationale**: missing/zero-byte 검증은 upload 전에 수행하며 S3가 원본 저장소다. PUT 성공 후
서버 고지는 로컬 파일을 읽지 않으므로 파일을 유지해도 복구 가능성이 늘지 않는다. screen
dispose에서는 active file read가 끝난 뒤 남은 파일을 정리한다.

**Alternatives considered**:

- 서버 고지 성공까지 유지: 고지 재시도에는 fileKey만 필요해 불필요하므로 기각
- OS cache 정리에만 의존: 시험 중 임시 파일 누적과 소유권 불명확 때문에 기각

## Decision 10 — 실제 서버 세션을 시작 경로에 연결한다

**Decision**: `SoundTestScreen`의 시험 시작은 기존 `createExamSession()`을 호출하고 성공한
session으로만 이동한다. mock session은 UI 개발 fixture로만 유지한다.

**Rationale**: 현재 mock examId는 upload URL과 submit endpoint에서 유효하지 않아 end-to-end
답변 처리 자체가 불가능하다. 이미 endpoint와 mapper가 존재하므로 새 계약이 필요 없다.

**Alternatives considered**:

- mock session을 유지하고 업로드만 연결: 항상 서버 실패하므로 기각
- screen 진입 후 세션 생성: 녹음 UI와 시작 오류 상태가 섞이므로 기각

## Decision 11 — 완료와 최종 실패 상태는 현재 화면 안에 둔다

**Decision**: 마지막 답변 후 pending과 completed 상태를 `ExamSessionScreen` 안에서 표시한다.
모든 자동 재시도가 끝난 terminal failure에는 `public/mascots/error.png`와 오류 설명을
표시한다. retryable failure에는 수동 재시도와 홈 이동을, 일반 4xx에는 홈 이동만 제공한다.
홈 이동은 MockExam stack을 초기 화면으로 정리한 뒤 상위 tab navigator의 `Home`으로 이동한다.

**Rationale**: 현재 navigation에는 grading/result route가 없고 실패가 서버 상태 조회로
회복될 수도 없다. 사용자를 무한 대기에 두지 않으면서 일시 장애에는 마지막 수동 복구 기회를
주고, 복구 불가능한 오류에는 홈으로 빠져나갈 명확한 경로를 제공한다.

**Alternatives considered**:

- 기존 Feedback tab으로 즉시 이동: 해당 examId 기반 결과 flow가 없어 기각
- 새 grading screen 추가: 승인 범위를 넘으므로 기각

## Decision 12 — S3 PUT과 서버 고지 모두 jittered exponential backoff를 사용한다

**Decision**: S3 PUT의 base delay `1s, 2s, 4s, 8s, 16s`와 서버 고지의 base delay
`1s, 2s, 4s`에 equal jitter를 적용한다. 실제 delay는 각 base의 50~100% 범위에서 매번 새로
뽑는다. S3의 다음 delay와 PUT 제한 시간을 합친 시점이 presigned 만료 시각을 넘으면 해당
시도를 시작하지 않는다.

**Rationale**: 완전 고정 backoff는 네트워크 복구 직후 여러 클라이언트의 재요청을 다시 같은
시점에 모은다. equal jitter는 최소 대기를 보장하면서 요청을 분산하고, 새 dependency 없이
구현할 수 있다. S3는 URL 만료 예산도 함께 지켜야 한다.

**Alternatives considered**:

- 고정 exponential backoff: thundering herd를 완화하지 못해 기각
- full jitter(0~base): 즉시 재시도가 가능해 최소 완충 시간이 없어 기각
- decorrelated jitter: 긴 retry sequence에는 유리하지만 최대 3회/5회의 짧은 흐름에는 복잡해 기각
