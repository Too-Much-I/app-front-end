# 가로 회전 시 세로 모드 전용 안내 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 태블릿 지원을 유지한 채 모든 기기를 세로로 잠그고, 사용자가 기기를 가로로 눕히면 전 화면(웹뷰 포함) 위에 "세로 모드만 지원한다"는 안내를 띄운다.

**Architecture:** iPad에 남아 있는 가로 허용을 config plugin으로 제거해 방향 잠금을 모든 플랫폼에 통일한다. 잠긴 화면에서는 `Dimensions`가 움직이지 않으므로 `expo-sensors`의 가속도계로 기기의 물리적 자세를 읽고, 디바운스를 거쳐 전역 오버레이를 띄운다. 오버레이는 `ConfirmModal`에서 공용 껍데기(`MascotModal`)를 추출해 그 위에 세운다.

**Tech Stack:** Expo 57, React Native 0.86, expo-sensors, Expo config plugins

**설계 문서:** [2026-08-07-portrait-only-notice-design.md](../specs/2026-08-07-portrait-only-notice-design.md)

## Global Constraints

- 패키지 매니저는 `pnpm`이다. 네이티브 패키지는 `pnpm expo install`로 설치해 SDK 57과 맞는 버전을 받는다.
- 텍스트는 `src/components/ui/Text.tsx`, 누르는 요소는 `src/components/ui/Pressable.tsx`를 쓴다.
- 폰트는 Jua 단일 굵기다. `font-medium` / `font-bold`를 넣지 않는다.
- `ios/`와 `android/`는 `.gitignore` 대상이며 git에 추적되지 않는다. **네이티브 설정은 반드시 `app.json`이나 config plugin으로 선언한다.** 생성된 파일을 직접 고치면 다음 prebuild에서 사라진다.
- **자동 테스트 러너가 없다**(`AGENTS.md:24`). 검증은 `pnpm lint` + `pnpm exec tsc --noEmit` + 명시된 수동 확인이다.
- **커밋은 사용자가 명시적으로 요청할 때만 한다**(`AGENTS.md:86`). 각 태스크의 커밋 단계는 사용자 승인 후 실행한다.
- 커밋 제목은 Conventional Commit 타입 + 한국어다.
- **iOS 시뮬레이터에는 가속도계가 없다.** 센서 로직은 Android 에뮬레이터에서 개발·튜닝하고, iOS는 실기기에서만 최종 확인한다. 이 순서를 지키지 않으면 시뮬레이터에서 아무것도 안 뜨는 정상 동작을 버그로 오인해 디버깅이 헛돈다.
- 임계값은 `LANDSCAPE_X = 0.7`, `FLAT_Z = 0.85`, `SUSTAIN_MS = 800`, `UPDATE_INTERVAL_MS = 250`이다.

---

## File Structure

| 파일 | 책임 |
| --- | --- |
| `plugins/with-ipad-portrait-only.js` (신규) | iPad `Info.plist`의 지원 방향을 세로로 제한 |
| `app.json` (수정) | plugin 등록, 필요 시 iOS 모션 권한 문구 |
| `src/features/orientation/use-landscape-detection.ts` (신규) | 센서 + 치수 신호를 결합해 "가로 상태" 하나를 반환 |
| `src/components/ui/MascotModal.tsx` (신규) | 마스코트 모달의 공용 껍데기 — Modal, 오버레이, 카드, 마스코트, 안내 박스 |
| `src/components/ui/ConfirmModal.tsx` (수정) | 렌더를 `MascotModal`에 위임. **공개 API 불변** |
| `src/components/ui/PortraitOnlyNotice.tsx` (신규) | 감지 훅과 문구를 묶은 전역 오버레이 |
| `App.tsx` (수정) | 오버레이 마운트 |

감지 로직을 `src/features/orientation/`에 두는 이유는 화면이 아니라 기기 상태에 대한 도메인 로직이기 때문이다. `src/components/ui/`에는 표현만 남긴다.

