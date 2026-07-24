# 마이크 테스트 오디오 생명주기

마이크 테스트의 권한 요청, 녹음 시작·종료, 화면 이동과 앱 백그라운드 전환이 겹칠 때의 정리 정책을 기록한다. 구현은 [마이크 테스트 훅](../src/screens/mock-exam/hooks/use-microphone-test.ts)에 모으고, 화면은 문구와 내비게이션만 담당한다.

## 서로 다른 세 가지 생명주기

다음 신호는 일부 상황에서 같이 발생하지만 서로 포함 관계는 아니다.

| 상황 | Navigation focus | AppState | 컴포넌트 |
|---|---|---|---|
| 다음 화면으로 `navigate` | `blur` | `active` | 보통 mount 유지 |
| 현재 화면에서 `goBack` | `blur` | `active` | unmount |
| 홈 버튼·다른 앱 전환 | 보통 focus 유지 | `background` | mount 유지 |

따라서 한 종류의 cleanup만으로 모든 이탈을 처리할 수 없다.

- Navigation `blur`: `useFocusEffect` cleanup에서 처리한다.
- 앱 백그라운드: `AppState`의 `background` 전환에서 녹음과 타이머를 일시정지한다.
- 컴포넌트 제거: 일반 `useEffect` cleanup을 마지막 안전망으로 둔다.
- 화면 버튼 이동: 내비게이션 전 재생을 즉시 멈추기 위해 같은 정리 함수를 먼저 호출한다.

`inactive`는 iOS 권한 팝업, 제어센터 등 짧은 시스템 전환에서도 발생할 수 있다. 권한 요청 자체를 중단시키는 오탐을 피하기 위해 마이크 테스트는 `background`만 강제 중단 조건으로 사용한다. 실제 시험에서는 전화·알람 정책과 함께 `inactive` 처리 여부를 별도로 결정한다.

AppState 구독은 화면이 스택 아래에 남아 있어도 유지되므로 `background` 처리는 마이크 테스트 화면이 현재 focus 상태일 때만 실행한다. 숨겨진 마이크 테스트 훅이 이후 시험 화면의 오디오 세션을 변경하면 안 된다.

## 백그라운드는 종료가 아니라 일시정지

3초짜리 기기 테스트는 채점 대상이 아니며 앱을 잠깐 벗어난 사용자에게 처음부터 다시 시킬 필요가 작다. 따라서 Navigation `blur`와 `unmount`는 완전 종료하지만, AppState `background`는 현재 m4a 파일을 닫지 않고 남은 녹음을 이어간다.

`allowsBackgroundRecording: false`일 때 Expo Audio 57은 네이티브에서 background 진입 시 recorder를 pause하고 foreground 복귀 시 resume한다. 앱은 같은 녹음기를 중복 pause하지 않고 다음 UI·타이머 상태만 관리한다.

```text
recording 중 background
→ JS 3초 타이머 제거
→ 상태를 paused로 변경
→ Expo 네이티브가 recorder pause

foreground 복귀
→ 자동 재개된 recorder를 검증 동안 잠시 pause
→ 마이크 권한과 recorder 상태 재확인
→ 같은 파일에 record()로 재개
→ 실제 녹음 시간 기준 남은 타이머 예약
```

벽시계 기준 `setTimeout(3000)`을 그대로 두면 1초 녹음 후 5초간 백그라운드에 있었을 때 실제 오디오는 1초인데 타이머만 만료된다. 복귀 시 `recorder.getStatus().durationMillis`를 사용해 `3000 - 실제 녹음 시간`만 다시 예약한다.

권한 요청·recorder 준비 단계인 `requesting`에는 이어갈 오디오 파일이 아직 없으므로 background 전환 시 기존처럼 시작 시도를 취소하고 `interrupted`로 보낸다. 설정 앱에서 돌아온 `denied` 상태는 `getRecordingPermissionsAsync()`로 다시 읽고, 허용됐다면 `idle`로 복구한다.

복귀 시 권한이 없거나 `canRecord`가 거짓이거나 `mediaServicesDidReset`이 발생했다면 부분 녹음을 정상 결과로 사용하지 않고 `interrupted`로 전환한다. 완료된 테스트 음성 재생은 foreground 복귀 시 사용자 입력 없이 자동 재생되지 않도록 다시 pause한다.

## 정리 작업은 single-flight로 실행

`blur`, 명시적 화면 이탈, `unmount`가 연달아 발생하거나 `requesting` 취소가 겹치면 모두 같은 정리 함수를 호출한다. 각 트리거가 `recorder.stop()`을 따로 실행하면 두 호출이 동시에 녹음 중임을 확인하는 레이스가 생길 수 있다. 정상적인 recording 상태의 background 전환은 이 종료 Promise를 만들지 않고 pause 경로를 탄다.

