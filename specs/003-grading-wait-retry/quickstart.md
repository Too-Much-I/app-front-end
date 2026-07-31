# Quickstart: 채점 대기 폴링과 재요청 검증

## Prerequisites

- iOS Simulator/device와 Android Emulator/device에서 앱을 실행할 수 있어야 한다.
- status lifecycle 응답 순서와 `POST /grading/retry` 성공/실패를 제어할 수 있는 개발
  backend 또는 proxy가 있어야 한다.

## Static validation

```sh
pnpm lint
pnpm exec tsc --noEmit
```

두 명령이 모두 성공해야 한다. 자동 테스트 runner가 없으므로 아래 시나리오 결과도 기록한다.

## Scenario 1 — timed checks and sequential polling

1. status lifecycle을 계속 `PENDING` 또는 `PROCESSING`으로 유지한다.
2. GradingWait 진입 직후 첫 GET이 한 번 실행되는지 확인한다.
3. 각 GET 완료 뒤 다음 GET 시작까지 약 3초이며 동시에 활성 GET이 1개 이하인지 확인한다.
4. 진입 후 0/10/20/30/40/50초의 check count를 기록한다.

Expected: count는 각각 0/1/2/3/4/4이며 180초 전에는 시간만으로 다섯 번째 체크가 없다.

## Scenario 2 — completion at different counts

`COMPLETED`를 진입 직후, 25초, 45초에 각각 반환한다.

Expected:

- status poll, 10초 check timer, 180초 deadline이 중지된다.
- 현재 count 다음 값부터 5까지 하나씩 순서대로 표시된다.
- 다섯 번째 체크가 표시된 뒤 2초 안에 Feedback 진입점으로 정확히 한 번 이동한다.

## Scenario 3 — first failure and first timeout

최초 poll `FAILED`와 180초 미완료를 각각 검증한다.

Expected:

- 두 경우 모두 terminal error가 아니라 Retry CTA가 표시된다.
- 전환 뒤 status polling과 check count 증가가 멈춘다.
- 사용자가 Retry를 누르기 전 `POST /grading/retry`는 0건이다.

## Scenario 4 — successful re-request

1. 첫 attempt를 `FAILED`로 만든 뒤 Retry를 빠르게 여러 번 누른다.
2. `POST /api/v1/exams/{examId}/grading/retry`를 HTTP 2xx로 반환한다.
3. 두 번째 status lifecycle을 `PENDING -> PROCESSING -> COMPLETED`로 전환한다.

Expected:

- Retry POST는 최대 1건이고 CTA는 요청 중 disabled다.
- request path에는 examId만 들어가고 request body는 없다.
- count가 0으로 돌아가고 새 180초 attempt가 시작된다.
- 최종 `COMPLETED`에서 순차 체크 뒤 한 번만 이동한다.

## Scenario 5 — terminal failure after re-request

retry POST network/non-2xx 오류, 두 번째 overall `FAILED`, 두 번째 180초 deadline을 각각
검증한다.

Expected:

- 추가 Retry 없이 terminal notice와 Home CTA만 표시된다.
- Home은 MockExam stack을 정리하고 앱의 Home tab을 선택한다.
- Android hardware back이나 iOS back gesture로 끝난 ExamSession에 돌아가지 않는다.

## Scenario 6 — races and cleanup

`COMPLETED`와 deadline 경쟁, Retry 뒤 abort된 최초 attempt callback, poll/retry/completion 중 unmount를
각각 발생시킨다.

Expected:

- completion/retry-ready/terminal 중 하나만 확정된다.
- abort된 이전 attempt callback은 새 attempt를 덮어쓰지 않고 새 polling이 현재 상태를 확인한다.
- unmount 뒤 request, timer, state update와 자동 navigation은 0건이다.

## Scenario 7 — UI, safe area, and accessibility

iOS/Android에서 작은 화면, 태블릿, landscape, 큰 글자, VoiceOver/TalkBack으로 확인한다.

Expected:

- waiting sheet, retry notice, terminal notice와 CTA가 safe area 안에 있다.
- check count 변경, retry reset, terminal error의 의미를 시각 정보 없이도 이해할 수 있다.
- Retry 요청 중 disabled 상태가 보조기술에 전달되고 터치 영역이 44pt 이상이다.
- 모든 phase 전환은 같은 GradingWait route 안에서 일어나며 중간 navigation은 없다.
- MyPage에는 preview CTA가 없고 기존 `마이페이지` 기본 콘텐츠는 유지된다.