`MascotModal`을 빼는 이유는 회전 안내가 확인 모달이 아니기 때문이다. `ConfirmModal`에 버튼을 선택 prop으로 뚫으면 이름이 하는 일보다 좁아지고, 껍데기를 복사하면 `ConfirmModal`이 애초에 없애려던 중복이 되살아난다. 껍데기를 한 번 더 빼는 것이 두 문제를 모두 피한다.

---

## Task 1: iPad를 세로로 잠그는 config plugin

센서와 무관하게 독립적으로 완결된다. 먼저 처리해 방향 잠금을 모든 플랫폼에 통일한다.

**Files:**
- Create: `plugins/with-ipad-portrait-only.js`
- Modify: `app.json` (`plugins` 배열)

**Interfaces:**
- Consumes: 없음
- Produces: 모든 iOS 기기에서 세로 고정된 네이티브 프로젝트

- [ ] **Step 1: 현재 상태 기록**

```
grep -A8 "UISupportedInterfaceOrientations~ipad" ios/app/Info.plist
```

Expected: `LandscapeLeft`와 `LandscapeRight`가 포함돼 있다. 이것이 제거 대상이다.

- [ ] **Step 2: plugin 파일 생성**

`plugins/with-ipad-portrait-only.js`:

```js
const { withInfoPlist } = require("expo/config-plugins");

/**
 * iPad를 iPhone과 동일하게 세로로 잠근다.
 *
 * app.json의 `orientation: "portrait"`은 iPhone에만 적용된다. Expo는
 * `supportsTablet: true`일 때 iPad용 키에 네 방향을 모두 넣기 때문에,
 * 태블릿을 지원하면서 세로만 허용하려면 이 키를 직접 덮어써야 한다.
 *
 * `ios/`가 .gitignore 대상이라 Info.plist 직접 수정은 prebuild에서 사라진다.
 * 방향 잠금이 어느 환경에서 prebuild하든 재현되도록 plugin으로 선언한다.
 *
 * 알려진 비용: iPadOS가 전 방향을 지원하지 않는 앱을 Split View / Slide Over
 * 대상에서 제외할 수 있다. "세로 전용" 방침에서 감수하는 부분이다.
 */
const PORTRAIT_ONLY = [
  "UIInterfaceOrientationPortrait",
  "UIInterfaceOrientationPortraitUpsideDown",
];

module.exports = function withIpadPortraitOnly(config) {
  return withInfoPlist(config, (config) => {
    config.modResults["UISupportedInterfaceOrientations~ipad"] = PORTRAIT_ONLY;
    return config;
  });
};
```

- [ ] **Step 3: `app.json`에 등록**

기존 `plugins` 배열의 **마지막 항목인 `"expo-video"` 바로 뒤**에 한 줄을 추가한다. 다른 항목은 하나도 바꾸지 않는다. 마지막에 두는 이유는 다른 plugin이 Info.plist를 건드리더라도 이 값이 최종으로 남게 하기 위해서다.

변경 전:

```json
      "expo-video"
    ]
```

변경 후:

```json
      "expo-video",
      "./plugins/with-ipad-portrait-only"
    ]
```

경로에 `./`를 붙여야 Expo가 npm 패키지가 아니라 로컬 파일로 해석한다. 확장자 `.js`는 생략한다.

- [ ] **Step 4: prebuild로 반영**

`--clean`은 `ios/`를 지우고 다시 만든다. 이 디렉터리는 git에 없고 생성물이므로 안전하지만, **Xcode에서 수동으로 바꾼 설정이 있다면 함께 사라진다.** 없는지 먼저 확인한다.

```
pnpm exec expo prebuild --platform ios --clean
```

- [ ] **Step 5: 결과 확인**

```
grep -A6 "UISupportedInterfaceOrientations~ipad" ios/app/Info.plist
```

Expected: `Portrait`와 `PortraitUpsideDown`만 남고 Landscape 두 항목이 사라졌다.

- [ ] **Step 6: iPad 시뮬레이터에서 확인**

```
pnpm ios
```

iPad 시뮬레이터를 선택하고 `Cmd+←` / `Cmd+→`로 회전한다.

Expected: 기기 프레임은 돌아가지만 **앱 내용은 세로를 유지한다.** 이 작업 전에는 앱이 함께 가로로 돌아갔다.

