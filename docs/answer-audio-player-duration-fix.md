# 답변 오디오 플레이어의 재생시간 처리 방식

문제별 피드백 화면(`ExamQuestionFeedbackScreen`)에 커스텀 오디오 플레이어(`AnswerAudioPlayer`)를 새로 붙이면서 재생시간을 어떻게 구할지 두 번 방향을 바꿨다. 처음엔 `<audio>`의 `duration`을 직접 읽으려 했고, 그 과정에서 만난 두 가지 버그와 그 우회법을 정리한 뒤, 최종적으로는 그 방식 자체를 버리고 문제별 고정 시간을 쓰기로 한 이유를 정리한다.

## 1. 배경

기존에는 네이티브 `<audio controls src={detail.audioUrl} />`로 답변 녹음을 재생했다(`src/components/exam/exam-question-feedback-screen.tsx`). 참고 디자인을 따라 재생 버튼·파형·배속 선택이 있는 커스텀 플레이어(`src/components/exam/answer-audio-player.tsx`)로 교체하면서, 처음엔 재생시간을 `<audio>`의 `duration`을 직접 읽어 표시하도록 구현했다.

## 2. 1차 시도: `<audio>`의 `duration`을 직접 읽기 — 만난 버그 두 가지

Playwright로 실제 페이지를 띄워 검증하는 과정에서 시간 표시가 항상 `00:00 / 00:00`으로 멈춰있는 걸 발견했다. 원인은 서로 무관한 두 가지였다.

### 원인 1 — `MediaRecorder` 녹음 파일의 `duration = Infinity`

이 앱의 답변 녹음은 `new MediaRecorder(stream)`으로 만들어지고(`src/features/exam/use-answer-recorder.ts:82`), 브라우저 기본 mimeType(크롬에서는 보통 `audio/webm;codecs=opus`)이 그대로 붙어 S3에 업로드된다. `MediaRecorder`는 청크를 실시간으로 이어붙이는 스트리밍 방식이라, 녹음이 끝난 시점에도 컨테이너(webm)에 "총 길이" 값이 확정적으로 기록되지 않는 경우가 흔하다. 이런 파일을 `<audio>`로 열면 크롬은 `audio.duration`으로 `Infinity`를 돌려준다(길이를 모르는 라이브 스트림처럼 취급). 이건 이 프로젝트만의 문제가 아니라 크롬에서 잘 알려진 동작이다.

우회법은 `currentTime`을 파일 끝 너머의 임의의 큰 값(`1e101`)으로 seek했다가 0으로 되돌리는 것이었다. 브라우저가 실제 파일 끝으로 위치를 clamp하는 과정에서 컨테이너의 진짜 길이를 다시 계산해주기 때문이다.

### 원인 2 — SSR 하이드레이션과 `loadedmetadata` 이벤트의 경쟁(race)

원인 1을 고친 뒤에도 여전히 `00:00`이 표시돼 Playwright로 이벤트 발생 여부를 직접 추적해보니(`HTMLMediaElement.prototype.addEventListener`를 몽키패치해 확인), `loadedmetadata`/`durationchange` 리스너가 한 번도 호출되지 않고 있었다. 반면 같은 시점에 `audio.duration`을 직접 읽으면(`page.evaluate`) 이미 유한한 값이 들어있었다.

원인은 SSR이다. Next.js가 서버에서 만든 초기 HTML에는 이미 완성된 `<audio src="...">` 태그가 포함돼 있고, 브라우저는 이 HTML을 파싱하는 즉시 React 번들 실행(하이드레이션)과 무관하게 오디오 리소스를 로드하기 시작한다. 답변 녹음은 몇 초~1분 내외로 짧아 로딩(및 `loadedmetadata` 발생)이 매우 빠른데, 반대로 하이드레이션은 (특히 `pnpm dev`처럼 번들이 압축되지 않은 환경에서) 상대적으로 오래 걸릴 수 있다. 그 결과 `loadedmetadata` 이벤트가 React가 리스너를 붙이기도 전에 이미 발생해버리고, 이벤트는 발생 시점에 리스닝 중인 코드에만 전달되므로 이후 리스너를 붙여도 다시 받을 수 없다.

우회법은 마운트 시점에 이벤트를 기다리지 않고 `audio.readyState`(로딩 상태, 0=아직 없음 ~ 4=재생 가능)를 직접 확인해, 이미 메타데이터가 로드돼 있으면(`>= 1`) 이벤트 없이 그 자리에서 값을 읽어오는 것이었다.

## 3. 최종 결정: 파일에서 읽지 않고 문제별 고정 시간을 그대로 쓴다

두 우회법으로 실제로 `00:00` 문제는 해결됐지만, 이후 "애초에 답변 녹음 길이가 문제별로 고정돼 있지 않나?"라는 사실을 떠올렸고 이 방식 자체를 걷어냈다.

