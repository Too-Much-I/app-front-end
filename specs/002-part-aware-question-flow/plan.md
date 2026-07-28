# Implementation Plan: 파트별 시험 흐름과 복구 접근성

**Branch**: `feat/#9` | **Date**: 2026-07-28 | **Spec**: [spec.md](spec.md)

**Approval**: Approved by implementation request (2026-07-28).

**Input**: Feature specification from `/specs/002-part-aware-question-flow/spec.md`

## Summary

기존 시험 controller에 Part 3 상황 안내, Part 4 정보 읽기, 사전 정보 오류 phase를 명시적으로
추가한다. 세션 응답의 문항별 optional 필드는 mapper에서 파트 단위의 직렬화 가능한 prelude
계약으로 정규화하고, Part 4 Q8의 표를 45초 사전 읽기와 Q8~Q10 문제 화면에서 같은 공통
정보로 계속 사용한다. 문제 흐름은 흰색으로 두고 디렉션은 별도 카드 없이 화면 전체를
베이지색으로 표시한다. 마지막 제출 장벽은 해당 분기 전체를 safe-area 안의 세로 스크롤로 만들어 모든
실패 항목과 재시도 버튼에 접근할 수 있게 한다.

## Technical Context

**Language/Version**: strict TypeScript 6.0, React 19.2, React Native 0.86

**Primary Dependencies**: Expo SDK 57, `expo-audio` 57, React Navigation 7,
`react-native-safe-area-context`, NativeWind 4. 새 의존성은 추가하지 않는다.

**Storage**: 새 영속 저장소 없음. 파트 prelude 완료 여부와 45초 읽기 잔여 시간은 mounted
시험 화면의 메모리에만 두며, 기존 답변 cache 파일·제출 registry 정책은 변경하지 않는다.

**Testing**: `pnpm lint`, `pnpm exec tsc --noEmit`, `git diff --check`, mock session 기반 수동
화면 검증, iOS/Android 실기기 오디오·AppState 검증. 자동 테스트 러너는 현재 없다.

**Target Platform**: Expo 57이 지원하는 iOS 및 Android 휴대폰·태블릿

**Project Type**: Expo React Native mobile application

**Performance Goals**: 오디오 종료와 timer 종료를 1초 이내 화면 phase에 반영하고, 최대 11개
실패 항목과 큰 글자에서도 끊김 없이 스크롤하며, 100ms countdown 갱신이 문제·녹음 UI를
불필요하게 다시 시작하지 않게 한다.

**Constraints**: Part 3 안내는 정상 오디오 종료 전 문제로 진행할 수 없고, Part 4 정보 표는
최대 45초 동안 제공하되 사용자가 준비 완료를 선택하면 Q8 준비로 바로 이동한다. Part 4 읽기
시간은 문항별 3초 준비와 별도다. mock의 번들 오디오는 정적 `require()`가 필요하며 production은 기기에서
접근 가능한 remote URL을 사용한다. 개별 문제 `audioUrl` 재생 추가는 승인 범위 밖이다.

**Scale/Scope**: 5개 파트, 11개 문항, Part 3/4 prelude 2종, 오류 phase 1종, 최대 11개 제출
실패 카드, controller·mapper·시험 화면과 4~6개 presentation component 중심의 변경

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

1. `SoundTestScreen`은 API base URL이 준비되지 않은 현재 개발 상태에서
   `createMockExamSession()`을 사용해 세션을 만든다. 실제 `createExamSession()`과 trial API도
   같은 `mapExamSession()` 경계를 사용한다.
2. raw/domain 문항에는 이미 `partIntroText`, `guideAudioUrl`, `tableContext`가 있지만 mapper는
   값의 위치·공백·충돌을 검사하지 않고 각 문항에 그대로 전달한다.
3. mock Q5에는 Part 3 상황 텍스트가 있고 번들에는 `part3_intro.wav`가 있지만 mock 응답의
   `guideAudioUrl`은 비어 있어 현재 필수 Part 3 계약을 만족하지 않는다.
4. Part 4 Q8~Q10 mock 문항은 같은 표 값을 반복한다. `ExamQuestionContent`는 각 문항의 표를
   표시하지만 Part 4 시작 전의 45초 표 전용 phase는 없다.
5. controller는 모든 새 파트를 `directions → preparation → response`로 처리한다.
   `completeDirections()`가 Part 3/4의 별도 사전 단계 없이 바로 문항별 준비 시간을 시작한다.
