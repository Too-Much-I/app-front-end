# 화면 크기 기반 전역 스케일링 설계 (앱 + 웹뷰)

## 배경

앱에는 반응형 처리가 사실상 없다.

- `src/theme/tokens.js`의 `fontSize`가 `"12px"` ~ `"30px"`로 전부 고정값이다.
- NativeWind 브레이크포인트(`sm:` `md:` `lg:`) 사용처가 **0곳**이다.
- 이미지도 고정 치수다 — `src/screens/home/HomeScreen.tsx:103`의 `h-56 w-40`, `src/screens/mock-exam/MockExamReadyScreen.tsx:67`의 `h-32 w-32`.
- `useWindowDimensions`는 `src/screens/mock-exam/ExamPartGuideScreen.tsx:17` 한 곳뿐이고, 이것도 반응형이 아니라 가로 페이저의 스크롤 오프셋 계산용이다.

`AGENTS.md`의 "Build responsive layouts with flex and relative sizing so screens work on phones and tablets" 규약이 타이포그래피 축에서는 지켜지지 않고 있다.

이 설계는 **하나의 스케일 계수**로 앱과 웹뷰의 타이포·여백·이미지를 동시에 확대/축소한다. 화면마다 브레이크포인트를 다는 대신 rem 단위 하나를 런타임에 조정하는 방식이다.

## 사전 확인 사항

### NativeWind의 `rem`은 런타임에 바꿀 수 있다

`node_modules/react-native-css-interop/dist/runtime/native/unit-observables.js`:

```js
exports.rem = (0, observable_1.observable)(14);
```

`rem`은 `get()` / `set()`을 가진 옵저버블이고, `nativewind`가 이를 그대로 re-export한다(`node_modules/nativewind/dist/index.d.ts:2`). 스타일이 이 옵저버블을 effect로 구독하므로 `rem.set()`이 리렌더를 유발한다.

### 단, 현재 설정에서는 rem이 빌드 타임에 상수로 구워진다

`node_modules/react-native-css-interop/dist/css-to-rn/parseDeclaration.js:1141`:

```js
case "rem":
  if (typeof inlineRem === "number") return length.value * inlineRem;  // 상수로 인라이닝
  else return [{}, "rem", [length.value]];                             // 런타임 참조 디스크립터
```

`inlineRem`의 기본값은 **14**이고(`node_modules/nativewind/dist/metro/index.js:14`), `metro.config.js:6`은 이 옵션을 넘기지 않는다.

**따라서 지금 상태에서는 `rem.set()`을 불러도 아무 일도 일어나지 않는다.** `metro.config.js`에 `inlineRem: false`를 넣는 것이 이 설계의 전제다.

### 기준값이 14로 일치해서 마이그레이션이 무해하다

빌드 타임 `inlineRem` 기본값과 런타임 `rem` 옵저버블 기본값이 **둘 다 14**다. 따라서 `inlineRem: false`만 켜고 아무것도 안 하면 화면이 픽셀 단위로 지금과 동일하다. 각 단계를 독립적으로 넣고 회귀를 확인할 수 있다.

여기서 파생되는 사실 하나 — Tailwind 기본 스케일은 rem 기반이므로(`p-4` = 1rem, `w-40` = 10rem) **현재 `p-4`는 16dp가 아니라 14dp로 렌더링되고 있다.** 웹 Tailwind 감각으로 짐작한 값과 다르다. 이 설계는 이 값을 바꾸지 않는다.

### 웹은 이미 rem 기반이고 폭 제한이 있다

`~/soma/web-front-end`는 Next.js 16 + Tailwind v4다. Tailwind v4는 전부 rem 기반이고, `src/app/globals.css`의 `html` 규칙은 `@apply font-sans`뿐이라 루트 font-size 오버라이드가 없다(= 브라우저 기본 16px).

웹뷰 라우트 3개의 반응형 현황:

