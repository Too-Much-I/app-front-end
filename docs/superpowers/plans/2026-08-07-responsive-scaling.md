# 화면 크기 기반 전역 스케일링 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 하나의 스케일 계수로 앱과 웹뷰의 타이포·여백·이미지가 화면 크기에 비례해 함께 커지고 작아지게 만든다.

**Architecture:** NativeWind의 `rem`을 빌드 타임 상수에서 런타임 옵저버블로 전환하고(`inlineRem: false`), 화면 폭에서 계산한 계수를 `rem.set()`으로 적용한다. Tailwind 기본 스케일이 이미 rem 기반이므로 여백과 이미지 상자는 자동으로 따라온다. 같은 계수를 URL 쿼리로 웹뷰에 실어 보내고, 웹은 루트 font-size로 반영한다.

**Tech Stack:** Expo 57, React Native 0.86, NativeWind 4.2.6, Tailwind 3.4 (앱) / Next.js 16, Tailwind v4 (웹)

**설계 문서:** [2026-08-07-responsive-scaling-design.md](../specs/2026-08-07-responsive-scaling-design.md)

## Global Constraints

- 패키지 매니저는 `pnpm`이다. npm/Yarn 락파일을 만들지 않는다.
- `src/theme/tokens.js`는 CommonJS를 유지한다. `tailwind.config.js`가 `require()`로 읽는다.
- 텍스트는 `src/components/ui/Text.tsx`, 누르는 요소는 `src/components/ui/Pressable.tsx`를 쓴다. RN 원본을 직접 쓰지 않는다.
- 폰트는 Jua 단일 굵기다. `font-medium` / `font-bold`를 넣지 않는다.
- **자동 테스트 러너가 없다**(`AGENTS.md:24`). 따라서 이 계획의 검증은 `pnpm lint` + `pnpm exec tsc --noEmit` + 명시된 수동 확인이다. 각 태스크의 수동 확인 항목을 건너뛰면 그 태스크는 완료가 아니다.
- **커밋은 사용자가 명시적으로 요청할 때만 한다**(`AGENTS.md:86`). 각 태스크의 마지막 커밋 단계는 사용자 승인 후에만 실행한다.
- 커밋 제목은 Conventional Commit 타입 + 한국어 본문이다. 예: `feat(theme): 화면 크기 기반 rem 스케일링 추가`
- 앱의 rem 기준은 **14**, 웹의 기준은 **16**이다. 각자의 기준에서 scale 1.0이 "현재와 동일"을 뜻한다.
- 스케일 범위는 앱과 웹 모두 **[0.92, 1.35]**로 클램프한다.

---

## File Structure

**app-front-end**

| 파일 | 책임 |
| --- | --- |
| `metro.config.js` (수정) | rem을 런타임 단위로 남기는 빌드 설정 |
| `src/theme/tokens.js` (수정) | `fontSize`를 rem으로 선언 |
| `src/theme/rem-scale.ts` (신규) | 스케일 계수 계산, `rem.set()` 적용, 폭 변화 구독 |
| `App.tsx` (수정) | 스케일 구독 훅 마운트 |
| `src/lib/web-base-url.ts` (수정) | 웹뷰 URL에 `scale` 쿼리를 붙이는 헬퍼 |
| `src/screens/feedback/FeedbackScreen.tsx` (수정) | 피드백 웹뷰 URL 2종에 scale 전달 |
| `src/screens/settings/SettingsWebViewScreen.tsx` (수정) | 설정 웹뷰 URL에 scale 전달 |

**web-front-end** (`~/soma/web-front-end`)

| 파일 | 책임 |
| --- | --- |
| `src/app/layout.tsx` (수정) | `scale` 쿼리를 읽어 루트 font-size를 첫 페인트 전에 설정 |

`rem-scale.ts`를 `src/theme/`에 두는 이유는 이것이 디자인 토큰의 런타임 축이기 때문이다. `tokens.js`가 값을 정의하고 `rem-scale.ts`가 그 값의 기준 단위를 정한다.

---

## Task 1: rem을 런타임 단위로 전환

이 태스크는 **동작을 하나도 바꾸지 않는다.** rem 계산 시점을 빌드 타임에서 런타임으로 옮기기만 한다. 이후 모든 태스크가 이것에 의존하므로 여기서 회귀가 없음을 확인하고 넘어간다.

