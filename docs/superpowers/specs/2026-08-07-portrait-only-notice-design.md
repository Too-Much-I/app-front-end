# 가로 회전 시 세로 모드 전용 안내 설계

## 배경

앱은 세로로 완전히 잠겨 있다.

- `app.json:6` — `"orientation": "portrait"`
- `android/app/src/main/AndroidManifest.xml:28` — `android:screenOrientation="portrait"`
- `ios/app/Info.plist` — iPhone은 `UIInterfaceOrientationPortrait` / `PortraitUpsideDown`만

사용자가 기기를 눕혀도 화면이 그대로라, 왜 안 돌아가는지 알 수 없다. 이 설계는 **기기가 가로로 눕혀졌을 때 "세로 모드만 지원합니다"를 알리는 전역 오버레이**를 추가한다.

이 기능의 성격을 분명히 해둔다. **버그를 막는 것이 아니라 이미 잠긴 동작을 설명하는 안내다.** 그 대가로 상시 동작하는 가속도 센서 리스너와 네이티브 의존성(`expo-sensors`)이 붙는다. 이 trade-off는 사용자가 인지하고 승인했다.

## 사전 확인 사항

### 화면이 잠겨 있어서 `Dimensions`로는 감지할 수 없다

화면 방향이 고정되면 회전해도 `Dimensions` / `useWindowDimensions` 값이 바뀌지 않는다. JS에서 관측 가능한 신호가 없으므로 **가속도 센서로 기기의 물리적 자세를 읽는 것이 유일한 방법**이다.

### iPad는 지금 가로로 돌아간다 — 이것부터 막는다

`ios/app/Info.plist`의 `UISupportedInterfaceOrientations~ipad`에는 `LandscapeLeft` / `LandscapeRight`가 들어 있고 `app.json:11`이 `"supportsTablet": true`다. Expo가 `orientation: "portrait"`이어도 iPad에는 네 방향을 모두 넣는다. **즉 iPad에서는 앱이 실제로 가로로 회전한다.**

결정된 방침은 **태블릿 지원은 유지하되 세로 전용**이다. 따라서 iPad의 가로 항목을 제거해 다른 플랫폼과 동일하게 잠근다. Android는 `app.json`의 `orientation: "portrait"`이 매니페스트의 `android:screenOrientation="portrait"`로 이미 반영돼 태블릿에도 적용되므로 추가 작업이 없다.

### `Info.plist` 직접 수정은 유지되지 않는다

`.gitignore:22-23`이 `ios`와 `android`를 제외하고 있고, `git ls-files`로 확인한 결과 두 디렉터리는 **git에 추적되지 않는다.** 이 저장소는 Expo의 CNG(Continuous Native Generation) 방식이라 네이티브 프로젝트가 `expo prebuild`로 생성된다.

따라서 `Info.plist`를 손으로 고치면 그 수정은 **이 머신의 생성물에만 존재한다.** 새로 클론한 작업 공간에는 `ios/` 자체가 없어 prebuild로 다시 만들어야 하고, 그 결과물에는 손수정이 없다. `expo prebuild --clean`이나 SDK 업그레이드에서도 같은 이유로 사라진다. 현재 `eas.json`과 CI 워크플로가 없어 로컬 빌드만 쓰지만, EAS를 붙이면 클라우드 prebuild가 같은 문제를 일으킨다.

**config plugin으로 선언해야 한다.** 그래야 방향 잠금이 `app.json`에 남아 어느 환경에서 prebuild하든 동일하게 재현된다.

### 그 결과 치수 신호는 거의 항상 비활성이다

iPad까지 잠그면 모든 구성에서 앱이 회전하지 않으므로 `useWindowDimensions`는 landscape를 보고하지 않는다. 그래도 치수 신호를 남긴다. 코드가 세 줄이고, iPadOS의 멀티태스킹·윈도잉처럼 기기 방향과 무관하게 창 비율이 가로로 바뀔 수 있는 경로에 대한 안전망이 된다. 센서 판정이 주 경로이고 치수는 보조다.

