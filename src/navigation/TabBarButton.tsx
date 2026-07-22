import { PlatformPressable } from "@react-navigation/elements";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";

const PRESSED_OPACITY = 0.6;

export function TabBarButton(props: BottomTabBarButtonProps) {
  return <PlatformPressable {...props} pressColor="transparent" pressOpacity={PRESSED_OPACITY} />;
}