**Files:**
- Modify: `metro.config.js:6`

**Interfaces:**
- Consumes: 없음
- Produces: 이후 태스크에서 `rem.set()`이 실제로 스타일에 반영되는 상태

- [ ] **Step 1: 변경 전 기준 스크린샷 확보**

iOS 시뮬레이터(iPhone 16 또는 15)에서 앱을 띄우고 세 화면을 캡처한다. 이 스크린샷이 Task 1~2의 회귀 판정 기준이다.

```bash
pnpm ios
```

캡처 대상: 홈 화면, 모의고사 준비 화면(`MockExamReady`), 설정 화면.

- [ ] **Step 2: `metro.config.js` 수정**

```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: "./global.css",
  // rem을 빌드 타임 상수로 굽지 않고 런타임 옵저버블로 남긴다.
  // 이 값이 숫자면 CSS의 rem이 `value * inlineRem`으로 인라이닝되어
  // `rem.set()`이 무시된다(react-native-css-interop parseDeclaration).
  // 기본값 14와 런타임 rem 옵저버블의 기본값이 같으므로, 이 변경만으로는
  // 렌더 결과가 달라지지 않는다.
  inlineRem: false,
});
```

- [ ] **Step 3: Metro 캐시를 지우고 재시작**

옛 번들이 남아 있으면 상수로 구워진 rem이 그대로 쓰여 변경이 반영되지 않는다.

```bash
pnpm start --clear
```

- [ ] **Step 4: 타입·린트 검사**

```bash
pnpm lint
pnpm exec tsc --noEmit
```

Expected: 둘 다 통과. `metro.config.js`는 타입 검사 대상이 아니므로 변화가 없어야 정상이다.

- [ ] **Step 5: 회귀 확인 — 가장 중요한 검증 지점**

Step 1의 세 화면을 다시 캡처해 비교한다.

Expected: **픽셀 단위로 동일.** 글자 크기, 여백, 이미지 크기가 모두 같아야 한다.

차이가 보이면 다음 태스크로 넘어가지 않는다. `inlineRem` 기본값(14)과 런타임 `rem` 옵저버블 기본값(14)이 어긋났다는 뜻이므로, `node_modules/react-native-css-interop/dist/runtime/native/unit-observables.js`의 `observable(14)`와 `node_modules/nativewind/dist/metro/index.js`의 `inlineRem = 14`를 다시 확인한다.

- [ ] **Step 6: 커밋 (사용자 승인 후)**

```bash
git add metro.config.js
git commit -m "chore(build): rem을 런타임 단위로 전환

NativeWind의 inlineRem 기본값 14가 rem을 빌드 타임 상수로 굽고 있어
rem.set()이 무시됐다. 화면 크기 기반 스케일링의 전제 조건이다.
기본값이 런타임 옵저버블과 같아 렌더 결과는 변하지 않는다."
```

---

## Task 2: `fontSize` 토큰을 rem으로 전환

Task 1과 마찬가지로 **렌더 결과가 변하지 않아야 한다.** 글자를 rem 시스템 안으로 들여놓기만 한다.

**Files:**
- Modify: `src/theme/tokens.js` (`fontSize` 블록)

**Interfaces:**
- Consumes: Task 1의 `inlineRem: false`
- Produces: `rem` 옵저버블에 반응하는 `text-xs` ~ `text-3xl` 유틸리티

- [ ] **Step 1: `fontSize` 블록 교체**

`src/theme/tokens.js`의 기존 `fontSize` 선언(주석 포함)을 아래로 바꾼다.

