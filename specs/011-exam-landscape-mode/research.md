# Research: Part 4 표 가로 전체화면

## Decision 1: Expo ScreenOrientation로 runtime lock을 관리한다

- **Decision**: Expo SDK 57 bundled version인 `expo-screen-orientation ~57.0.1`을 추가하고
  `lockAsync(PORTRAIT_UP)`과 `lockAsync(LANDSCAPE)`를 사용한다. 입장 전
  `supportsOrientationLockAsync(LANDSCAPE)`로 capability를 확인한다.
- **Rationale**: 공식 Expo 57 문서는 screen orientation 변경이 iOS/Android의 system preference를
  override하며 `lockAsync()` promise가 orientation 설정 완료 시 resolve한다고 명시한다. 현재
  앱처럼 static portrait mask만 있으면 실제 landscape viewport를 만들 수 없다.
- **Alternatives considered**: `Dimensions`는 현재 portrait lock에서 회전하지 않고 물리 자세만
  감지하므로 화면 전환 API가 될 수 없다. 90도 transform은 safe area, touch, accessibility bounds를
  회전시키지 못한다. browser orientation API는 native app 경계에 맞지 않는다.
- **Sources**:
  - Expo 57 ScreenOrientation docs: `https://docs.expo.dev/versions/v57.0.0/sdk/screen-orientation/`
  - Expo SDK 57 package source: `packages/expo-screen-orientation`
  - 프로젝트의 `node_modules/expo/bundledNativeModules.json`: `~57.0.1`

## Decision 2: native capability와 기본 세로 mask를 분리한다

- **Decision**: `app.json.orientation`은 portrait로 유지한다. iOS에는 supported interface
  orientations로 portrait와 양쪽 landscape를 선언하되 `expo-screen-orientation` config plugin의
  `initialOrientation: PORTRAIT_UP`과 app-level provider가 실제 초기/default mask를 portrait로
  유지한다.
- **Rationale**: iOS module은 requested mask가 device-supported인지 검사한다. Info.plist에서
  landscape capability를 제거한 현재 custom plugin 상태로는 runtime landscape lock을 신뢰할 수
  없다. 반대로 supported 배열을 넓히기만 하면 launch 자세에 따라 일반 화면이 landscape가 될 수
  있으므로 native initial key와 runtime owner가 함께 필요하다. Android module은 Activity의
  `requestedOrientation`을 runtime에 바꾸므로 manifest 기본 portrait와 양립한다.
- **Repository verification**: Expo config-plugin 57.0.5의 Android orientation mod는
  `orientation: portrait`를 activity의 `android:screenOrientation="portrait"`로 생성하고, iOS
  mod는 iPhone supported array를 portrait values로 만든다. 현재 ignored native directory의
  Android `unspecified`는 declarative config와 달라 rebuild validation 대상으로 분류한다.
- **Alternatives considered**: `orientation: default`로 전체 앱을 unlock하면 버튼 전용 trigger와
  default portrait 요구를 위반한다. landscape-only static config는 일반 화면을 깨뜨린다.

## Decision 3: iPad는 full-screen app으로 명시한다

- **Decision**: `ios.requireFullScreen: true`를 설정하고 기존 iPad portrait-only plugin을 iPhone과
  iPad의 runtime landscape capability를 선언하는 plugin으로 교체한다.
- **Rationale**: Expo 57 공식 경고는 iPad Split View 지원 상태에서 screen orientation lock을
  사용하려면 split view를 비활성화해야 한다고 명시한다. 현재 앱도 세로-only 방침 때문에
  multitasking 제외 가능성을 이미 수용했으며 이번에는 runtime lock 성공을 위해 명시적으로
  full-screen을 요구한다.
- **Alternatives considered**: Split View를 유지하면 iPad가 system 관점에서 landscape로 취급되어
  lock 결과가 일관되지 않을 수 있다. iPad에서 버튼을 숨기면 phone/tablet 동일 결과 요구를
  위반한다.

## Decision 4: navigation route가 아닌 in-place native Modal을 사용한다