6. `part-meta.ts`는 Part 4 문항별 준비 시간을 3초로 두고, 별도의 45초 reading phase가 필요함을
   이미 주석으로 명시한다.
7. `ExamSessionScreen`의 root와 safe-area가 모두 베이지색이며 Part 1 참고 지문과 part badge,
   제출 실패 카드에도 베이지 계열 배경이 사용된다. 반대로 디렉션 콘텐츠에는 별도 카드가 없다.
8. 마지막 `submission-barrier`는 `flex-1` 고정 View 안에서 상태 전체를 가운데 정렬한다.
   실패 카드가 화면보다 길어지면 overflow가 잘리며 scroll container가 없어 아래 재시도
   버튼에 접근할 수 없다.
9. Part 4 질문 텍스트는 기존 UI에서 의도적으로 숨겨져 있고 개별 문항 `audioUrl`도 아직
   재생하지 않는다. 이 계획은 승인된 범위에 따라 파트 사전 단계와 표 표시만 다루며, 개별
   질문 오디오 흐름은 별도 기능으로 남긴다.

## Design Options

### Option A - Screen-local 조건과 timer 추가

`ExamSessionScreen`이 part number를 보고 별도 boolean, audio player, timer를 관리하되 기존
controller는 계속 `preparation` 상태를 유지한다.

- 장점: controller와 도메인 타입의 초기 diff가 작다.
- 비용: 화면과 controller가 서로 다른 현재 phase를 갖는다.
- 실패 모드: 화면에서 표나 안내를 보여주는 중 controller의 preparation timer가 만료되어
  뒤에서 녹음을 시작할 수 있고, 중복 audio/timer event와 문항 재시도 정책이 분산된다.

### Option B - 명시적 controller phase와 파트 단위 prelude 계약

mapper가 Part 3/4의 사전 데이터를 session-level discriminated prelude로 정규화하고,
controller가 `part3-intro`, `part4-reading`, `part-prelude-error`를 기존 phase union에 추가한다.
전용 presentation component는 오디오·표를 표시하고 event만 controller에 전달한다.

- 장점: recorder를 시작할 수 있는 phase가 기존 allow-list로 계속 제한되고, Part 3 1회 재생,
  Part 4 45초, 오류 차단과 중복 event 방지가 한 상태 경계에서 검증된다.
- 비용: domain shape와 phase가 늘고 component/controller callback에 generation·phase guard가
  필요하다.
- 실패 모드: focus/AppState를 고려하지 않으면 가려진 화면에서도 timer가 흐르거나 오디오
  종료가 다음 phase를 열 수 있으므로 명시적인 활성 상태 guard가 필요하다.

### Option C - 전체 시험을 event-driven reducer/step queue로 재작성

directions, prelude, question, preparation, recording, submission을 모두 하나의 generic step
queue 또는 reducer state machine으로 다시 정의한다.

- 장점: 모든 전환을 하나의 event table로 만들 수 있고 향후 파트 규칙 확장이 쉽다.
- 비용: 이미 구현된 recorder/submission Promise와 파일 소유권 흐름까지 함께 다시 연결해야
  하며 현재 요청보다 회귀 범위가 크게 늘어난다.
- 실패 모드: Part 3/4 UI 수정 때문에 검증 중인 녹음·업로드 생명주기를 동시에 흔들 수 있다.

## Decision

Option B를 채택한다.

1. raw API 문항 필드는 optional로 유지한다. mapper는 세션에 존재하는 Part 3/4만 검사하고
   Part 1-only trial session에는 Part 3/4 데이터를 요구하지 않는다.
2. `ExamSession`에는 직렬화 가능한 part prelude 목록을 추가한다. Part 3은 정상 텍스트와
   guide URL, Part 4는 Q8의 canonical table과 45초 duration을 가진다. 누락·위치 오류·충돌은
   mapper throw가 아니라 typed invalid prelude로 남겨 해당 파트에서 복구 UI를 표시한다.
3. Part 3 필수 문자열은 trim 후 비어 있지 않아야 하며 첫 Part 3 문항에 함께 존재해야 한다.
   mock에는 `/assets/audio/part3_intro.wav` logical path를 추가하고 static resolver가 이를
   번들 `require()`로, production HTTP(S) URL은 remote source로 변환한다.