진행 중인 종료 Promise를 `stopPromiseRef`에 저장한다.

```text
평상시               stopPromiseRef = null
첫 정리 호출          Promise 생성 후 ref에 저장
정리 중 추가 호출     기존 Promise 반환
정리 완료             ref를 null로 초기화
```

두 번째 트리거는 새로 정리하지 않고 첫 번째 트리거와 동일한 URI·오류 결과를 기다린다. Promise가 완료되면 ref를 비워 다음 녹음의 종료 작업을 허용한다.

이 ref는 녹음기 객체를 보관하는 곳이 아니다. 같은 화면에서 녹음을 다시 하면 Expo 녹음기는 재사용될 수 있지만 종료 Promise는 녹음마다 새로 생성된다.

## 공통 정리 순서

모든 종료 경로는 다음 순서를 공유한다.

```text
진행 중인 시작 시도 무효화
→ 3초 타이머 제거
→ 녹음 재생 일시정지
→ recording 또는 paused 상태의 열린 파일이 있으면 await recorder.stop()
→ 이 훅이 녹음 모드를 소유한 경우에만 재생용 오디오 모드 복원
→ 완성된 recorder.uri 반환
```

녹음 모드는 앱 전체가 공유하는 OS 오디오 세션이다. 훅이 녹음 모드로 전환하기 직전에 소유권 ref를 켜고 복원 성공 후 끈다. 이미 blur cleanup을 마친 숨겨진 화면이나 나중에 unmount되는 화면은 소유권이 없으므로, 다른 화면이 사용 중인 전역 오디오 모드를 덮어쓰지 않는다.

정상 타이머 종료는 반환된 URI를 플레이어에 연결한 뒤에만 화면을 `complete`로 전환한다. Navigation 이탈과 unmount는 같은 종료 결과를 기다리지만 파일을 재생기에 연결하지 않는다. background는 파일을 완성하지 않고 열린 상태로 유지한다.

## 시작과 종료가 겹치는 레이스

권한 요청과 `prepareToRecordAsync()`는 비동기다. 이 사이 화면을 떠나면 정리가 먼저 끝난 뒤 늦게 완료된 시작 로직이 다시 녹음 모드를 켜거나 백그라운드에서 `record()`를 호출할 수 있다.

각 시작에 증가하는 시도 번호를 부여하고 다음 조건을 비동기 단계마다 다시 확인한다.

```text
현재 시도 번호가 최신인가
컴포넌트가 mount 상태인가
화면이 Navigation focus 상태인가
앱이 background가 아닌가
```

정리 함수는 시작 시도 번호를 무효화한다. 무효화된 시작이 나중에 완료되면 녹음을 시작하지 않고 공통 정리 함수로 오디오 모드만 다시 복원한다.

## 상태와 오류 처리

권한 요청 중 이탈하거나 paused 녹음의 재개 검증이 실패하면 화면 상태를 `interrupted`로 바꾼다. 정상 recording 중 background 이동은 `paused`를 거쳐 남은 녹음을 이어간다.

공통 정리는 재생 정지, 녹음기 정지, 오디오 모드 복원, URI 조회를 각각 `try/catch`로 분리한다. 앞 단계가 실패해도 다음 정리를 계속 시도하며, 예상하지 못한 거부도 내부에서 처리해 fire-and-forget cleanup이 unhandled rejection을 만들지 않게 한다.

정상 녹음 종료에서 다음 중 하나가 발생하면 `complete`로 전환하지 않고 `error`로 보낸다.

- 녹음기 또는 오디오 모드 정리 오류
- `recorder.uri`가 `null`
- 완성된 파일을 재생기에 연결하지 못함
- 로컬 녹음 재생 실패

OS 설정 화면 열기 실패도 화면 호출부에서 별도로 잡아 기록한다.

## 실제 모의고사 녹음으로 확장할 때

마이크 테스트는 background에서 이어가지만 실제 답안은 시험 공정성과 서버 제한 시간을 포함한 정책 결정이 더 필요하다.

- 중간까지 완성된 파일을 폐기할지 업로드할지
- 전화·알람처럼 `inactive`만 발생한 경우 재녹음을 허용할지
- `finalizing → uploading → submitting` 중 앱이 백그라운드로 가면 어디까지 계속할지
- 시작·종료 single-flight 결과를 문항 상태 머신과 어떻게 연결할지

생명주기 트리거와 네이티브 정리 함수는 현재 구조를 재사용할 수 있지만, 중단된 답안의 사용자 정책까지 마이크 테스트 훅과 공유하지는 않는다.
