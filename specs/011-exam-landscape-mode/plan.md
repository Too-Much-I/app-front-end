# Implementation Plan: Part 4 표 가로 전체화면

**Branch**: `011-exam-landscape-mode` | **Date**: 2026-08-07 | **Spec**:
[spec.md](./spec.md)

**Approval**: Draft plans MUST be approved before tasks or implementation begin.

**Input**: Feature specification from `/specs/011-exam-landscape-mode/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

앱과 시험 화면의 기본 방향은 세로로 유지하고, Part 4 표 안의 전용 버튼만 가로 전체화면을
요청할 수 있게 한다. Expo SDK 57 호환 `expo-screen-orientation`으로 런타임 방향 잠금을
관리하며, 앱 최상단의 방향 provider가 `portrait → entering-landscape → landscape →
restoring-portrait` 상태를 직렬화한다. 기존 `PortraitOnlyNotice`는 이 명시적 예외 동안만
숨긴다.

가로 표는 navigation route가 아니라 현재 `ExamSessionScreen` 위의 React Native
전체화면 `Modal`로 표시한다. 따라서 시험 화면의 focus와 controller instance, 음성 cue,
recorder가 그대로 유지되어 숨겨진 타이머와 자동 단계 전환이 계속된다. 표 데이터와 renderer는
기존 `Part4Table`을 재사용하고, modal은 세로 스크롤·safe area·상태 표시줄 숨김·복귀 행동만
책임진다.

## Technical Context

**Language/Version**: strict TypeScript 6.0, React 19.2

**Primary Dependencies**: Expo 57, React Native 0.86, React Navigation 7, NativeWind 4.2,
`expo-screen-orientation ~57.0.1` 추가; Expo 57 bundled native module 버전으로 호환성 확인

**Storage**: N/A — 가로 보기 상태는 현재 앱 실행과 시험 화면 수명 동안만 유지

**Testing**: `pnpm lint`, `pnpm exec tsc --noEmit`, Expo prebuild 결과 확인, iOS/Android
시뮬레이터·에뮬레이터와 휴대폰·태블릿 실기기 수동 검증; 자동 test runner는 구성되어 있지 않음

**Target Platform**: Expo 기반 iOS 및 Android 휴대폰·태블릿; web은 방향 잠금 보장 범위 밖이며
지원하지 않는 환경에서는 기존 세로 레이아웃을 유지

**Project Type**: React Native mobile application

**Performance Goals**: 버튼 입력 한 번으로 한 번의 방향 전환만 예약하고, 기존 최대 6열·10행
표의 가로·세로 스크롤에서 체감 지연이 없으며, 전환 중 timer/audio/recorder instance 재생성이
0건일 것

**Constraints**: 기본 세로 잠금, 버튼 전용 가로 trigger, 가로 보기 중 timer/audio/recording
지속, 기존 전역 가로 자세 안내와 충돌 금지, Part 4 밖에서는 세로 자동 복구, large text와
safe area 지원, iPad runtime lock을 위한 full-screen requirement, 새 navigation route 금지

**Scale/Scope**: Part 4 읽기와 Q8~Q10의 두 화면 경로, 하나의 공용 table renderer, 하나의
전역 orientation coordinator, iPhone/iPad/Android phone/tablet 네 device class

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] The specification is approved and separates facts, assumptions, scope, out-of-scope behavior, and open questions.
- [x] Acceptance criteria describe observable behavior and include failure or interruption paths.
- [x] The design uses Expo/React Native APIs and preserves strict TypeScript and existing architectural boundaries.
- [x] Existing shared UI, theme, navigation, API, mapper, and domain layers are reused where applicable.
- [x] At least two viable approaches were considered, or the plan explains why only one approach is practical.
- [x] The validation plan includes `pnpm lint`, `pnpm exec tsc --noEmit`, and relevant manual or device checks.
- [x] No secret or unapproved Jira write, commit, push, dependency addition, or other external side effect is required.

**Pre-research gate**: PASS. 사용자가 승인한 명세만 계획하며 외부 상태를 변경하지 않았다.
`expo-screen-orientation` 추가는 이 계획의 승인 후에만 수행하는 명시적 구현 항목이다.

**Post-design re-check**: PASS. Phase 1은 Expo 공식 native module, 기존 provider/shared UI
패턴과 현재 table domain을 사용한다. navigation/API/mapper/storage 경계는 바꾸지 않으며 새
dependency와 iPad full-screen trade-off는 research와 validation에 명시했다.

## Current Flow

1. `app.json`은 `orientation: "portrait"`를 선언하고 `with-ipad-portrait-only`가 iPad의
   supported orientation도 portrait로 덮는다. 현재 ignored generated 결과는 iOS가 portrait
   배열인 반면 Android manifest가 `unspecified`인 stale 상태이므로, 선언형 config를 source of
   truth로 유지하고 native rebuild 뒤 실제 portrait 생성 결과를 별도로 검증해야 한다.
2. `App.tsx`는 navigation 바깥에 `PortraitOnlyNotice`를 두고, 이 컴포넌트가 accelerometer와
   window ratio로 물리적 가로 자세를 감지해 모든 화면 위에 세로 복귀 안내 modal을 표시한다.
3. `ExamSessionScreen`은 `useIsFocused()`와 `AppState`가 모두 active일 때만
   `useExamSessionController`의 timer, cue와 recorder lifecycle을 진행한다.
4. Part 4 읽기에서는 `ExamInformationReading → Part4Table`, Part 4 문제에서는
   `ExamQuestionContent → Part4Table` 경로로 같은 canonical `ExamTableContext`를 표시한다.
5. 읽기 화면의 바깥 vertical `ScrollView`와 문제 화면의 바깥 vertical `ScrollView`가
   title부터 notes까지 세로 이동을 담당하고, `Part4Table` 내부 `ScrollView`는 grid 열만
   가로 이동시킨다.
6. `Part4Table`에는 현재 가로 보기 action이 없고, static native orientation mask도 landscape를
   허용하지 않으므로 layout state만 바꾸어서는 실제 화면을 가로로 전환할 수 없다.

## Design Options

### Option A - 현재 시험 화면 위 native modal + 전역 orientation coordinator

`ExamSessionScreen`을 navigation focus 상태로 둔 채 전체화면 `Modal`에 기존 `Part4Table`을
한 번 더 표시한다. 전역 provider가 Expo screen-orientation lock, 기본 세로 복구, 빠른 연속
요청 직렬화와 `PortraitOnlyNotice` 예외를 소유한다.

- 장점: controller, cue, timer, recorder와 submission hook이 unmount/blur되지 않는다. 세로
  화면과 가로 modal이 같은 domain 객체와 renderer를 사용해 표 표현 차이가 없다. 전역 안내와
  native orientation 요청의 단일 소유자가 생긴다.
- 비용: regular table과 modal table 두 native subtree가 일시적으로 함께 존재한다. 방향 상태와
  modal visibility를 일치시키는 transition state가 필요하다.
- 실패 모드: native lock rejection이나 입장/퇴장 요청 race가 생길 수 있다. 직렬 promise와
  마지막 요청 우선 복구, portrait fallback으로 제한한다.

### Option B - landscape 전용 navigation screen

Part 4 표를 typed route param으로 넘겨 landscape screen을 push하거나 modal route로 연다.
native-stack screen orientation option을 활용할 수 있다.

- 장점: 화면 책임과 orientation option이 route 단위로 명확하고 landscape layout이 독립적이다.
- 비용: 현재 `ExamSessionScreen`의 `useIsFocused()`가 false가 되어 reading/preparation timer,
  audio cue와 recorder가 pause/cleanup 경로를 탈 수 있다. 계속 진행시키려면 focus 정의와
  controller 소유권을 navigation 밖으로 옮겨야 한다.
- 실패 모드: route push/pop과 answer transition이 겹치면 stale table 또는 종료된 exam으로
  복귀할 수 있고 non-serializable/복제 param 관리가 추가된다.

### Option C - 방향은 세로로 둔 채 표만 90도 회전

표 view에 시각 transform을 적용하고 width/height를 교환해 가로처럼 보이게 한다.

- 장점: native supported orientation과 전역 세로 안내 설정을 바꾸지 않아도 된다.
- 비용: 기기 좌표계, safe area, status bar와 gesture 방향은 세로로 남는다. 접근성 focus bounds와
  nested scroll gesture가 화면과 어긋나며 실제 landscape viewport를 얻지 못한다.
- 실패 모드: 긴 표 clipping, 잘못된 터치 좌표와 screen reader 탐색 순서 문제를 만들 수 있다.

## Decision

Option A를 선택한다. 시험 진행 lifecycle을 유지한다는 요구가 핵심이므로 navigation focus를
바꾸지 않는 것이 우선이다. `Modal`은 현재 screen의 child로 열어 controller와 모든 자동 진행
컴포넌트를 그대로 mount하고, modal의 table에는 `onReady`를 전달하지 않아 45초 timer ready
signal을 중복 발생시키지 않는다.

`OrientationProvider`는 앱 최상단에서 다음 API와 상태를 소유한다.

- `portrait`: 기본 상태. native lock은 `PORTRAIT_UP`이고 일반 가로 자세 안내가 활성화된다.
- `entering-landscape`: 버튼 입력 직후. 안내를 먼저 억제하고 지원 여부를 확인한 뒤
  `LANDSCAPE` lock을 요청한다.
- `landscape`: lock 성공 상태. Part 4 modal을 유지한다.
- `restoring-portrait`: close/back/Part 4 종료/화면 unmount 후 마지막 pending transition을
  기다리고 `PORTRAIT_UP`을 최종 요청한다.

입장과 복귀는 하나의 serialized transition chain으로 실행해 빠른 연속 입력이나 enter 중 back이
발생해도 마지막 portrait 요청이 최종 상태가 되게 한다. lock 실패 시 provider는 오류를 진단
로그로 남기고 portrait lock을 best-effort로 재적용한 뒤 `portrait`로 돌아간다. 사용자는 기존
세로 시험 화면과 버튼을 계속 사용할 수 있다.

native 설정은 다음처럼 바꾼다.

1. Expo 57이 지정한 `expo-screen-orientation ~57.0.1`을 `pnpm expo install`로 추가한다.
2. `app.json.orientation`은 Android와 일반 앱의 기본 세로 선언을 위해 `portrait`로 유지한다.
3. built-in config plugin의 `initialOrientation: "PORTRAIT_UP"`으로 iOS native module의 초기
   orientation mask를 세로로 둔다.
4. iPad runtime lock 조건인 `ios.requireFullScreen: true`를 선언한다. 이에 따라 Split View와
   Slide Over는 지원하지 않는다.
5. 기존 iPad-only portrait plugin을 iPhone/iPad의 `Info.plist` supported orientation에 portrait,
   landscape-left, landscape-right를 선언하는 runtime-support plugin으로 교체한다. 실제 기본
   방향은 initial/runtime portrait mask가 통제하고, 이 배열은 버튼 요청 시 landscape가
   device-supported lock이 되게 하는 capability declaration만 담당한다.

`Part4Table`은 optional `onRequestLandscape`를 받을 때만 전용 버튼을 표시한다. live reading과
live Part 4 question은 callback을 전달하고, reanswer는 전달하지 않아 명세 범위 밖 화면에 버튼이
생기지 않는다. `ExamSessionScreen`은 현재 phase/table에서 `activePart4Table`을 파생하고,
Part 4를 벗어나거나 screen이 unmount되면 반드시 portrait restore를 요청한다.

`Part4TableLandscapeModal`은 표 renderer와 독립적인 native presentation shell이다. status bar를
숨기고 notch/rounded corner safe area를 적용하며, fixed close control을 제외한 exam header,
progress, timer, waveform과 answer action을 포함하지 않는다. 바깥 vertical scroll과 기존 grid의
horizontal scroll을 조합하고, close control에는 label/hint/disabled state와 최소 touch target을
제공한다.

## Failure and Recovery Paths

- landscape policy를 지원하지 않는 device/web 환경이면 입장 요청을 취소하고 portrait 시험
  화면을 유지한다. 버튼은 다시 사용할 수 있고 blank modal을 남기지 않는다.
- `lockAsync(LANDSCAPE)`가 reject하면 안내 예외와 modal state를 해제하고 portrait lock을
  best-effort로 복구한다. cell 본문 같은 시험 데이터는 log에 넣지 않는다.
- enter promise가 끝나기 전에 close/back이 오면 restore 요청을 transition chain의 마지막에
  연결한다. landscape completion이 늦게 와도 최종 lock은 portrait다.
- 빠른 연속 button tap은 `portrait`에서 시작한 첫 요청 하나만 받으며 transition 동안 버튼과
  중복 요청을 잠근다.
- modal의 Android `onRequestClose`는 navigation pop이나 시험 종료 대신 portrait restore만
  실행한다.
- reading timer 만료나 준비 완료로 Q8로 넘어가도 canonical Part 4 table이 유지되는 동안 modal을
  계속 표시한다. timer와 cue는 뒤에서 기존 규칙대로 진행한다.
- Q10 이후 Part 5/submission으로 넘어가 `activePart4Table`이 사라지면 effect가 modal을 닫고
  portrait를 복구한다.
- exam exit, navigation replace, auth tree 교체나 component unmount에서는 cleanup이 portrait
  restore를 요청한다. provider 자체도 app mount 시 portrait를 best-effort로 재확인한다.
- provider는 foreground 복귀 시 현재 desired mode를 다시 적용한다. background 중 screen이
  제거되어 portrait가 desired mode가 됐다면 foreground의 첫 native request도 portrait다.
- app background 중 native module은 iOS에서 마지막 mask를 foreground에 재적용한다. screen이
  이미 사라진 경우 cleanup의 portrait request가 마지막 요청이 되며, 돌아왔을 때 일반 안내가
  다시 활성화된다.
- portrait restore가 reject해 실제 window가 landscape로 남아도 provider는 normal policy로
  복귀시켜 기존 `PortraitOnlyNotice`가 기기를 세로로 돌리도록 안내한다. 다음 app focus/mount에서
  portrait lock을 다시 시도한다.
- modal table은 `onReady`를 전달하지 않으므로 방향 전환 layout event가 reading timer를 reset하거나
  중복 start하지 않는다.
- rollback은 provider/modal/button/config plugin/dependency를 한 논리 단위로 되돌리고 기존
  `orientation: portrait`와 iPad portrait-only plugin을 복원한다.

## Developer Explain-Back

- [x] The affected files and their responsibilities can be explained.
- [x] The changed data and state transitions can be described in order.
- [x] The selected tradeoffs and rejected alternatives can be explained.
- [x] The validation and rollback approach can be explained.

## Project Structure

### Documentation (this feature)

```text
specs/011-exam-landscape-mode/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── landscape-table-ui-contract.md
└── tasks.md                             # /speckit-tasks output; plan 단계에서는 생성하지 않음
```

### Source Code (repository root)

```text
App.tsx                                      # OrientationProvider mount
app.json                                     # initial portrait, iPad full-screen, native plugins
package.json
pnpm-lock.yaml                               # Expo-compatible screen-orientation dependency
plugins/
├── with-ios-runtime-orientation-support.js  # iPhone/iPad supported orientation capability
└── with-ipad-portrait-only.js                # 제거
docs/superpowers/specs/
└── 2026-08-07-portrait-only-notice-design.md # Part 4 명시적 예외로 현재 정책 보완
src/
├── components/
│   ├── exam/
│   │   └── Part4Table.tsx                   # optional landscape action + shared renderer
│   └── ui/
│       └── PortraitOnlyNotice.tsx            # explicit table exception 동안 억제
├── features/
│   └── orientation/
│       ├── orientation-context.ts            # typed coordinator contract
│       └── OrientationProvider.tsx            # native lock state machine/serialization
└── screens/
    └── mock-exam/
        ├── ExamSessionScreen.tsx              # active table, modal lifecycle, cleanup
        └── components/
            ├── ExamInformationReading.tsx     # reading table action wiring
            ├── ExamQuestionContent.tsx        # Q8-Q10 table action wiring
            └── Part4TableLandscapeModal.tsx   # safe-area fullscreen table shell
```

**Structure Decision**: native 방향 정책과 전역 안내 예외는 `src/features/orientation/`이 소유하고,
exam domain data는 기존 `ExamTableContext`를 그대로 사용한다. 공유 table renderer는 action을
optional prop으로만 노출하며, live exam의 phase/table 결합과 modal은 `src/screens/mock-exam/`에
남겨 reanswer나 일반 UI가 시험 lifecycle에 의존하지 않게 한다. native capability는 CNG에서
재현되도록 config plugin과 `app.json`에 선언하고 generated `ios/`, `android/`는 추적하지 않는다.

## Complexity Tracking

해당 없음. 새 provider와 dependency는 native orientation의 단일 소유권과 실제 화면 회전에
필수이며, navigation 이동이나 transform 방식보다 lifecycle 변경 범위가 작다. Constitution
예외는 없다.
