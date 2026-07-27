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

**Decision**: `record({ forDuration: speakTimeSec })`를 hard cutoff로 사용하고 native finish
event, 사용자 완료, JS fallback timer를 모두 같은 generation의 terminal Promise로 합친다.
표시 시간은 recorder의 `durationMillis`를 사용한다.

**Rationale**: JS thread 지연에도 녹음 제한을 native에서 지킬 수 있고, timeout과 버튼이
동시에 들어와도 stop·URI 확정·audio mode 복원이 한 번만 실행된다. 실제 record가 시작된
뒤에만 답변 시간이 감소하므로 permission/prepare 대기가 사용자의 시간을 소모하지 않는다.

**Alternatives considered**:

- JS `setTimeout`만 사용: 구현은 단순하지만 JS stall에서 제한 시간을 넘길 수 있어 기각
- wall-clock만 표시: native pause와 실제 파일 길이가 어긋날 수 있어 response에는 기각

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
upload URL, S3 PUT, submit을 분리한다. registry 등록은 기존 key에 대해 idempotent하며 각
key는 한 runner만 가진다. registry는 FIFO가 아니고 한 job의 retry wait가 다른 job을 막지 않는다.

**Rationale**: 현재 모놀리식 함수는 submit 실패 시 `fileKey`를 잃어 재업로드가 필요하고,
진행 상태와 최종 barrier를 관찰할 수 없다. stage를 보존하면 submit 실패는 같은
`fileKey`에서 이어가고 다음 문항은 네트워크 완료를 기다리지 않아도 된다.

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

## Decision 7 — submit 모호성은 status reconciliation과 멱등 contract로 제어한다

**Decision**: timeout/connection loss로 submit 결과가 모호하면
`getExamQuestionStatus(examId, questionNumber, retryCount)`를 먼저 조회한다.
`PENDING/PROCESSING/COMPLETED`이면 접수 성공, `FAILED`이면 처리 실패로 확정한다. 현재
`ExamQuestionPollResult`에는 미접수 상태가 없으므로 일반 조회 실패를 미접수로 해석하지
않는다. 서버가 명확한 미접수 신호를 제공하고 같은 답변 key/fileKey의 반복 submit을 멱등
처리한다는 통합 검증을 통과한 경우에만 같은 `fileKey`로 자동 재요청한다.

**Rationale**: 클라이언트만으로 POST exactly-once는 보장할 수 없다. status 조회가 이미
존재하므로 대부분의 응답 유실을 조정할 수 있고, 서버 멱등성은 race가 남는 경우의 최종
안전망이다.

**Integration prerequisite**: 같은 `(examId, questionNumber, retryCount, fileKey)`의 반복
submit은 기존 상태를 반환하고, 같은 Answer Key에 다른 `fileKey`가 오면 conflict로 거부해야
한다. 이 계약을 확인하지 못하면 client는 `submission-unknown`을 유지하고 자동 재-POST를
활성화하지 않으며 기능 완료 증거를 충족하지 못한 것으로 보고한다.

**Alternatives considered**:

- 무조건 submit 재요청: 중복 채점 위험으로 기각
- 전체 파일 재업로드: 새 fileKey/orphan과 불필요한 데이터 전송 때문에 기각
- 오류 즉시 영구 실패: 일시 네트워크 장애 복구 요구를 충족하지 못해 기각

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

## Decision 9 — 파일은 submit 접수 뒤 삭제한다

**Decision**: finalized URI는 registry가 소유하고 submit 접수 성공 뒤 `File.exists` 확인과
best-effort `delete()`로 제거한다. retryable/failed 상태에서는 보존하고 interrupted partial은
즉시 삭제한다.

**Rationale**: missing/zero-byte 검증을 upload 전에 수행할 수 있고, submit 전 실패에서 같은
파일로 복구할 수 있다. screen dispose에서는 active file read가 끝난 뒤 남은 파일을 정리한다.

**Alternatives considered**:

- S3 PUT 직후 삭제: submit 실패 후 재업로드 fallback을 잃어 기각
- OS cache 정리에만 의존: 시험 중 임시 파일 누적과 소유권 불명확 때문에 기각

## Decision 10 — 실제 서버 세션을 시작 경로에 연결한다

**Decision**: `SoundTestScreen`의 시험 시작은 기존 `createExamSession()`을 호출하고 성공한
session으로만 이동한다. mock session은 UI 개발 fixture로만 유지한다.

**Rationale**: 현재 mock examId는 upload URL과 submit endpoint에서 유효하지 않아 end-to-end
답변 처리 자체가 불가능하다. 이미 endpoint와 mapper가 존재하므로 새 계약이 필요 없다.

**Alternatives considered**:

- mock session을 유지하고 업로드만 연결: 항상 서버 실패하므로 기각
- screen 진입 후 세션 생성: 녹음 UI와 시작 오류 상태가 섞이므로 기각

## Decision 11 — no-result-route 완료 상태는 현재 화면 안에 둔다

**Decision**: 마지막 답변 후 `awaitingSubmissions`와 `completed` 상태를
`ExamSessionScreen` 안에서 표시한다. 피드백/채점 결과 route는 이번 계획에서 추가하지 않는다.

**Rationale**: 현재 navigation에는 grading/result route가 없고 spec은 결과 화면 변경을
범위 밖으로 둔다. 제출 성공 barrier를 검증하면서 후속 이슈가 연결할 명확한 완료 event를
남길 수 있다.

**Alternatives considered**:

- 기존 Feedback tab으로 즉시 이동: 해당 examId 기반 결과 flow가 없어 기각
- 새 grading screen 추가: 승인 범위를 넘으므로 기각
