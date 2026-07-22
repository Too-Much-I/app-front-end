import { PlatformPressable } from "@react-navigation/elements";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";

import { colors } from "@/theme";

const PRESSED_OPACITY = 0.6;

export function TabBarButton(props: BottomTabBarButtonProps) {
  return <PlatformPressable {...props} pressColor={colors.brand[400]} pressOpacity={PRESSED_OPACITY} />;
}