| 실행 환경 | 회전 여부 | 동작하는 신호 |
| --- | --- | --- |
| iPhone | 잠김 | 센서 |
| Android (폰/태블릿) | 잠김 | 센서 |
| iPad (이 작업 후) | 잠김 | 센서 |
| iPad (iPhone 호환 모드) | 잠김 | 센서 |
| iPadOS 창 비율이 가로가 되는 경우 | — | 치수 (안전망) |

**부수 효과 하나를 명시한다.** iPad를 세로로 잠그면 iPadOS가 앱을 Split View / Slide Over 대상에서 제외할 수 있다. 멀티태스킹에는 전 방향 지원이 요구되기 때문이다. "세로 전용"을 선택한 이상 받아들이는 비용이며, iPadOS 26의 새 윈도잉에서 실제로 어떻게 동작하는지는 실기기 확인 항목으로 둔다.

### 전역 마운트 지점이 이미 있다

`App.tsx:28`의 `<View className="flex-1">`가 `NavigationContainer`와 `StatusBar`를 감싼다. 여기에 형제로 오버레이를 넣으면 모든 화면 위에 뜬다. 화면마다 붙일 필요가 없다.

### 웹뷰 위에도 그려진다

`FeedbackScreen.tsx`와 `SettingsWebViewScreen.tsx`의 `WebView`는 RN 트리 안의 네이티브 자식 뷰다. RN `Modal`과 absolute 오버레이는 그 위에 정상적으로 그려지므로 웹뷰 화면에서도 안내가 보인다. 웹 콘텐츠 자체도 액티비티가 세로로 잠겨 있어 함께 회전하지 않는다.

### 검증이 필요한 항목

- **iOS 권한.** `expo-sensors`의 `DeviceMotion` / `Pedometer`는 `NSMotionUsageDescription`을 요구한다. 순수 `Accelerometer`도 요구하는지는 실기기에서 확인해야 한다. 필요하면 `app.json`의 plugins에 `expo-sensors` 항목과 권한 문구를 추가한다.
- **`Accelerometer.isAvailableAsync()`** 가 false인 기기(일부 에뮬레이터, 태블릿)에서의 경로.

## 범위

### 포함

1. `plugins/with-ipad-portrait-only.js` 신설 — iPad를 세로로 잠그는 config plugin
2. `app.json` — plugin 등록, 필요 시 iOS 모션 권한 문구
3. `expo-sensors` 의존성 추가 (`pnpm expo install expo-sensors`)
4. `src/features/orientation/use-landscape-detection.ts` 신설 — 센서 + 치수 결합 감지 훅
5. `src/components/ui/MascotModal.tsx` 신설 — 마스코트 모달 공용 껍데기
6. `src/components/ui/ConfirmModal.tsx` 수정 — 렌더를 `MascotModal`에 위임 (공개 API 불변)
7. `src/components/ui/PortraitOnlyNotice.tsx` 신설 — 전역 오버레이
8. `App.tsx` — 오버레이 마운트

### 제외

- **태블릿 지원 자체를 끊는 것.** `supportsTablet: true`와 Play Console의 태블릿 노출을 유지한다. 태블릿에서 세로로 잘 동작하게 만드는 것이 방침이다.
- **가로 레이아웃 지원.** 세로만 지원한다는 안내가 목적이고, 가로 대응은 하지 않는다.
- **태블릿 전용 레이아웃.** 화면 크기 대응은 `2026-08-07-responsive-scaling-design.md`의 비례 스케일링으로만 다룬다.
- **rem 스케일링.** `2026-08-07-responsive-scaling-design.md`로 분리했다.

## 1. 감지 훅

`src/features/orientation/use-landscape-detection.ts`

```ts
export function useLandscapeDetection(): boolean;
```

### 센서 판정