4. Part 4 Q8의 유효한 `tableContext`를 파트의 canonical shared table로 삼는다. 이는 표를 한
   번만 표시한다는 뜻이 아니라, 동일한 표를 45초 사전 읽기와 Q8·Q9·Q10 문제 화면에서
   계속 렌더링한다는 뜻이다. Q9/Q10의 동일한 반복 값은 canonical 객체로 접고, later-only
   또는 충돌 값은 invalid로 처리하며 서로 다른 표를 합치지 않는다.
5. 새 파트는 기존처럼 directions부터 시작한다. directions 완료 후 Part 1/2/5는 preparation,
   valid Part 3은 `part3-intro`, valid Part 4는 `part4-reading`, invalid 데이터는
   `part-prelude-error`로 전환한다.
6. Part 3 전용 component는 상황 텍스트를 흰색/중립 카드에 보여주고 안내 음성을 처음부터
   재생한다. 정상 terminal event만 controller에 완료를 알리며 component guard와 phase guard를
   함께 사용해 중복 종료 event를 한 번으로 만든다.
7. Part 3 재생 실패·media reset·inactive/blur는 정상 완료가 아니다. 재시도는 같은 안내를
   처음부터 재생하고, 불변 세션 데이터 자체가 invalid면 문제·녹음을 열지 않고 시험 이탈만
   제공한다.
8. Part 4 전용 component는 추출한 공용 표 presentation만 표시하고 `READING TIME` 45초를
   제공한다. table layout이 확인된 뒤 countdown을 시작한다. 화면이 inactive/blur인 동안에는
   잔여 시간을 보존하고, 다시 보이는 동안만 새 deadline으로 이어서 총 45초의 실제 표 노출
   시간을 보장한다. 준비 완료 action은 남은 읽기 시간만 생략하고 Q8의 3초 preparation으로
   전환한다.
9. Part 3/4 prelude 완료 여부는 mounted 시험 run의 Set으로 보존한다. Q6/Q7, Q9/Q10 및 Q5/Q8
   녹음 재시도는 prelude를 반복하지 않고 현재 문항의 preparation/recording recovery만 수행한다.
10. `ExamInformationTable`을 별도 component로 추출해 Part 4 pre-read와 Q8~Q10이 동일한
    responsive/accessibility 표현을 공유한다.
11. 시험 root와 safe-area, 문제 콘텐츠는 흰색으로 바꾸고 참고 지문·badge·실패 카드는 흰색
    또는 `surface-muted`를 사용한다. directions component는 rounded card 없이 전체 배경에
    `surface-subtle` 베이지를 적용하며 theme token은 추가하지 않는다.
12. `submission-barrier`와 `completed` 분기는 safe-area 안의 전용 vertical ScrollView로
    감싼다. 긴 실패 목록은 상단부터 자연스럽게 스크롤하고, 짧은 loading/completed 상태만
    별도 wrapper로 중앙 정렬해 overflow가 음수 방향으로 잘리지 않게 한다.
13. 실패 카드와 버튼에는 고정 높이·`numberOfLines`·`maxHeight`를 두지 않는다. 안정적인
    Answer Key를 유지해 상태 변경 중에도 남은 복구 action을 누를 수 있게 하고 bottom inset과
    추가 content padding으로 마지막 버튼 전체를 터치 가능하게 한다.
14. 기존 답변 upload/submit retry 정책, recorder 상태, 문항별 timing 및 navigation route는
    변경하지 않는다. 현재 사용되지 않는 개별 question `audioUrl` 재생은 별도 승인 기능으로
    남긴다.

## Failure and Recovery Paths