```js
/**
 * px 값을 rem 문자열로 환산한다.
 *
 * 기준이 14인 이유는 NativeWind의 rem 기본값이 14이기 때문이다. 16으로 바꾸면
 * Tailwind 기본 여백(`p-4`, `gap-2` 등)이 전부 14.3% 커져 모든 화면에 영향이 간다.
 * 그 변경은 별도 디자인 판단으로 다룬다.
 */
const remFromPx = (px) => `${px / 14}rem`;

/**
 * fontSize에 lineHeight를 항상 붙여둔다.
 * lineHeight를 비워두면 플랫폼별 폰트 메트릭으로 행 높이가 갈려서
 * 탭바처럼 높이가 고정된 컨테이너의 수치를 다시 맞춰야 한다.
 *
 * px가 아니라 rem인 이유: 런타임 rem 스케일링(`src/theme/rem-scale.ts`)이
 * 글자와 여백을 같은 계수로 움직이게 하려면 둘이 같은 단위여야 한다.
 */
const fontSize = {
  xs: [remFromPx(12), { lineHeight: remFromPx(16) }],
  sm: [remFromPx(14), { lineHeight: remFromPx(20) }],
  base: [remFromPx(16), { lineHeight: remFromPx(24) }],
  lg: [remFromPx(18), { lineHeight: remFromPx(26) }],
  xl: [remFromPx(20), { lineHeight: remFromPx(28) }],
  "2xl": [remFromPx(24), { lineHeight: remFromPx(32) }],
  "3xl": [remFromPx(30), { lineHeight: remFromPx(38) }],
};
```

`module.exports`는 변경하지 않는다. `fontSize`는 이미 내보내지고 있다.

- [ ] **Step 2: Metro 캐시를 지우고 재시작**

`tailwind.config.js`가 `tokens.js`를 읽으므로 CSS가 다시 생성돼야 한다.

```bash
pnpm start --clear
```

- [ ] **Step 3: 타입·린트 검사**

```bash
pnpm lint
pnpm exec tsc --noEmit
```

Expected: 둘 다 통과.

- [ ] **Step 4: 회귀 확인**

Task 1 Step 1의 세 화면을 다시 캡처해 비교한다.

Expected: **픽셀 단위로 동일.** `remFromPx(16)` = `1.142857…rem`이고 rem이 14이므로 정확히 16dp다.

글자만 미세하게 달라 보이면 `remFromPx`의 나눗셈 기준이 14가 아닌지 확인한다.

- [ ] **Step 5: 커밋 (사용자 승인 후)**

```bash
git add src/theme/tokens.js
git commit -m "refactor(theme): fontSize 토큰을 rem 단위로 전환

여백과 이미지는 Tailwind 기본 스케일을 따라 이미 rem이었는데
fontSize만 px로 고정돼 있어 글자가 스케일링에서 빠져 있었다.
기준 14로 환산해 렌더 결과는 동일하다."
```

---

## Task 3: 스케일 계수 계산과 적용

여기서부터 실제로 화면 크기에 반응한다.

**Files:**
- Create: `src/theme/rem-scale.ts`
- Modify: `App.tsx`

**Interfaces:**
- Consumes: Task 1의 `inlineRem: false`, Task 2의 rem 기반 `fontSize`
- Produces:
  - `BASE_REM: number` (= 14)
  - `scaleForWidth(width: number): number`
  - `applyRemScale(width: number): void`
  - `useRemScale(): void`
  - `useScaleValue(): number` — Task 4가 웹뷰 URL 조립에 쓴다

- [ ] **Step 1: `src/theme/rem-scale.ts` 생성**