`Accelerometer`를 쓴다. `DeviceMotion`은 자이로·회전행렬까지 계산해 더 무겁고, 여기서는 중력 방향만 필요하다.

```ts
const UPDATE_INTERVAL_MS = 250;   // 4Hz. 안내 문구 하나에 이 이상은 낭비다.
const LANDSCAPE_X = 0.7;          // 가로일 때 중력이 x축으로 넘어간다
const FLAT_Z = 0.85;              // 책상에 눕힌 상태를 가로로 오판하지 않기 위한 배제 조건
const SUSTAIN_MS = 800;           // 이 시간 이상 유지돼야 상태를 바꾼다
```

판정식:

```
isLandscape = Math.abs(x) > LANDSCAPE_X && Math.abs(z) < FLAT_Z
```

**`x`의 부호가 아니라 절댓값을 쓰는 이유:** expo-sensors의 축 부호는 iOS와 Android가 서로 다르다. 크기만 보면 두 플랫폼에서 같은 코드가 동작한다. 좌/우 어느 쪽으로 눕혔는지는 이 기능에 필요 없다.

**`z` 배제 조건이 필요한 이유:** 기기를 책상에 평평히 놓으면 중력이 z축에 몰리고 x, y는 노이즈 수준으로 흔들린다. 이때 `|x|`가 순간적으로 임계를 넘을 수 있다.

### 디바운스

임계를 넘나드는 순간마다 오버레이가 깜빡이면 안 된다. **후보 상태가 `SUSTAIN_MS` 이상 연속으로 유지될 때만** 실제 상태를 바꾼다. 타이머는 후보가 바뀔 때마다 리셋한다.

이 규칙은 나타날 때와 사라질 때 모두 적용한다. 잠깐 세로로 돌렸다가 다시 눕히는 동작에서 오버레이가 튀지 않는다.

### 치수 판정

`useWindowDimensions()`의 `width > height`. iPad 네이티브 실행에서만 참이 될 수 있다. 이쪽은 OS가 이미 회전 애니메이션으로 상태를 확정한 뒤라 디바운스가 필요 없다.

### 결합과 생명주기

두 신호의 OR을 반환한다.

구독은 `AppState`가 `"active"`일 때만 유지한다. 백그라운드에서 센서를 돌릴 이유가 없고, 배터리 비용의 대부분이 여기서 줄어든다.

`Accelerometer.isAvailableAsync()`가 false면 센서 구독을 아예 시작하지 않고 치수 신호만 쓴다. 센서가 없는 기기에서 훅이 던지지 않아야 한다.

언마운트 시 `remove()`와 타이머 정리를 반드시 수행한다.

## 2. 오버레이 컴포넌트

회전 안내는 확인 모달이 아니다. 확인할 것이 없고 버튼도 없다. `ConfirmModal`에 버튼을 선택 prop으로 뚫으면 "확인 모달"이라는 이름이 확인하지 않는 모달까지 그리게 되므로 그렇게 하지 않는다.

그렇다고 껍데기 마크업을 복사해 독립 모달을 만들지도 않는다. `ConfirmModal`은 애초에 거의 동일한 모달 두 개(`ExamExitConfirmationModal`, `ReanswerDiscardModal`)의 중복을 없애려고 추출된 컴포넌트다. 여기서 세 번째 사본을 만들면 그 결정을 되돌리는 셈이다.

**공용 껍데기를 하나 추출하고, 두 모달이 각자 그 위에 선다.**

### `src/components/ui/MascotModal.tsx` 신설

현재 `ConfirmModal`이 가진 것 중 버튼을 뺀 나머지 전부다.

- `Modal` — `animationType="fade"`, `transparent`, `statusBarTranslucent`
- `bg-ink/50` 오버레이 + `px-6`
- `w-full max-w-md items-center rounded-3xl bg-surface px-6 pb-6 pt-3` 카드 + `shadows.card`
- `h-36 w-40 overflow-hidden` 컨테이너 안의 `h-40 w-40` 마스코트
- 선택적 제목
- `rounded-2xl border border-brand-200 bg-brand-50` 안내 박스와 선택적 `!` 배지

