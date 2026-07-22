import { forwardRef } from "react";
import { Platform, Pressable as RNPressable, type PressableProps, type View } from "react-native";

import { colors } from "@/theme";

const PRESSED_OPACITY = 0.7;

/**
 * 터치 피드백을 화면마다 다시 구현하지 않기 위한 공용 Pressable.
 *
 * iOS는 눌렀을 때 불투명도 변화, Android는 리플이 각 플랫폼의 관례다.
 * 이 두 분기를 여기 한 곳에만 두고, 소비처는 `Platform.OS`를 몰라도 된다.
 */
export const Pressable = forwardRef<View, PressableProps & { className?: string }>(
  function Pressable({ style, ...props }, ref) {
    return (
      <RNPressable
        ref={ref}
        android_ripple={{ color: colors.brand.subtle }}
        style={(state) => [
          typeof style === "function" ? style(state) : style,
          Platform.OS === "ios" && state.pressed ? { opacity: PRESSED_OPACITY } : null,
        ]}
        {...props}
      />
    );
  },
);