```ts
import { useEffect } from "react";
import { Dimensions, useWindowDimensions } from "react-native";
import { rem } from "nativewind";

/**
 * NativeWind의 rem 기본값. 빌드 타임 `inlineRem` 기본값과 같은 값이라
 * scale이 1일 때 스케일링 도입 전과 렌더 결과가 동일하다.
 */
export const BASE_REM = 14;

/** iPhone 15/16 표준 폭. 이 폭에서 scale이 정확히 1.0이 된다. */
const BASE_WIDTH = 393;

/**
 * 폭 비율을 그대로 반영하지 않고 절반만 반영한다.
 *
 * 11인치 iPad는 834pt로 기준 대비 2.12배다. 비율을 그대로 곱하면 글자가
 * 화면을 압도한다. 완충 계수와 상한을 함께 둬서 큰 화면에서 "조금 더 큰"
 * 수준에 머무르게 한다.
 */
const SLOPE = 0.5;
const MIN_SCALE = 0.92;
const MAX_SCALE = 1.35;

/**
 * 화면 폭에 대응하는 스케일 계수.
 *
 * | 기기 | 폭(pt) | scale |
 * | iPhone SE | 375 | 0.98 |
 * | iPhone 15/16 | 393 | 1.00 |
 * | iPhone 16 Pro Max | 440 | 1.06 |
 * | iPad 11" 세로 | 834 | 1.35 (상한) |
 */
export function scaleForWidth(width: number): number {
  // Dimensions가 0이나 NaN을 주는 경로는 확인되지 않았지만, NaN은 비교가 모두
  // false라 클램프를 그대로 통과해 MAX_SCALE이 된다. 명시적으로 막는다.
  if (!Number.isFinite(width) || width <= 0) return 1;

  const raw = 1 + (width / BASE_WIDTH - 1) * SLOPE;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, raw));
}

export function applyRemScale(width: number): void {
  rem.set(BASE_REM * scaleForWidth(width));
}

/**
 * 모듈 로드 시점에 한 번 맞춘다.
 *
 * React 렌더 이후 effect에서만 set하면 첫 프레임이 기본값 14로 그려진 뒤
 * 바뀌어 큰 화면에서 글자가 한 번 튄다. import 부작용이지만 의도된 것이다.
 */
applyRemScale(Dimensions.get("window").width);

/**
 * 실행 중 화면 폭 변화를 따라간다.
 *
 * 폴더블 접힘/펼침, iPad Split View 조정처럼 앱이 살아 있는 채로 폭이 바뀌는
 * 경우를 위한 것이다. 앱 루트에서 한 번만 호출한다.
 */
export function useRemScale(): void {
  const { width } = useWindowDimensions();

  useEffect(() => {
    applyRemScale(width);
  }, [width]);
}

/**
 * 현재 스케일 계수 자체가 필요한 곳(웹뷰 URL 조립)에서 쓴다.
 *
 * `rem.get()`을 읽지 않는 이유는 그것이 옵저버블이라 React가 변경을 구독하지
 * 못하기 때문이다. 폭에서 다시 계산하는 편이 단일 경로다.
 */
export function useScaleValue(): number {
  const { width } = useWindowDimensions();
  return scaleForWidth(width);
}
```

- [ ] **Step 2: `App.tsx`에 연결**

`AppContent`의 첫 줄에 훅을 추가한다. early return보다 위에 있어야 훅 순서가 안정된다.

```tsx
import { useRemScale } from "@/theme/rem-scale";

function AppContent() {
  useRemScale();

  const { ready: fontsReady, onLayoutRootView } = useAppFonts();
  const { state } = useAuth();
  // ...이하 기존 코드 그대로
```

import는 기존 import 그룹의 알파벳 순서에 맞춰 `@/theme/use-app-fonts` 앞에 넣는다.

- [ ] **Step 3: 타입·린트 검사**

```bash
pnpm lint
pnpm exec tsc --noEmit
```

Expected: 둘 다 통과. 실패한다면 `nativewind`가 `rem`을 export하는지 확인한다 — `node_modules/nativewind/dist/index.d.ts:2`에 있어야 한다.

- [ ] **Step 4: iPhone 회귀 확인**

```bash
pnpm ios
```

Expected: iPhone 16(393pt)에서 Task 1 Step 1의 스크린샷과 **동일.** scale이 정확히 1.0이다.

- [ ] **Step 5: 큰 화면 동작 확인**

iPad 시뮬레이터로 실행한다.

Expected: 글자와 여백과 마스코트 이미지가 **함께** 커진다. 글자만 커지고 여백이 그대로면 rem 밖에 남은 값이 있다는 뜻이므로 Task 6에서 다룬다.

- [ ] **Step 6: 작은 화면 확인**

iPhone SE 시뮬레이터로 실행한다.

Expected: 0.98배라 거의 차이가 없고, 어떤 화면에서도 텍스트 잘림이나 레이아웃 깨짐이 없다.

- [ ] **Step 7: 커밋 (사용자 승인 후)**

```bash
git add src/theme/rem-scale.ts App.tsx
git commit -m "feat(theme): 화면 크기 기반 rem 스케일링 추가

화면 폭에서 계산한 계수로 rem을 조정해 글자와 여백과 이미지가 함께
커지고 작아지게 한다. 기준 폭 393pt에서 1.0이고 [0.92, 1.35]로 자른다.
iPad는 원시 비율이 2.12배라 그대로 반영하면 과해서 절반만 반영한다."
```

---

## Task 4: 웹뷰 URL에 스케일 전달