- 브레이크포인트 13곳 (`sm:text-base`, `lg:text-4xl` 등)
- `mx-auto ... max-w-3xl px-5`로 폭 제한이 이미 있다 — `src/components/app-exam-screen/FeedbackScreen.tsx:186`, `src/components/app-question-feedback/QuestionFeedbackScreen.tsx:154`

### 웹뷰 진입 페이지는 클라이언트 컴포넌트다

`app-exam-screen/page.tsx`와 `app-question-feedback/page.tsx`는 `"use client"`이며 `useSearchParams()`를 쓴다. `app-settings/*`는 서버 컴포넌트다. 그리고 Next.js App Router의 **layout은 `searchParams`를 받지 못한다.**

이 혼재 때문에 페이지 단위로 스케일을 적용하면 파일마다 방식이 갈리고, 클라이언트 페이지에서는 하이드레이션 이후에야 값이 잡혀 글자 크기가 한 번 튄다. 이 설계는 루트 레이아웃의 **블로킹 인라인 스크립트** 하나로 해결한다(6절).

### 호환 모드에서 이중 확대가 일어나지 않는다

iPad에서 iPhone 호환 모드로 실행되면 OS가 창을 확대하지만, `Dimensions.get("window")`는 iPhone 논리 크기를 그대로 보고한다. 따라서 스케일이 1.0으로 계산되고 확대는 OS에만 맡겨진다. 별도 분기가 필요 없다.

## 범위

### 포함

**app-front-end**

1. `metro.config.js` — `inlineRem: false`
2. `src/theme/tokens.js` — `fontSize`를 px → rem
3. `src/theme/rem-scale.ts` 신설 — 스케일 계수 계산과 `rem.set()` 적용
4. `App.tsx` — 화면 크기 변화 구독
5. `src/screens/feedback/FeedbackScreen.tsx`, `src/screens/settings/SettingsWebViewScreen.tsx` — 웹뷰 URL에 `scale` 전달

**web-front-end**

6. `src/app/layout.tsx` — `scale` 쿼리를 읽어 루트 font-size를 설정하는 인라인 스크립트

### 제외

- **브레이크포인트 도입.** 이 설계는 비례 스케일링만 다룬다. 태블릿에서 2단 레이아웃으로 재배치하는 것은 별개 작업이다.
- **탭바 하단 safe-area inset.** 탭바 높이, 콘텐츠 padding, 아이콘과 라벨은 `useScaleValue()`로 명시적으로 스케일링한다. 기기에서 제공하는 하단 safe-area inset만 원래 값으로 더해 시스템 영역과의 경계를 유지한다.
- **고정 px/숫자 치수 57곳의 일괄 전환.** 5절에서 판단 기준만 정하고, 실제 전환은 눈에 띄는 회귀가 확인된 곳만 개별 처리한다.
- **태블릿 지원 여부 결정** (`app.json`의 `supportsTablet`, Play Console 기기 제외). 스토어 정책 판단이라 코드 설계와 분리한다.
- **화면 회전 안내 팝업.** `2026-08-07-portrait-only-notice-design.md`로 분리했다.

## 1. 스케일 계수

`src/theme/rem-scale.ts`:

```ts
/** 빌드 타임 inlineRem 기본값이자 런타임 rem 옵저버블 기본값. 둘이 같아야 scale=1이 현재와 동일하다. */
export const BASE_REM = 14;

/** iPhone 15/16 표준 폭. 이 폭에서 scale이 정확히 1.0이 된다. */
const BASE_WIDTH = 393;

/** 폭 비율을 그대로 쓰지 않고 절반만 반영한다. 아래 표 참고. */
const SLOPE = 0.5;
const MIN_SCALE = 0.92;
const MAX_SCALE = 1.35;

export function scaleForWidth(width: number): number {
  const raw = 1 + (width / BASE_WIDTH - 1) * SLOPE;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, raw));
}
```

`SLOPE`와 상한이 필요한 이유: 11인치 iPad는 834pt로 기준 대비 **2.12배**다. 비율을 그대로 곱하면 글자가 우스꽝스럽게 커진다. 절반만 반영하고 1.35에서 자른다.

