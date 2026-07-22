import type { ViewStyle } from "react-native";

import tokens from "@/theme/tokens";

export const { colors, tabBar } = tokens;

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
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  /** 위로 뜨는 그림자 — 하단 탭바처럼 화면 아래에 붙는 표면용. */
  raisedBottom: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
} satisfies Record<string, ViewStyle>;
