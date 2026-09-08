import { Easing, type EasingFunction, type ViewStyle } from "react-native";

import tokens from "@/theme/tokens";

export const { colors, tabBar } = tokens;

/**
 * 간격 토큰 — px 숫자.
 *
 * `className`으로 스타일링할 수 있는 곳은 NativeWind 유틸리티(`px-screen`, `gap-section`)를
 * 그대로 쓰면 되고, 이 export는 RN 스타일 객체만 받는 지점(react-navigation 옵션,
 * `contentContainerStyle`, 애니메이션 계산 등)을 위한 것이다. `shadows`와 같은 역할이다.
 *
 * rem 스케일링을 타지 않는 생값이라는 점에 주의한다. 유틸리티로 표현할 수 있으면
 * 유틸리티가 먼저다.
 */
export const { spacing, layout } = tokens;

/**
 * 모서리 반경 · 요소 치수 — px 숫자.
 *
 * `spacing`과 같은 역할이다. `className`으로 표현할 수 있는 반경은 NativeWind 유틸리티
 * (`rounded-card`, `rounded-pill`)가 먼저고, 이 export는 SVG 좌표 계산이나 아이콘
 * 컴포넌트의 `size` 프롭처럼 숫자를 그대로 받는 자리를 위한 것이다.
 */
export const { radius, size } = tokens;

/**
 * 모션 지속 시간 — ms.
 *
 * NativeWind에는 대응하는 유틸리티가 없다. RN `Animated`와 `LayoutAnimation`이
 * 전부 숫자를 받으므로 이 값은 항상 여기서 가져다 쓴다.
 */
export const { duration } = tokens;

/**
 * 이징 프리셋.
 *
 * `Easing`이 react-native import를 요구해서 `tokens.js`에 둘 수 없다(그 파일은 tailwind
 * 설정이 Node로 직접 읽는다). `shadow` → `shadows`와 같은 조립 지점이다.
 *
 * 세 개로 제한한 이유: 지금 코드에 `Easing.out(quad)` · `Easing.out(cubic)` ·
 * `Easing.inOut(quad)` · `Easing.linear`가 섞여 있는데, 앞의 둘은 눈으로 구분되지 않으면서
 * 서로 다른 곡선이라 나중에 한쪽만 조정되면 화면끼리 감속이 갈린다.
 */
export const easings = {
  /** 기본값. 손에서 놓인 뒤 감속하는 움직임 — 등장, 누름 해제, 펼침. */
  decelerate: Easing.out(Easing.quad),
  /** 나갔다 들어오는 왕복 — 위치 이동, 접힘/펼침을 오가는 요소. */
  standard: Easing.inOut(Easing.quad),
  /** 등속. 진행 바 · 펄스처럼 시간 자체를 보여주는 움직임에만 쓴다. */
  linear: Easing.linear,
} satisfies Record<string, EasingFunction>;

/** 피드백 화면에서 JS 스타일 계산(SVG/상태 배지)에 사용하는 의미 색 타입. */
export type FeedbackColors = typeof colors.feedback;

/** 프리셋 조립용 원시값. 소비처는 아래 `shadows`를 쓰라고 일부러 export하지 않는다. */
const { shadow } = tokens;

/** `useFonts`에 넘기는 키이자 RN `fontFamily`에 넣는 문자열. */
export const FONT_FAMILY = tokens.fontFamily.jua[0];

/**
 * 그림자 프리셋.
 *
 * iOS는 `shadow*`, Android는 `elevation`이라는 서로 무관한 API를 쓴다.
 * 화면마다 `Platform.OS`로 분기하지 않도록 여기서 한 번만 정의하고 재사용한다.
 * `className`으로 스타일링할 수 있는 곳은 NativeWind의 `shadow-*`를 그대로 쓰면 되고,
 * 이 프리셋은 RN 스타일 객체만 받는 지점(react-navigation 옵션 등)을 위한 것이다.
 */
export const shadows = {
  none: {
    shadowColor: shadow.colorNone,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  card: {
    shadowColor: shadow.color,
    shadowOffset: { width: 0, height: shadow.card.offsetY },
    shadowOpacity: shadow.card.opacity,
    shadowRadius: shadow.card.radius,
    elevation: shadow.card.elevation,
  },
  /** 위로 뜨는 그림자 — 하단 탭바처럼 화면 아래에 붙는 표면용. */
  raisedBottom: {
    shadowColor: shadow.color,
    shadowOffset: { width: 0, height: shadow.raisedBottom.offsetY },
    shadowOpacity: shadow.raisedBottom.opacity,
    shadowRadius: shadow.raisedBottom.radius,
    elevation: shadow.raisedBottom.elevation,
  },
} satisfies Record<string, ViewStyle>;