| 기기 | 폭(pt) | 원시 비율 | 최종 scale | `text-base` |
| --- | --- | --- | --- | --- |
| iPhone SE | 375 | 0.95 | 0.98 | 15.7dp |
| iPhone 15/16 | 393 | 1.00 | **1.00** | **16dp (현재와 동일)** |
| iPhone 16 Pro Max | 440 | 1.12 | 1.06 | 17.0dp |
| iPad 11" (세로) | 834 | 2.12 | 1.35 (상한) | 21.6dp |

`MIN_SCALE`을 0.92로 둔 이유는 작은 폰에서 무한정 줄어드는 것을 막기 위해서다. 실기기 중 이 하한에 닿는 것은 없고, 접히지 않은 폴더블이나 예외적 폼팩터에 대한 방어값이다.

반올림은 하지 않는다. RN은 소수 dp를 처리하고, 양자화를 넣으면 기기별로 계단이 생겨 오히려 눈에 띈다.

## 2. `metro.config.js`

```js
module.exports = withNativeWind(config, {
  input: "./global.css",
  // rem을 빌드 타임 상수로 굽지 않고 런타임 옵저버블로 남긴다.
  // 이 값이 숫자면 `rem.set()`이 무시된다(react-native-css-interop parseDeclaration).
  inlineRem: false,
});
```

Metro 캐시를 지우고 다시 시작해야 반영된다.

**이 단계만 적용한 시점에서 화면이 현재와 픽셀 단위로 동일해야 한다.** 여기서 차이가 보이면 이후 단계로 넘어가지 않고 원인을 먼저 찾는다.

## 3. `tokens.js`의 `fontSize`

기준 14로 환산한다. 숫자가 계속 읽히도록 헬퍼를 둔다.

```js
/**
 * px 값을 rem 문자열로 환산한다.
 *
 * 기준이 14인 이유는 NativeWind의 rem 기본값이 14이기 때문이다. 16으로 바꾸면
 * Tailwind 기본 여백(`p-4`, `gap-2` 등)이 전부 14.3% 커져 모든 화면에 영향이 간다.
 * 그 변경은 별도 디자인 판단으로 다룬다.
 */
const rem = (px) => `${px / 14}rem`;

const fontSize = {
  xs: [rem(12), { lineHeight: rem(16) }],
  sm: [rem(14), { lineHeight: rem(20) }],
  base: [rem(16), { lineHeight: rem(24) }],
  lg: [rem(18), { lineHeight: rem(26) }],
  xl: [rem(20), { lineHeight: rem(28) }],
  "2xl": [rem(24), { lineHeight: rem(32) }],
  "3xl": [rem(30), { lineHeight: rem(38) }],
};
```

`tokens.js`는 CommonJS를 유지한다(`AGENTS.md`의 명시 규약, `tailwind.config.js`가 `require()`로 읽는다).

scale이 1.0일 때 `rem(16)` = `1.1428…rem` × 14 = **16dp**로 현재와 정확히 같다.

## 4. `rem.set()` 적용 지점

`src/theme/rem-scale.ts`에 초기 적용과 갱신을 모두 둔다.

```ts
import { useEffect } from "react";
import { Dimensions, useWindowDimensions } from "react-native";
import { rem } from "nativewind";

export function applyRemScale(width: number): void {
  rem.set(BASE_REM * scaleForWidth(width));
}

/**
 * 모듈 로드 시점에 한 번 맞춘다.
 *
 * React 렌더 이후 effect에서만 set하면 첫 프레임이 기본값 14로 그려진 뒤 바뀌어
 * 큰 화면에서 글자가 한 번 튄다. import 부작용이지만 의도된 것이다.
 */
applyRemScale(Dimensions.get("window").width);

/** 폴더블 접힘/펼침, iPad 회전, Split View처럼 실행 중 폭이 바뀌는 경우를 따라간다. */
export function useRemScale(): void {
  const { width } = useWindowDimensions();
  useEffect(() => {
    applyRemScale(width);
  }, [width]);
}
```