| Failure or interruption | Required state/result | Recovery |
|---|---|---|
| Part 3 text 또는 guide URL 누락·공백·위치 오류 | `part-prelude-error`, Q5/recorder 차단 | 오류 안내 후 시험 이탈; 새 유효 세션으로 다시 시작 |
| 알려지지 않은 local asset path | native player에 전달하지 않고 prelude invalid | 시험 이탈; mock/서버 계약 수정 |
| Part 3 remote audio start/decode/network 실패 | 상황 텍스트 유지, 완료로 처리하지 않음 | 처음부터 오디오 재시도 또는 시험 이탈 |
| Part 3 재생 중 inactive/blur/media reset | player pause, Q5로 진행하지 않음 | foreground/focus에서 전체 안내 재생 |
| Part 3 종료 event 중복 | 첫 phase guard만 전환 | 이후 event 무시 |
| Q8 canonical 표 누락·invalid | `part-prelude-error`, 45초/Q8/recorder 차단 | 오류 안내 후 시험 이탈 |
| Q9/Q10에 later-only 또는 다른 표 | 표를 합치거나 바꾸지 않고 invalid | Q8 시작 전 오류 안내 |
| Part 4 table layout 전 timer event | countdown 시작하지 않음 | layout 완료 후 45초 시작 |
| Part 4 읽기 중 inactive/blur | 잔여 시간 보존, background 전환·녹음 없음 | 다시 보일 때 남은 시간부터 재개 |
| Part 4 timer 종료와 blur 경쟁 | active/focused phase guard 하나만 승리 | blur 우선이면 focus 후 안전하게 전환 |
| 같은 문항 녹음 interruption/retry | prelude completed marker 유지 | 같은 문항 전체 답변 시간만 재시도 |
| 제출 실패 카드가 viewport 초과 | submission page scroll 유지 | 마지막 항목까지 scroll 후 개별 retry |
| 큰 글자·긴 오류 메시지 | 카드와 버튼 자연 높이, 잘림 없음 | safe-area scroll로 전체 action 접근 |
| retry 중 항목 성공/제거 | 남은 stable-key 항목 유지, offset clamp | 남은 실패 항목 계속 retry |
| screen unmount | player/timer cleanup, 늦은 callback 무효화 | 새 시험 run에서 처음부터 시작 |

## Developer Explain-Back

- [x] The affected files and their responsibilities can be explained.
- [x] The changed data and state transitions can be described in order.
- [x] The selected tradeoffs and rejected alternatives can be explained.
- [x] The validation and rollback approach can be explained.

## Project Structure

### Documentation (this feature)

```text
specs/002-part-aware-question-flow/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── session-prelude-contract.md
│   └── exam-presentation-contract.md
└── tasks.md                 # /speckit-tasks에서만 생성
```

### Source Code (repository root)

```text
src/
├── features/exam/
│   ├── map-exam-session.ts             # raw 문항을 session prelude/canonical table로 정규화
│   ├── part-prelude.ts                  # prelude validation, 45초 규칙, audio source resolution
│   └── mocks/exam-session.ts            # Part 3 bundled guide와 Part 4 shared table fixture
├── screens/mock-exam/
│   ├── ExamSessionScreen.tsx            # phase rendering, focus bridge, submission scroll
│   ├── components/
│   │   ├── ExamPartDirectionsContent.tsx # 유일한 beige direction card
│   │   ├── ExamPartIntroContent.tsx      # Part 3 text/audio lifecycle와 recovery
│   │   ├── ExamInformationReading.tsx    # Part 4 table-only 45초 presentation
│   │   ├── ExamInformationTable.tsx      # pre-read와 Q8~Q10 공용 표
│   │   ├── ExamQuestionContent.tsx       # white/neutral 문제와 canonical table
│   │   ├── ExamAnswerStatus.tsx          # neutral 실패 카드와 stable actions
│   │   └── ExamTimerCard.tsx             # reading/preparation/response labels
│   └── hooks/
│       └── use-exam-session-controller.ts # explicit prelude phases와 transition guards
└── types/exam.ts                         # serializable normalized prelude domain types
```

**Structure Decision**: 기존 단일 Expo 앱과 `Raw → mapper → domain → controller → presentation`
경계를 유지한다. 파트 데이터 정규화는 feature 계층, 시험 phase는 screen hook, native audio와
UI는 전용 component, 공용 표는 presentation component에 둔다. 새 navigation route나 전역
store를 만들지 않는다.

## Post-Design Constitution Check

- [x] Approved spec and all selected product policies are reflected in explicit state transitions.
- [x] Expo-native audio, AppState, navigation focus, safe-area and React Native scroll APIs are used.
- [x] Raw optional fields are normalized before UI consumption and navigation params remain serializable.
- [x] Shared Text, Pressable, theme tokens, mapper, timer and answer state machines are reused.
- [x] Three approaches and their race/failure modes are documented.
- [x] Validation covers static checks, missing/conflicting data, audio/timer races, responsive scroll and both native platforms.
- [x] No dependency, lockfile, secret, backend write, Jira write, commit or push is required.

**Integration Gate**: 실제 `/api/v1/exams` 응답에서 Part 3 필드 위치·URL 형식과 Part 4 Q8~Q10
표 반복 규칙을 확인해야 production 완료 증거가 성립한다. 확인 전에도 mock과 typed invalid
상태로 UI·state safety는 검증할 수 있지만 remote guide playback과 real canonical table은
통합 완료로 주장하지 않는다.

## Complexity Tracking

Constitution 위반 없음. 별도 예외 정당화가 필요하지 않다.