```ts
interface MascotModalProps {
  visible: boolean;
  /** 카드 상단 마스코트. 상황에 맞는 표정을 사용처가 고른다. */
  mascot: ImageSourcePropType;
  /** 없으면 안내 박스가 곧바로 마스코트 아래에 온다. */
  title?: string;
  message: string;
  /** 안내 박스 왼쪽의 brand-cta 원형 "!" 배지. */
  warningBadge?: boolean;
  /** Android 뒤로 가기. 닫을 수 없는 안내라면 생략한다. */
  onRequestClose?: () => void;
  /** 안내 박스 아래에 붙는 내용 — 버튼, 에러 문구 등. */
  children?: ReactNode;
}
```

`mascot`을 선택이 아닌 **필수**로 둔다. 기본값을 주면 어느 화면이 어떤 표정을 쓰는지가 컴포넌트 안에 숨는다. 사용처가 둘뿐이므로 각자 명시하는 편이 읽기 쉽다.

### `ConfirmModal`이 받는 영향

**공개 API가 하나도 바뀌지 않는다.** 내부 렌더만 `MascotModal`에 위임하고, 에러 문구와 버튼 두 개를 `children`으로 넘긴다. 호출부 세 곳(`ExamSessionScreen`, `ReanswerScreen`, `SettingsScreen`)은 손대지 않는다.

`ConfirmModal.tsx:8-9`의 마스코트 고정 주석도 **그대로 유효하다.** 세 확인 사용처가 같은 표정을 쓴다는 판단은 바뀌지 않았고, 이제 그 결정이 `MascotModal`에 `shockedRabbit`을 넘기는 지점에 자리한다. 주석을 그 지점으로 옮긴다.

### `src/components/ui/PortraitOnlyNotice.tsx` 신설

`MascotModal`을 직접 쓴다. 감지 훅을 호출하고 문구와 마스코트를 고정한다.

| prop | 값 |
| --- | --- |
| `visible` | `useLandscapeDetection()` |
| `mascot` | `public/mascots/rabbit_face.png` |
| `title` | `"세로로 돌려주세요"` |
| `message` | `"토선생은 세로 화면만 지원해요. 기기를 세로로 돌리면 계속 이용할 수 있어요."` |
| `children` | 없음 |

**버튼을 두지 않는 이유:** 사용자가 기기를 세로로 되돌리면 자동으로 사라진다. 닫기 버튼을 두면 "닫았으니 가로로 쓸 수 있나?"라는 잘못된 기대를 만든다. 해소 방법이 하나뿐이므로 그 방법만 안내한다.

`onRequestClose`(Android 뒤로 가기)도 넘기지 않는다. 뒤로 가기로 닫혀도 가로 상태는 그대로라 즉시 다시 떠야 하는데, 그 왕복이 깜빡임으로 보인다.

## 3. `App.tsx` 마운트

```tsx
<View className="flex-1" onLayout={onLayoutRootView}>
  <NavigationContainer>
    <RootNavigator state={state} />
  </NavigationContainer>
  <StatusBar style="auto" />
  <PortraitOnlyNotice />
</View>
```

`AppContent` 안에 두는 이유는 두 가지다. 폰트가 준비되기 전에는 이 컴포넌트가 `null`을 반환하는데, 그 시점에 Jua 폰트로 된 안내를 띄울 수 없다. 그리고 `SafeAreaProvider` 안쪽이라 인셋을 쓸 수 있다.

감지 훅은 `PortraitOnlyNotice` 내부에서 호출한다. `AppContent`에서 호출해 prop으로 내리면 가로 상태가 바뀔 때마다 앱 트리 전체가 리렌더된다.

## 실패 처리