- [ ] **Step 7: 커밋 (사용자 승인 후)**

```bash
git add plugins/with-ipad-portrait-only.js app.json
git commit -m "feat(ios): iPad도 세로 전용으로 잠금

Expo는 supportsTablet이 true면 iPad에 네 방향을 모두 넣는다. 태블릿은
계속 지원하되 세로만 허용하도록 Info.plist 키를 plugin으로 덮어쓴다.
ios/가 gitignore 대상이라 직접 수정은 prebuild에서 사라진다."
```

---

## Task 2: `expo-sensors` 설치

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (설치 명령이 생성)

**Interfaces:**
- Consumes: 없음
- Produces: `Accelerometer` API

- [ ] **Step 1: 설치**

`pnpm add`가 아니라 `pnpm expo install`을 쓴다. SDK 57과 호환되는 버전을 골라준다.

```
pnpm expo install expo-sensors
```

- [ ] **Step 2: dev client 재빌드**

네이티브 모듈이므로 JS 리로드로는 반영되지 않는다.

```
pnpm ios
pnpm android
```

- [ ] **Step 3: 설치 확인**

앱이 정상 실행되고 기존 기능(모의고사 녹음, 피드백 웹뷰)이 그대로 동작하는지 확인한다.

Expected: 회귀 없음. 이 단계에서는 센서를 아직 쓰지 않으므로 동작 변화가 없어야 한다.

- [ ] **Step 4: 커밋 (사용자 승인 후)**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): expo-sensors 추가

화면이 세로로 잠겨 있어 Dimensions로는 회전을 감지할 수 없다.
기기의 물리적 자세를 읽으려면 가속도계가 필요하다."
```

---

## Task 3: 가로 상태 감지 훅

**Files:**
- Create: `src/features/orientation/use-landscape-detection.ts`

**Interfaces:**
- Consumes: Task 2의 `expo-sensors`
- Produces: `useLandscapeDetection(): boolean`

- [ ] **Step 1: 훅 작성**

```ts
import { useEffect, useState } from "react";
import { AppState, useWindowDimensions } from "react-native";
import { Accelerometer } from "expo-sensors";

/** 4Hz. 안내 문구 하나를 띄우는 데 이보다 잦은 표본은 배터리 낭비다. */
const UPDATE_INTERVAL_MS = 250;

/** 가로로 눕히면 중력이 x축으로 넘어간다. */
const LANDSCAPE_X = 0.7;

/**
 * 책상에 평평히 놓은 상태를 가로로 오판하지 않기 위한 배제 조건.
 * 이때 중력이 z축에 몰리고 x·y는 노이즈 수준으로 흔들려 순간적으로
 * 임계를 넘을 수 있다.
 */
const FLAT_Z = 0.85;

/** 이 시간 이상 유지돼야 상태를 바꾼다. 임계 근처 진동으로 깜빡이는 것을 막는다. */
const SUSTAIN_MS = 800;

/**
 * 기기가 가로로 눕혀졌는지 알려준다.
 *
 * 두 신호의 OR다.
 *
 * 1. 가속도계 — 주 경로다. 앱이 모든 플랫폼에서 세로로 잠겨 있어
 *    `Dimensions`가 회전에 반응하지 않으므로 이것 없이는 감지가 불가능하다.
 * 2. 창 비율 — 안전망이다. 방향 잠금 아래에서는 거의 항상 false지만,
 *    iPadOS 멀티태스킹처럼 기기 방향과 무관하게 창이 가로로 넓어지는
 *    경로를 덮는다.
 *
 * x의 부호가 아니라 절댓값을 쓰는 이유: expo-sensors의 축 부호는 iOS와
 * Android가 다르다. 크기만 보면 두 플랫폼에서 같은 코드가 동작한다.
 * 좌우 어느 쪽으로 눕혔는지는 이 기능에 필요 없다.
 */