`src/components/exam/exam-session-screen.tsx:187-208`을 보면 녹음은 phase가 `"speaking"`에 진입할 때 시작되고, 그 phase를 벗어날 때(effect의 cleanup)에 멈춰서 업로드된다. `"speaking"` phase가 자연스럽게 끝나는 유일한 방법은 `usePhaseCountdown`이 `question.speakTimeSec`만큼 시간이 다 되어 `handlePhaseComplete`를 호출하는 것뿐이다 — `"prep"` phase엔 "바로 답변 시작하기" 조기 종료 버튼이 있지만 `"speaking"`엔 없다. 즉 QA 이동 바(`jumpToQuestion`/`jumpToPart`, `ExamQaNavBar` — CLAUDE.md에 명시된 대로 실 배포 전 제거될 멘토 검수용 이동 수단)로 건너뛰지 않는 한, 녹음 파일 길이는 항상 정확히 `question.speakTimeSec`다.

그리고 `speakTimeSec`는 백엔드 응답이 아니라 파트 번호(와 파트 내 몇 번째 문제인지)만으로 정해지는 순수 상수다(Part1=45초, Part2=30초, Part3/4는 마지막 문제만 30초·나머지 15초, Part5=60초 — TOEIC Speaking 정규 시험 구성 기준이라 실제 시험 형식이 바뀌지 않는 한 안 바뀐다). 이 상수 테이블은 원래 `src/features/exam/map-exam-session.ts`에만 있었는데, 피드백 화면에서도 같은 값이 필요해져 `src/features/exam/part-meta.ts`로 옮기고 두 곳에서 공유하도록 정리했다.

- `getExamPartTiming(partNumber, isFirstInPart, isLastInPart)` — 원래 있던 파트별 시간 테이블. `map-exam-session.ts`가 이걸 그대로 가져다 쓴다(raw 문제 배열 안에서의 위치로 `isFirstInPart`/`isLastInPart`를 계산).
- `getExamPartTimingByQuestionNumber(partNumber, questionNumber)` — 피드백 화면처럼 배열 위치가 아니라 `questionNumber` 값만 있는 곳에서 쓰는 버전. `EXAM_PART_QUESTION_NUMBERS`(파트별 정규 문제 번호 목록)와 비교해 첫/마지막 문제 여부를 판별한 뒤 위 함수에 위임한다.

`AnswerAudioPlayer`는 이제 `duration`을 자체적으로 계산하지 않고 `durationSec` prop을 그대로 받아 쓴다. `ExamQuestionFeedbackScreen`이 `getExamPartTimingByQuestionNumber(detail.partNumber, detail.questionNumber).speakTimeSec`로 계산해 넘겨준다. 이러면서 앞서 만든 `resolveAudioDuration`(seek 트릭), `readyState` 확인 effect, `isFixingDurationRef`, `onLoadedMetadata`/`onDurationChange` 리스너가 전부 필요 없어져 컴포넌트에서 제거했다. `onTimeUpdate`로 `currentTime`(현재 재생 위치)을 추적하는 부분은 그대로 남아있다 — 이건 애초에 버그가 없었던 부분이라 손대지 않았다.

## 4. 트레이드오프

- **QA 이동 바로 자른 녹음은 실제로 더 짧을 수 있다.** 이 경우 표시되는 총 길이(`speakTimeSec`)보다 실제 파일이 짧아서, 파형 뒷부분과 탐색바 끝부분을 클릭해도 실제로는 이미 끝난 뒤라 아무 일도 안 일어난다. 프로덕션에서는 QA 이동 바 자체가 제거될 예정이라 이 경로가 존재하지 않으므로, 지금은 이 케이스를 감수하기로 결정했다.
- **TOEIC Speaking 시험 형식이 바뀌면 `getExamPartTiming`을 갱신해야 한다.** 지금은 파트별 준비/답변 시간이 고정 상수라는 전제 위에 서있다. 만약 ETS가 문제 유형이나 시간 배분을 바꾸면 이 함수와 (같은 값을 참조하는) 실제 시험 진행 타이머 둘 다 영향을 받는다 — 다만 한 곳(`part-meta.ts`)만 고치면 되도록 이미 통합해뒀다.

## 5. 검증 방법

로컬 개발 서버에서 실제로 확인하기 전까지는 duration 관련 버그 둘 다 드러나지 않았다(정적 타입체크·린트는 통과했지만 런타임 이벤트 타이밍 문제라 코드 리뷰만으로는 잡기 어려움). `docs`가 아닌 임시 라우트(`src/app/dev-audio-preview`)에 컴포넌트를 단독으로 띄우고 Playwright로 데스크톱(1280px)·모바일(375px) 두 폭에서 재생/일시정지/배속 변경까지 조작해 콘솔 에러와 렌더된 텍스트를 직접 확인한 뒤 임시 라우트는 삭제했다. 최종 방식(고정 `durationSec` prop)으로 바꾼 뒤에도 같은 방법으로 재검증했다.