| 실패 지점 | 동작 |
| --- | --- |
| `Accelerometer.isAvailableAsync()` false | 센서 구독을 시작하지 않고 치수 신호만 사용. 예외 없음 |
| iOS 모션 권한 거부 | 센서 이벤트가 오지 않아 오버레이가 뜨지 않는다. 앱 기능에는 영향 없음 — 안내가 없을 뿐이므로 별도 처리하지 않는다 |
| 센서 값이 임계 근처에서 진동 | `SUSTAIN_MS` 디바운스가 흡수 |
| 기기를 책상에 평평히 놓음 | `FLAT_Z` 배제 조건으로 가로 판정 안 됨 |
| 백그라운드 전환 | `AppState` 구독으로 센서 정지. 복귀 시 재구독 |
| 오버레이 표시 중 앱 종료/복귀 | 상태를 저장하지 않으므로 복귀 시 현재 자세로 다시 판정 |

## 검증

`pnpm lint`와 `pnpm exec tsc --noEmit`을 돌린다. `expo-sensors`는 네이티브 모듈이므로 **dev client 재빌드가 필요하다.**

### 검증 환경 제약

**iOS 시뮬레이터에는 가속도계가 없다.** CoreMotion의 `isAccelerometerAvailable`이 false이므로 `Accelerometer.isAvailableAsync()`도 false가 되고, 센서 판정 경로가 한 줄도 실행되지 않는다. Simulator의 Device → Rotate는 인터페이스 방향만 바꿀 뿐 모션 이벤트를 만들지 않는다.

| 환경 | 센서 신호 | 치수 신호 |
| --- | --- | --- |
| iOS 시뮬레이터 (iPhone) | 없음 | 세로 고정 → **검증 불가** |
| iOS 시뮬레이터 (iPad) | 없음 | 가로 허용되어 회전함 |
| Android 에뮬레이터 | Extended Controls → Virtual sensors | 세로 고정 |
| 실기기 (iPhone / Android) | 사용 가능 | 세로 고정 |

따라서 검증 순서를 고정한다.

1. **Android 에뮬레이터**에서 Virtual sensors의 가속도계 슬라이더로 임계값(`LANDSCAPE_X`, `FLAT_Z`)과 `SUSTAIN_MS`를 튜닝한다. 센서 로직의 대부분을 여기서 완성한다.
2. **iPad 시뮬레이터**에서 치수 신호 분기를 확인한다.
3. **실기기**에서만 확인 가능한 항목: iOS 센서 동작, iOS 모션 권한 프롬프트 여부, 실제 손동작에서의 디바운스 체감.

`isAvailableAsync()`가 false일 때 훅이 던지지 않고 치수 신호만으로 조용히 동작해야 한다는 요구사항은, iOS 시뮬레이터가 그 경로를 항상 타므로 자동으로 검증된다.

### 수동 확인 항목

1. iPhone 실기기에서 가로로 눕히면 0.8초쯤 뒤 안내가 뜨고, 세로로 되돌리면 사라진다.
2. 책상에 평평히 놓았을 때 안내가 뜨지 않는다.
3. 빠르게 흔들거나 임계 근처에서 기울여도 오버레이가 깜빡이지 않는다.
4. **피드백 웹뷰 화면에서 눕혔을 때 웹 콘텐츠 위에 안내가 정상적으로 뜬다.** 이 설계의 핵심 요구사항이다.
5. 시험 진행 중(녹음 중) 눕혔을 때 안내가 뜨고, 녹음이 중단되지 않는다.
6. 앱을 백그라운드로 보냈다 돌아와도 감지가 계속 동작한다.
7. Android 실기기에서 1~6을 반복한다. 축 부호 차이를 절댓값으로 흡수했는지 확인하는 지점이다.
8. iPad에서 눕혔을 때 (실제로 회전하는 환경) 안내가 뜨는지 확인한다.
9. iOS 모션 권한 프롬프트가 뜨는지 확인하고, 뜬다면 `app.json`에 권한 문구를 추가한다.