export function useLandscapeDetection(): boolean {
  const { width, height } = useWindowDimensions();
  const [sensorLandscape, setSensorLandscape] = useState(false);

  useEffect(() => {
    let subscription: { remove: () => void } | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let candidate = false;
    let cancelled = false;

    const clearTimer = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const handleReading = ({ x, z }: { x: number; z: number }) => {
      const next = Math.abs(x) > LANDSCAPE_X && Math.abs(z) < FLAT_Z;
      if (next === candidate) return;

      candidate = next;
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        setSensorLandscape(next);
      }, SUSTAIN_MS);
    };

    const start = async () => {
      // AppState가 active로 여러 번 전이해도 구독이 중복되지 않게 한다.
      if (subscription !== null) return;

      const available = await Accelerometer.isAvailableAsync();
      // iOS 시뮬레이터에는 가속도계가 없다. 여기서 조용히 빠져나가고
      // 창 비율 신호만 남는다.
      if (cancelled || !available || subscription !== null) return;

      Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);
      subscription = Accelerometer.addListener(handleReading);
    };

    const stop = () => {
      subscription?.remove();
      subscription = null;
      clearTimer();
      candidate = false;
      setSensorLandscape(false);
    };

    if (AppState.currentState === "active") void start();

    // 백그라운드에서 센서를 돌릴 이유가 없다. 배터리 비용의 대부분이 여기서 준다.
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void start();
      else stop();
    });

    return () => {
      cancelled = true;
      appStateSubscription.remove();
      stop();
    };
  }, []);

  return sensorLandscape || width > height;
}
```

- [ ] **Step 2: 타입·린트 검사**

```
pnpm lint
pnpm exec tsc --noEmit
```

Expected: 둘 다 통과.

- [ ] **Step 3: 커밋 (사용자 승인 후)**

```bash
git add src/features/orientation/use-landscape-detection.ts
git commit -m "feat(orientation): 가로 자세 감지 훅 추가

가속도계와 창 비율을 결합해 기기가 눕혀졌는지 판정한다. 화면이 세로로
잠겨 있어 Dimensions만으로는 감지할 수 없다. 축 부호가 플랫폼마다 달라
절댓값으로 비교하고, 임계 근처 진동은 0.8초 디바운스로 흡수한다."
```

---

## Task 4: 모달 껍데기 추출

**Files:**
- Create: `src/components/ui/MascotModal.tsx`
- Modify: `src/components/ui/ConfirmModal.tsx`

**Interfaces:**
- Consumes: 없음
- Produces: `MascotModal` — `{ visible, mascot, title?, message, warningBadge?, onRequestClose?, children? }`

**이 태스크는 렌더 결과를 바꾸지 않는다.** `ConfirmModal`의 공개 API도 그대로다. 호출부 세 곳(`ExamSessionScreen`, `ReanswerScreen`, `SettingsScreen`)은 손대지 않는다.

- [ ] **Step 1: `MascotModal.tsx` 생성**

현재 `ConfirmModal`에서 버튼과 에러 문구를 뺀 나머지를 그대로 옮긴다. 클래스 문자열을 한 글자도 바꾸지 않는다 — 이 태스크의 성립 조건이다.

```tsx
import type { ReactNode } from "react";
import { Image, Modal, View, type ImageSourcePropType } from "react-native";

import { Text } from "@/components/ui/Text";
import { shadows } from "@/theme";

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

/**
 * 마스코트와 안내 박스를 가진 모달의 공용 껍데기.
 *
 * 확인 버튼이 필요하면 `ConfirmModal`을 쓴다. 이 컴포넌트를 직접 쓰는 것은
 * 버튼이 없는 알림(화면 회전 안내)처럼 확인 의미가 없는 경우다.
 *
 * `mascot`에 기본값을 두지 않는다. 기본값을 주면 어느 화면이 어떤 표정을
 * 쓰는지가 이 파일 안에 숨는다.
 */