**Files:**
- Modify: `src/lib/web-base-url.ts`
- Modify: `src/screens/feedback/FeedbackScreen.tsx:50-67`
- Modify: `src/screens/settings/SettingsWebViewScreen.tsx:23`

**Interfaces:**
- Consumes: Task 3의 `useScaleValue(): number`
- Produces: `withRemScale(url: string, scale: number): string`

- [ ] **Step 1: `src/lib/web-base-url.ts`에 헬퍼 추가**

기존 `WEB_BASE_URL` 선언 아래에 덧붙인다.

```ts
/**
 * 웹뷰 URL에 앱의 rem 스케일을 실어 보낸다.
 *
 * 웹은 이 값으로 루트 font-size를 맞춰 앱과 같은 비율로 커진다. 쿼리로 넘기는
 * 이유는 웹의 진입 페이지가 클라이언트 컴포넌트라, 주입 스크립트나 훅으로
 * 전달하면 하이드레이션 이후에야 값이 잡혀 글자 크기가 한 번 튀기 때문이다.
 */
export function withRemScale(url: string, scale: number): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}scale=${scale.toFixed(3)}`;
}
```

- [ ] **Step 2: `FeedbackScreen.tsx`의 URL 빌더 두 개 수정**

`buildOverviewUrl`과 `buildQuestionUrl`이 `scale`을 받게 한다.

```ts
function buildOverviewUrl(examId: string, scale: number): string | null {
  if (!WEB_BASE_URL) return null;
  return withRemScale(
    `${WEB_BASE_URL}/app-exam-screen?examId=${encodeURIComponent(examId)}`,
    scale,
  );
}

function buildQuestionUrl(
  examId: string,
  questionNumber: number,
  scale: number,
  retryCount?: number,
): string | null {
  if (!WEB_BASE_URL) return null;
  const url = `${WEB_BASE_URL}/app-question-feedback?examId=${encodeURIComponent(
    examId,
  )}&questionNumber=${questionNumber}`;
  const withRetry =
    retryCount !== undefined && retryCount > 0
      ? `${url}&retryCount=${retryCount}`
      : url;
  return withRemScale(withRetry, scale);
}
```

`scale`을 `retryCount` 앞에 두는 이유는 `retryCount`가 선택 인자이기 때문이다. 선택 인자 뒤에 필수 인자를 둘 수 없다.

import에 `withRemScale`을 추가한다:

```ts
import { WEB_BASE_URL, withRemScale } from "@/lib/web-base-url";
```

- [ ] **Step 3: `FeedbackScreen.tsx`의 호출부 수정**

컴포넌트 본문에서 `useScaleValue()`를 호출하고 두 빌더에 넘긴다.

```tsx
import { useScaleValue } from "@/theme/rem-scale";

// 컴포넌트 안:
const scale = useScaleValue();
```

`buildOverviewUrl(examId)` → `buildOverviewUrl(examId, scale)`,
`buildQuestionUrl(examId, questionNumber, retryCount)` → `buildQuestionUrl(examId, questionNumber, scale, retryCount)`로 모든 호출부를 고친다.

호출부가 `useMemo`의 의존성 배열 안에 있다면 `scale`을 배열에 추가한다. 빠뜨리면 폭이 바뀌어도 URL이 갱신되지 않는다.

- [ ] **Step 4: `SettingsWebViewScreen.tsx` 수정**

```tsx
import { WEB_BASE_URL, withRemScale } from "@/lib/web-base-url";
import { useScaleValue } from "@/theme/rem-scale";