- **Decision**: `ExamSessionScreen` child인 React Native `Modal`에서 가로 table을 표시한다.
- **Rationale**: current exam activity는 `useIsFocused() && AppState.active`에 묶여 있다. route를
  push하면 원래 screen focus가 false가 되어 reading/preparation timer, audio cue와 recorder가
  pause 또는 cleanup될 수 있다. Modal은 navigation focus와 controller hook instance를 유지한다.
- **Alternatives considered**: native-stack orientation route는 per-screen 방향이 명료하지만 exam
  controller를 stack 외부로 이동하거나 focus 규칙을 예외 처리해야 한다. 같은 screen의 조건부
  root 교체는 cue/player/status component를 unmount할 수 있어 기각했다.

## Decision 5: 전역 provider가 방향 예외와 안내 억제를 함께 소유한다

- **Decision**: `OrientationProvider`가 네 상태(`portrait`, `entering-landscape`, `landscape`,
  `restoring-portrait`)와 serialized transition을 제공한다. `PortraitOnlyNotice`는 provider가
  explicit landscape request 상태일 때만 물리 가로 자세 신호를 무시한다.
- **Rationale**: screen에서 lock하고 notice가 독립적으로 sensor를 읽으면 버튼 직후 기존 안내
  modal이 가로 table을 덮는 race가 생긴다. 한 owner가 예외를 먼저 선언하고 native request를
  실행해야 UI와 정책이 일치한다.
- **Alternatives considered**: module-level mutable boolean은 React update와 cleanup 보장이 약하다.
  Zustand store는 이미 설치되어 있지만 이 작은 lifecycle state를 위해 전역 store surface를
  넓힐 이유가 없다. screen-local state만으로는 App-level notice가 알 수 없다.

## Decision 6: 표 renderer는 재사용하고 presentation shell만 추가한다

- **Decision**: 기존 `Part4Table`에 optional `onRequestLandscape` action을 추가하고,
  `Part4TableLandscapeModal`이 vertical scroll, status bar hidden, safe area와 close control을
  담당한다. modal renderer에는 `onReady`를 전달하지 않는다.
- **Rationale**: title/subtitle/metadata/grid/status/note formatting과 accessibility semantics는
  세로·가로에서 같아야 한다. presentation shell만 분리하면 재답변은 callback을 넘기지 않아
  자연스럽게 범위 밖으로 남고, duplicate ready signal도 막을 수 있다.
- **Alternatives considered**: landscape 전용 table markup은 두 renderer가 drift할 가능성이 높다.
  button을 각 parent에 따로 만들면 reading/question 위치와 accessibility 규칙이 중복된다.

## Decision 7: 마지막 요청이 portrait가 되도록 transition을 직렬화한다

- **Decision**: enter/restore native call은 하나의 pending promise chain에 연결하고, mode가
  `portrait`일 때만 enter를 수락한다. restore는 current transition 종료 후 항상
  `PORTRAIT_UP`을 마지막으로 요청하며 결과와 무관하게 UI를 recoverable portrait policy로 돌린다.
  AppState가 foreground로 돌아오면 provider가 현재 desired mode를 다시 적용한다.
- **Rationale**: `lockAsync`는 비동기이고 빠른 double tap, enter 중 Android back, phase change와
  unmount가 겹칠 수 있다. 단순 boolean과 fire-and-forget cleanup은 늦은 landscape completion이
  portrait restore를 덮을 수 있다.
- **Alternatives considered**: debounce만으로는 in-flight native call 순서를 보장하지 않는다.
  모든 call을 병렬 실행하면 실제 orientation과 React state가 갈라질 수 있다.

## Decision 8: 오류 UI를 새로 만들지 않고 세로 화면으로 즉시 fallback한다

- **Decision**: unsupported/rejected lock은 진단 log 후 portrait screen과 enabled button으로
  복구한다. restore failure에서 실제 window가 landscape면 기존 `PortraitOnlyNotice`가 수동
  세로 복귀를 안내한다.
- **Rationale**: 오류가 시험 진행을 막아서는 안 되고 별도 toast 체계가 없다. 기존 세로 table은
  이미 모든 정보에 scroll로 접근 가능하므로 안전한 fallback이다.
- **Alternatives considered**: blocking error modal은 timer가 계속되는 시험에서 사용자를 더 오래
  가둔다. silent blank modal은 recovery requirement를 위반한다.