`App.tsx`의 `AppContent`에서 `useRemScale()`을 호출한다. 이 컴포넌트는 폰트/인증 상태가 준비되기 전에 `null`을 반환하지만, 훅은 early return보다 위에서 호출되므로 영향받지 않는다.

## 5. rem 밖에 남는 값들

`grep`으로 확인한 고정 px/숫자 치수가 57곳 있다. 두 부류로 나뉜다.

**의도적으로 두는 것**

- `tokens.js`의 `tabBar` 치수 — react-navigation `tabBarStyle`에 넘기는 JS 숫자다. 탭바 높이가 rem을 따라 커지면 안전 영역 계산과 어긋나고, 하단 탭바는 화면이 커져도 같은 높이인 편이 자연스럽다.
- 아이콘 `size` prop (`<Feather size={24} />`) — RN 숫자 prop이라 className이 닿지 않는다. 필요하면 개별 판단한다.
- 헤어라인 두께, `hitSlop` 등 스케일과 무관한 값.

**전환을 검토할 것**

- `src/screens/mock-exam/components/ExamPartGuidePage.tsx:127`의 `mascotSize` — JS 스타일 객체로 계산하는 마스코트 치수다. 주변 텍스트만 커지고 마스코트는 그대로면 균형이 깨진다.

일괄 전환은 하지 않는다. 3~4절 적용 후 실제 기기에서 확인해 **눈에 띄는 불균형이 있는 곳만** 개별 처리한다. 미리 전부 바꾸면 검증할 수 없는 변경이 diff에 섞인다.

## 6. 웹뷰로 스케일 전달

### 앱 쪽

`WEB_BASE_URL` 기반 URL을 만드는 세 곳에 `scale`을 붙인다.

- `FeedbackScreen.tsx:52` — `/app-exam-screen?examId=…`
- `FeedbackScreen.tsx:61` — `/app-question-feedback?examId=…`
- `SettingsWebViewScreen.tsx:23` — `${WEB_BASE_URL}${path}`

세 곳이 같은 규칙을 쓰도록 `src/lib/web-base-url.ts`에 붙인다:

```ts
/** 웹뷰 URL에 앱의 rem 스케일을 실어 보낸다. 웹은 이 값으로 루트 font-size를 맞춘다. */
export function withRemScale(url: string, scale: number): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}scale=${scale.toFixed(3)}`;
}
```

호출부는 현재 스케일을 `src/theme/rem-scale.ts`가 제공하는 훅으로 읽는다. 4절의 `useRemScale()`과 별개로 값을 반환하는 훅을 하나 더 export한다:

```ts
/** 현재 화면 폭에 해당하는 스케일 계수. 웹뷰 URL 조립처럼 값 자체가 필요한 곳에서 쓴다. */
export function useScaleValue(): number {
  const { width } = useWindowDimensions();
  return scaleForWidth(width);
}
```

`rem.get()`을 읽어 `BASE_REM`으로 나누지 않는 이유는 그 값이 옵저버블이라 React가 변경을 구독하지 못하기 때문이다. `useWindowDimensions`에서 다시 계산하는 편이 단일 경로다.

화면 폭이 바뀌면 URL이 바뀌어 웹뷰가 재로드된다. 이는 폴더블 접힘이나 Split View 조정 같은 드문 경우이고 웹뷰가 자체 상태를 URL(`examId` 등)로 복원하므로 허용한다.

### 웹 쪽

`~/soma/web-front-end/src/app/layout.tsx`의 `<head>`에 블로킹 인라인 스크립트를 넣는다.

```tsx
{/*
  앱 웹뷰가 넘긴 rem 스케일을 첫 페인트 전에 반영한다.

  layout은 searchParams를 받지 못하고, 웹뷰 진입 페이지 두 개는 "use client" +
  useSearchParams라 하이드레이션 이후에야 값이 잡힌다. 그 경로로 적용하면 글자 크기가
  한 번 튄다. 파서를 막는 인라인 스크립트가 유일하게 FOUC 없는 지점이다.

  scale이 없으면 아무것도 하지 않으므로 일반 웹 방문자는 영향받지 않는다.
*/}
<script
  dangerouslySetInnerHTML={{
    __html: `(function(){try{
      var s=parseFloat(new URLSearchParams(location.search).get('scale'));
      if(!isFinite(s))return;
      s=Math.min(1.35,Math.max(0.92,s));
      document.documentElement.style.fontSize=(16*s)+'px';
    }catch(e){}})()`,
  }}