export function SettingsWebViewScreen({
  navigation,
  route,
}: SettingsWebViewScreenProps) {
  const { path, title } = route.params;
  const scale = useScaleValue();
  const url = WEB_BASE_URL ? withRemScale(`${WEB_BASE_URL}${path}`, scale) : null;
```

- [ ] **Step 5: 타입·린트 검사**

```bash
pnpm lint
pnpm exec tsc --noEmit
```

Expected: 둘 다 통과. `buildQuestionUrl` 호출부를 하나라도 빠뜨리면 tsc가 인자 개수 불일치로 잡아준다.

- [ ] **Step 6: URL 확인**

앱에서 피드백 화면과 설정 웹뷰를 연다. `console.log`로 URL을 찍거나 웹 서버 로그로 확인한다.

Expected: iPhone에서 `...&scale=1.000`, iPad에서 `...&scale=1.350`.

- [ ] **Step 7: 커밋 (사용자 승인 후)**

```bash
git add src/lib/web-base-url.ts src/screens/feedback/FeedbackScreen.tsx src/screens/settings/SettingsWebViewScreen.tsx
git commit -m "feat(webview): 웹뷰 URL에 rem 스케일 전달

웹이 앱과 같은 비율로 커지도록 scale 쿼리를 싣는다. 주입 스크립트가 아니라
쿼리인 이유는 웹 진입 페이지가 클라이언트 컴포넌트라 하이드레이션 이후에야
값이 잡혀 글자 크기가 튀기 때문이다."
```

---

## Task 5: 웹에서 스케일 반영

**저장소가 다르다.** 이 태스크는 `~/soma/web-front-end`에서 작업한다.

**Files:**
- Modify: `~/soma/web-front-end/src/app/layout.tsx`

**Interfaces:**
- Consumes: Task 4가 붙이는 `?scale=N.NNN` 쿼리
- Produces: 없음 (최종 소비 지점)

- [ ] **Step 1: 스크립트 상수와 `<script>` 추가**

`src/app/layout.tsx`의 `RootLayout` 위에 상수를 선언한다.

```tsx
/**
 * 앱 웹뷰가 넘긴 rem 스케일을 첫 페인트 전에 반영한다.
 *
 * layout은 searchParams를 받지 못하고, 웹뷰 진입 페이지 두 개
 * (app-exam-screen, app-question-feedback)는 "use client" + useSearchParams라
 * 하이드레이션 이후에야 값이 잡힌다. 그 경로로 적용하면 글자 크기가 한 번 튄다.
 * body 첫 자식의 인라인 스크립트는 파싱 중 동기 실행되므로 깜빡임이 없다
 * (next-themes가 테마 적용에 쓰는 것과 같은 패턴이다).
 *
 * 기준이 16인 이유는 브라우저 기본 루트 font-size가 16px이기 때문이다.
 * 앱의 기준(14)과 숫자는 다르지만 각자 1.0에서 "현재와 동일"이라는 성질은 같다.
 *
 * 클램프 범위는 app-front-end의 src/theme/rem-scale.ts와 같아야 한다.
 * 쿼리는 신뢰할 수 없는 입력이므로 웹에서도 독립적으로 자른다.
 *
 * scale이 없으면 아무것도 하지 않으므로 일반 웹 방문자는 영향받지 않는다.
 */
const REM_SCALE_SCRIPT = `(function(){try{
var s=parseFloat(new URLSearchParams(location.search).get('scale'));
if(!isFinite(s))return;
s=Math.min(1.35,Math.max(0.92,s));
document.documentElement.style.fontSize=(16*s)+'px';
}catch(e){}})()`;
```

`RootLayout`의 `<body>` 첫 자식으로 넣는다.

```tsx
      <body className="flex min-h-full flex-col">
        <script dangerouslySetInnerHTML={{ __html: REM_SCALE_SCRIPT }} />
        <AnalyticsGate />
        <Providers>{children}</Providers>
      </body>
```

`next/script`가 아니라 평범한 `<script>`를 쓴다. 인라인 스크립트를 `<body>` 첫 자식에 두면 React가 그 자리에 그대로 출력하고 브라우저가 파싱 중 동기 실행한다. `next/script`의 `beforeInteractive`는 Next의 로더를 거쳐 실행 시점이 한 단계 늦다.

- [ ] **Step 2: 린트·빌드 검사**

```bash
cd ~/soma/web-front-end
pnpm lint
pnpm build
```

Expected: 둘 다 통과.

- [ ] **Step 3: 일반 웹 방문자 회귀 확인**

```bash
cd ~/soma/web-front-end && pnpm dev
```

브라우저에서 홈(`/`)과 블로그를 연다.

Expected: 스케일 적용 전과 **동일.** `scale` 쿼리가 없으면 스크립트가 즉시 반환한다.

- [ ] **Step 4: 스케일 적용 확인**

브라우저에서 `http://localhost:3000/app-settings/terms?scale=1.35`를 연다.

Expected: 글자와 여백이 전체적으로 35% 커진다. 개발자 도구에서 `<html>`의 인라인 스타일이 `font-size: 21.6px`인지 확인한다.

`?scale=abc`, `?scale=99`로도 열어본다.

Expected: 각각 기본 16px 유지, 21.6px(1.35로 클램프).

- [ ] **Step 5: 커밋 (사용자 승인 후)**

```bash
cd ~/soma/web-front-end
git add src/app/layout.tsx
git commit -m "feat(webview): 앱이 전달한 rem 스케일을 루트 font-size에 반영

앱 웹뷰가 넘기는 scale 쿼리를 첫 페인트 전에 적용해 웹 콘텐츠가 앱과 같은
비율로 커지게 한다. scale이 없으면 동작하지 않아 일반 방문자에겐 영향이 없다."
```

---

## Task 6: rem 밖에 남은 값 점검

**이 태스크는 조건부다.** Task 3 Step 5에서 불균형이 관찰된 경우에만 수행한다. 관찰되지 않았다면 건너뛰고 그 사실을 기록한다.

미리 일괄 전환하지 않는 이유는, 검증할 수 없는 변경이 diff에 섞이기 때문이다.

**Files:**
- Modify: 불균형이 확인된 파일만

**Interfaces:**
- Consumes: Task 3의 `scaleForWidth`
- Produces: 없음

- [ ] **Step 1: 후보 목록화**

```bash
grep -rnoE "w-\[[0-9]+px\]|h-\[[0-9]+px\]|width: [0-9]+|height: [0-9]+" src --include='*.tsx'
```

이 중 **주변 텍스트와 함께 커져야 하는 것**만 대상이다. 다음은 대상이 아니다.

- 탭바의 하단 safe-area inset — 탭바 높이, 콘텐츠 padding, 아이콘과 라벨은 `useScaleValue()`로 명시적으로 스케일링하되, 기기가 제공하는 하단 inset만 원래 값으로 더해 시스템 영역과의 경계를 유지한다.
- `<Feather size={24} />` 같은 아이콘 크기 — RN 숫자 prop이라 className이 닿지 않는다. 텍스트와 나란히 놓여 눈에 띄게 어긋나는 경우에만 개별 판단한다.
- 헤어라인 두께, `hitSlop` — 스케일과 무관하다.

- [ ] **Step 2: 확인된 불균형만 전환**

가장 유력한 후보는 `src/screens/mock-exam/components/ExamPartGuidePage.tsx:127`의 `mascotSize`다. JS 스타일 객체로 계산하는 마스코트 치수라 rem을 타지 않는다.

전환이 필요하면 `scaleForWidth`를 곱한다.

```tsx
import { useWindowDimensions } from "react-native";

import { scaleForWidth } from "@/theme/rem-scale";

const { width } = useWindowDimensions();
const scale = scaleForWidth(width);
// 기존 계산 결과에 scale을 곱한다
```

className으로 표현할 수 있는 치수라면 JS 계산을 없애고 `h-*`/`w-*` 유틸리티로 바꾸는 편이 낫다. 그러면 rem을 자동으로 탄다.

- [ ] **Step 3: 타입·린트 검사**

```bash
pnpm lint
pnpm exec tsc --noEmit
```

- [ ] **Step 4: iPad와 iPhone에서 재확인**

Expected: 텍스트와 이미지의 비율이 두 기기에서 같게 유지된다.

- [ ] **Step 5: 커밋 (사용자 승인 후)**

```bash
git add <수정한 파일>
git commit -m "fix(mock-exam): 마스코트 치수를 rem 스케일에 맞춤

JS로 계산하는 치수라 rem 스케일링을 타지 않아 큰 화면에서 텍스트만
커지고 마스코트가 상대적으로 작아 보였다."
```

---

## 최종 검증

모든 태스크 완료 후 한 번에 확인한다.

- [ ] `pnpm lint` / `pnpm exec tsc --noEmit` (app-front-end)
- [ ] `pnpm lint` / `pnpm build` (web-front-end)
- [ ] iPhone 16: 작업 전 스크린샷과 동일
- [ ] iPhone SE: 레이아웃 깨짐 없음
- [ ] iPad: 앱 화면과 웹뷰 화면이 **같은 비율로** 커짐
- [ ] iPad에서 피드백 웹뷰를 열 때 글자 크기가 한 번 튀지 않음
- [ ] 브라우저에서 `scale` 없이 웹 페이지를 열면 기존과 동일