export function MascotModal({
  visible,
  mascot,
  title,
  message,
  warningBadge = false,
  onRequestClose,
  children,
}: MascotModalProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onRequestClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View className="flex-1 items-center justify-center bg-ink/50 px-6">
        <View
          accessibilityViewIsModal
          className="w-full max-w-md items-center rounded-3xl bg-surface px-6 pb-6 pt-3"
          style={shadows.card}
        >
          {/* 얼굴 전체는 유지하고 원본 하단의 불필요한 여백만 컨테이너 밖으로 숨긴다. */}
          <View className="h-36 w-40 overflow-hidden">
            <Image className="h-40 w-40" resizeMode="contain" source={mascot} />
          </View>

          {title ? <Text className="mt-4 text-lg text-exam-navy">{title}</Text> : null}

          <View
            className={`w-full flex-row items-center rounded-2xl border border-brand-200 bg-brand-50 px-4 py-4 ${
              title ? "mt-3" : "mt-5"
            }`}
          >
            {warningBadge ? (
              <View className="mr-3 h-7 w-7 items-center justify-center rounded-full bg-brand-cta">
                <Text className="text-sm text-white">!</Text>
              </View>
            ) : null}
            <Text className="flex-1 text-sm leading-6 text-brand-900">{message}</Text>
          </View>

          {children}
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: `ConfirmModal.tsx`를 위임 형태로 교체**

파일 전체를 아래로 바꾼다. `interface ConfirmModalProps`는 **한 글자도 바뀌지 않는다.**

```tsx
import { View } from "react-native";

import { MascotModal } from "@/components/ui/MascotModal";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
// 마스코트를 prop으로 열지 않고 고정한 이유: 세 사용처(시험 나가기, 재답변 폐기,
// 학습 기록 삭제)가 모두 "지금 것이 사라진다"는 같은 신호라 표정이 갈릴 이유가 없다.
const shockedRabbit = require("../../../public/mascots/shocked_rabbit.png");

interface ConfirmModalProps {
  visible: boolean;
  /** 없으면 안내 박스가 곧바로 마스코트 아래에 온다. */
  title?: string;
  message: string;
  /** 안내 박스 왼쪽의 brand-cta 원형 "!" 배지. */
  warningBadge?: boolean;
  /** CTA(채움) 버튼 — 되돌아가는 쪽이 항상 시각적 기본값이다. */
  cancelLabel: string;
  /** 보조(외곽선) 버튼 — 파괴적이거나 되돌릴 수 없는 쪽. */
  confirmLabel: string;
  confirmTone?: "danger" | "neutral";
  confirmHint?: string;
  /** 확인 동작이 네트워크를 기다리는 중. 두 버튼을 모두 잠근다. */
  pending?: boolean;
  /** 확인 동작 실패 시 버튼 위에 표시하고 재시도를 허용한다. */
  errorMessage?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 되돌릴 수 없는 동작을 확인받는 공용 모달.
 *
 * 취소가 CTA(채움), 확인이 보조(외곽선)다. 파괴적인 쪽을 시각적 기본값으로 두지 않는다.
 * 카드 골격은 `MascotModal`이 그리고 여기서는 에러 문구와 버튼만 얹는다.
 */
export function ConfirmModal({
  visible,
  title,
  message,
  warningBadge = false,
  cancelLabel,
  confirmLabel,
  confirmTone = "neutral",
  confirmHint,
  pending = false,
  errorMessage,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  const confirmBorderClassName =
    confirmTone === "danger" ? "border-exam-dangerLine" : "border-line";
  const confirmTextClassName =
    confirmTone === "danger" ? "text-exam-danger" : "text-ink-muted";

  return (
    <MascotModal
      mascot={shockedRabbit}
      message={message}
      onRequestClose={pending ? undefined : onCancel}
      title={title}
      visible={visible}
      warningBadge={warningBadge}
    >
      {errorMessage ? (
        <Text className="mt-3 w-full text-sm text-exam-danger">{errorMessage}</Text>
      ) : null}

      {/* Pressable이 자체 Animated opacity를 style 배열 끝에 덧붙여 className의
          opacity-*를 덮어쓴다. 대기 중 흐림 처리는 바깥 View에서 해야 먹는다. */}
      <View className={`w-full ${pending ? "opacity-50" : ""}`}>
        <Pressable
          accessibilityRole="button"
          className="mt-6 w-full items-center rounded-full bg-brand-cta py-4"
          disabled={pending}
          onPress={onCancel}
        >
          <Text className="text-base text-white">{cancelLabel}</Text>
        </Pressable>

        <Pressable
          accessibilityHint={confirmHint}
          accessibilityRole="button"
          className={`mt-3 w-full items-center rounded-full border bg-surface py-4 ${confirmBorderClassName}`}
          disabled={pending}
          onPress={onConfirm}
        >
          <Text className={`text-base ${confirmTextClassName}`}>{confirmLabel}</Text>
        </Pressable>
      </View>
    </MascotModal>
  );
}
```

`Image` / `Modal` / `shadows` import가 `MascotModal`로 옮겨갔으므로 `ConfirmModal`에서는 제거된다. 남는 RN import는 `View` 하나다.

- [ ] **Step 3: 타입·린트 검사**

```
pnpm lint
pnpm exec tsc --noEmit
```

Expected: 둘 다 통과. 호출부를 건드리지 않았으므로 타입 오류가 없어야 한다. 오류가 나면 `ConfirmModalProps`를 실수로 바꾼 것이다.

- [ ] **Step 4: 기존 세 사용처 회귀 확인**

```
pnpm ios
```

세 모달을 각각 열어 이전과 동일한지 확인한다.

1. 모의고사 진행 중 나가기 → 시험 나가기 모달 (제목 없음, `!` 배지 있음, 확인 버튼 빨강)
2. 재답변 녹음 중 나가기 → 녹음 폐기 모달 (제목 있음, 배지 없음, 확인 버튼 회색)
3. 설정 → 모든 학습 기록 삭제 → 삭제 확인 모달 (제목 있음, 배지 있음, 확인 버튼 빨강)

Expected: 세 모달 모두 마스코트, 여백, 문구, 버튼 색과 배치가 이전과 **픽셀 단위로 동일**하다.

특히 제목이 없는 1번에서 안내 박스 위 여백이 `mt-5`로 유지되는지 확인한다. `title` 유무로 여백이 갈리는 로직이 `MascotModal`로 옮겨갔기 때문이다.

- [ ] **Step 5: 커밋 (사용자 승인 후)**

```bash
git add src/components/ui/MascotModal.tsx src/components/ui/ConfirmModal.tsx
git commit -m "refactor(ui): 마스코트 모달 껍데기를 MascotModal로 추출

화면 회전 안내가 같은 카드 모양을 쓰지만 확인할 것이 없어 버튼이 없다.
ConfirmModal에 버튼을 선택 prop으로 뚫으면 이름이 하는 일보다 좁아지고,
껍데기를 복사하면 ConfirmModal이 없애려던 중복이 되살아난다.
ConfirmModal의 공개 API는 바뀌지 않아 호출부는 그대로다."
```


## Task 5: 전역 오버레이

**Files:**
- Create: `src/components/ui/PortraitOnlyNotice.tsx`
- Modify: `App.tsx`

**Interfaces:**
- Consumes: Task 3의 `useLandscapeDetection()`, Task 4의 `MascotModal`
- Produces: 없음

- [ ] **Step 1: `PortraitOnlyNotice.tsx` 생성**

`ConfirmModal`이 아니라 `MascotModal`을 직접 쓴다. 확인할 것이 없으므로 확인 모달이 아니다.

```tsx
import { MascotModal } from "@/components/ui/MascotModal";
import { useLandscapeDetection } from "@/features/orientation/use-landscape-detection";

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const rabbitFace = require("../../../public/mascots/rabbit_face.png");

/**
 * 기기를 가로로 눕혔을 때 세로 전용임을 알리는 전역 오버레이.
 *
 * 버튼을 두지 않는다. 세로로 되돌리면 자동으로 사라지고, 닫기 버튼을 두면
 * "닫았으니 가로로 쓸 수 있나"라는 잘못된 기대를 만든다. 해소 방법이
 * 하나뿐이므로 그 방법만 안내한다.
 *
 * `onRequestClose`(Android 뒤로 가기)도 넘기지 않는다. 뒤로 가기로 닫혀도
 * 가로 상태는 그대로라 즉시 다시 떠야 하는데, 그 왕복이 깜빡임으로 보인다.
 *
 * 감지 훅을 이 안에서 호출하는 이유: App.tsx에서 호출해 prop으로 내리면
 * 가로 상태가 바뀔 때마다 앱 트리 전체가 리렌더된다.
 */
export function PortraitOnlyNotice() {
  const isLandscape = useLandscapeDetection();

  return (
    <MascotModal
      mascot={rabbitFace}
      message="토선생은 세로 화면만 지원해요. 기기를 세로로 돌리면 계속 이용할 수 있어요."
      title="세로로 돌려주세요"
      visible={isLandscape}
    />
  );
}
```

- [ ] **Step 2: `App.tsx`에 마운트**

`StatusBar` 다음에 형제로 넣는다. `NavigationContainer` 바깥이므로 모든 화면 위에 뜨고, `SafeAreaProvider` 안쪽이라 인셋을 쓸 수 있다.

```tsx
import { PortraitOnlyNotice } from "@/components/ui/PortraitOnlyNotice";

// AppContent의 return:
  return (
    <View className="flex-1" onLayout={onLayoutRootView}>
      <NavigationContainer>
        <RootNavigator state={state} />
      </NavigationContainer>
      <StatusBar style="auto" />
      <PortraitOnlyNotice />
    </View>
  );
```

`AppContent` 안에 두는 이유는 폰트가 준비되기 전에는 이 컴포넌트가 `null`을 반환하는데, 그 시점에 Jua 폰트로 된 안내를 띄울 수 없기 때문이다.

- [ ] **Step 3: 타입·린트 검사**

```
pnpm lint
pnpm exec tsc --noEmit
```

- [ ] **Step 4: Android 에뮬레이터에서 센서 로직 검증**

**이 단계가 센서 로직의 주 검증 지점이다.** iOS 시뮬레이터에서는 가속도계가 없어 아무것도 뜨지 않는다.

```
pnpm android
```

에뮬레이터의 Extended Controls(`⋯`) → Virtual sensors → Accelerometer를 연다.

1. "Rotate" 프리셋이나 슬라이더로 기기를 가로로 눕힌다.
   Expected: 약 0.8초 뒤 안내가 뜬다.
2. 세로로 되돌린다.
   Expected: 약 0.8초 뒤 사라진다.
3. 기기를 평평하게(z축 중력) 놓는다.
   Expected: 안내가 뜨지 않는다.
4. 임계 근처(45도 부근)에서 앞뒤로 흔든다.
   Expected: 오버레이가 깜빡이지 않는다.

깜빡임이 있으면 `SUSTAIN_MS`를 늘리고, 반응이 둔하면 줄인다. 임계 판정이 어긋나면 `LANDSCAPE_X`와 `FLAT_Z`를 조정한다.

- [ ] **Step 5: 웹뷰 위 표시 확인 — 핵심 요구사항**

Android 에뮬레이터에서 피드백 화면(웹뷰)을 연 뒤 가로로 눕힌다.

Expected: **웹 콘텐츠 위에 안내가 정상적으로 뜬다.** 웹뷰 아래로 가려지면 안 된다.

설정 → 이용약관(`SettingsWebViewScreen`)에서도 반복한다.

- [ ] **Step 6: 시험 진행 중 확인**

모의고사 녹음 중에 눕힌다.

Expected: 안내가 뜨고 **녹음이 중단되지 않는다.**

- [ ] **Step 7: 백그라운드 복귀 확인**

앱을 백그라운드로 보냈다가 돌아온 뒤 눕힌다.

Expected: 감지가 계속 동작한다. `AppState` 구독이 재구독에 실패하면 여기서 드러난다.

- [ ] **Step 8: iOS 시뮬레이터 폴백 확인**

```
pnpm ios
```

Expected: **아무 오류 없이 앱이 정상 동작하고, 안내는 뜨지 않는다.** 이것이 정상이다 — 시뮬레이터에 가속도계가 없어 `isAvailableAsync()`가 false를 반환하고 훅이 조용히 창 비율 신호만 남긴다. 크래시나 콘솔 경고가 있으면 폴백 경로에 문제가 있는 것이다.

- [ ] **Step 9: 커밋 (사용자 승인 후)**

```bash
git add src/components/ui/PortraitOnlyNotice.tsx App.tsx
git commit -m "feat(orientation): 가로 회전 시 세로 전용 안내 표시

App.tsx의 NavigationContainer 형제로 두어 웹뷰를 포함한 모든 화면 위에
뜬다. 세로로 되돌리면 자동으로 사라지므로 버튼을 두지 않는다."
```

---

## Task 6: iOS 실기기 확인

시뮬레이터로는 검증할 수 없는 항목만 모았다. **실기기 없이는 완료할 수 없다.**

**Files:**
- Modify: `app.json` (모션 권한이 필요한 것으로 확인된 경우에만)

**Interfaces:**
- Consumes: Task 1~5 전체
- Produces: 없음

- [ ] **Step 1: 실기기에 설치**

```
pnpm ios --device
```

- [ ] **Step 2: 권한 프롬프트 확인**

앱을 처음 실행하고 기기를 눕힌다.

Expected(둘 중 하나):
- **프롬프트가 뜨지 않는다** — 원시 가속도계는 권한이 필요 없다. Step 3을 건너뛴다.
- **모션 권한 프롬프트가 뜬다** — 문구가 비어 있거나 기본값이면 Step 3으로 간다.

- [ ] **Step 3: 권한 문구 추가 (Step 2에서 프롬프트가 뜬 경우에만)**

`app.json`의 `plugins` 배열에 추가한다.

```json
      [
        "expo-sensors",
        {
          "motionPermission": "기기를 가로로 돌렸을 때 안내를 표시하기 위해 동작 감지 권한이 필요합니다."
        }
      ],
```

다시 prebuild하고 재설치한다.

```
pnpm exec expo prebuild --platform ios --clean
pnpm ios --device
```

- [ ] **Step 4: 센서 동작 확인**

Task 5 Step 4의 1~4번을 실기기에서 반복한다.

Expected: Android와 동일하게 동작한다. **축 부호를 절댓값으로 흡수한 것이 맞는지 확인하는 지점이다.** iOS에서만 반대로 동작하면 부호 처리가 잘못된 것이다.

- [ ] **Step 5: 웹뷰 위 표시 재확인**

실기기에서 피드백 웹뷰를 열고 눕힌다.

Expected: 안내가 웹 콘텐츠 위에 뜬다.

- [ ] **Step 6: 권한 거부 경로 확인 (Step 3을 수행한 경우에만)**

설정에서 앱의 동작 권한을 끄고 다시 실행한다.

Expected: 안내가 뜨지 않지만 **앱의 다른 기능은 모두 정상**이다. 안내가 없을 뿐이므로 별도 처리를 하지 않는 것이 설계다.

- [ ] **Step 7: iPad 실기기 또는 시뮬레이터 확인**

Task 1에서 세로로 잠갔으므로 회전해도 앱이 돌지 않는다. 실기기가 있으면 눕혀서 센서 경로로 안내가 뜨는지 확인한다.

- [ ] **Step 8: 커밋 (Step 3을 수행한 경우에만, 사용자 승인 후)**

```bash
git add app.json
git commit -m "fix(orientation): iOS 동작 감지 권한 문구 추가"
```

---

## 최종 검증

- [ ] `pnpm lint` / `pnpm exec tsc --noEmit` 통과
- [ ] iPad에서 회전해도 앱이 세로를 유지 (Task 1)
- [ ] Android 실기기/에뮬레이터에서 눕히면 0.8초 뒤 안내, 되돌리면 사라짐
- [ ] iOS 실기기에서 동일하게 동작
- [ ] **웹뷰 화면 위에 안내가 뜸** (피드백, 설정 약관 둘 다)
- [ ] 평평히 놓았을 때 안내가 뜨지 않음
- [ ] 임계 근처에서 깜빡이지 않음
- [ ] 녹음 중에 떠도 녹음이 끊기지 않음
- [ ] iOS 시뮬레이터에서 크래시 없이 안내만 안 뜸
- [ ] 기존 세 확인 모달(시험 나가기, 재답변 폐기, 기록 삭제)이 이전과 동일