/>
```

앱과 달리 기준이 **16**이다. 브라우저 기본 루트 font-size가 16px이므로, scale 1.0에서 현재 웹 화면이 그대로 유지된다. 앱의 14와 숫자는 다르지만 각자의 기준에서 1.0이 "현재와 동일"이라는 성질은 같다.

쿼리 파라미터는 신뢰할 수 없는 입력이므로 웹에서도 앱과 같은 범위로 클램프한다. 상수가 두 저장소에 중복되지만, 웹이 앱 코드를 import할 수 없고 이 값이 자주 바뀌지 않으므로 주석으로 출처를 남기는 편이 낫다.

`max-w-3xl`도 rem이라 함께 커진다. 태블릿에서 본문 폭이 48rem × 1.35 = 64.8rem까지 늘어나는데, 이는 폭이 넓어진 화면에서 자연스러운 동작이므로 의도대로 둔다.

## 실패 처리

| 실패 지점 | 동작 |
| --- | --- |
| `inlineRem: false` 후 Metro 캐시 미갱신 | 옛 번들이 상수 rem을 유지해 스케일이 안 먹는다. 캐시 삭제 후 재시작으로 해소 |
| `scaleForWidth`에 0이나 NaN 유입 | `Dimensions`가 0을 주는 순간은 없지만, 클램프가 `MIN_SCALE`로 흡수한다. NaN은 비교가 모두 false라 `MAX_SCALE`이 반환된다 — 이 경로가 실제로 가능한지는 검증 항목에 둔다 |
| 웹 `scale` 파라미터 누락/오염 | `isFinite` 검사 후 무시하거나 클램프. 기본 16px 유지 |
| 웹 인라인 스크립트 예외 | `try/catch`로 삼킨다. 스케일만 적용되지 않고 페이지는 정상 동작 |
| `WEB_BASE_URL` 미설정 | 기존 동작 그대로. URL 자체가 `null`이라 `withRemScale`에 닿지 않는다 |

## 검증

자동 테스트 러너가 없으므로 `pnpm lint`와 `pnpm exec tsc --noEmit`을 돌린다. 웹은 해당 저장소의 lint/build를 돌린다.

수동 확인:

1. **2절만 적용한 상태**에서 iPhone 시뮬레이터의 홈, 시험, 피드백 화면이 적용 전과 동일한지 스크린샷으로 비교한다. 이 설계에서 가장 중요한 회귀 검증 지점이다.
2. 3절까지 적용한 뒤 같은 비교를 반복한다. 역시 동일해야 한다.
3. 4절 적용 후 iPad(또는 큰 폭 시뮬레이터)에서 글자와 여백이 함께 커지는지 확인한다. 글자만 커지고 여백이 그대로면 rem 밖의 값이 남아 있다는 뜻이다.
4. iPhone SE에서 레이아웃이 깨지지 않는지 확인한다. 0.98배라 거의 변화가 없어야 한다.
5. 피드백 웹뷰를 iPad에서 열어 웹 콘텐츠도 함께 커지는지, 그리고 **글자 크기가 한 번 튀지 않는지** 확인한다.
6. 브라우저에서 `scale` 없이 `/app-exam-screen?examId=…`를 직접 열어 기존과 동일하게 보이는지 확인한다(일반 웹 방문자 경로 회귀).
7. `NaN` 유입 경로가 실제로 가능한지 확인하고, 가능하다면 `scaleForWidth`에 `Number.isFinite` 가드를 추가한다.
