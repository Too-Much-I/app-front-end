import { forwardRef, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable as RNPressable,
  type GestureResponderEvent,
  type PressableProps,
  type View,
} from "react-native";

const PRESSED_OPACITY = 0.7;
const RELEASE_DURATION_MS = 200;
const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

type AppPressableProps = Omit<PressableProps, "android_ripple"> & {
  /** 터치 피드백은 opacity로 통일하므로 Android 리플은 허용하지 않는다. */
  android_ripple?: never;
  className?: string;
};

/**
 * 터치 피드백을 화면마다 다시 구현하지 않기 위한 공용 Pressable.
 *
 * iOS의 불투명도 변화와 Android의 리플 중 **불투명도로 통일**했다. 각 플랫폼 관례를
 * 따르면 Android는 리플이 맞지만, 같은 버튼이 두 플랫폼에서 다르게 반응하는 것보다
 * 브랜드 톤을 동일하게 유지하는 쪽을 택했다.
 *
 * `android_ripple`은 타입과 런타임 양쪽에서 차단한다. React Navigation 같은 외부
 * 컴포넌트가 해당 프롭을 주입하더라도 이 컴포넌트 아래로 전달되지 않는다.
 */
export const Pressable = forwardRef<View, AppPressableProps>(
  function Pressable(
    { android_ripple: _androidRipple, disabled, onPressIn, onPressOut, style, ...props },
    ref,
  ) {
    const opacity = useRef(new Animated.Value(1)).current;

    const handlePressIn = (event: GestureResponderEvent) => {
      opacity.stopAnimation();
      opacity.setValue(PRESSED_OPACITY);
      onPressIn?.(event);
    };

    const handlePressOut = (event: GestureResponderEvent) => {
      opacity.stopAnimation();
      Animated.timing(opacity, {
        toValue: 1,
        duration: RELEASE_DURATION_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
      onPressOut?.(event);
    };

    // 정적 스타일은 정적으로 유지한다. 특히 react-navigation이 탭 버튼에 넘기는
    // flex/padding 정렬값을 pressed 상태 콜백으로 바꾸지 않아 기본 버튼과 레이아웃이 같다.
    const resolvedStyle =
      typeof style === "function"
        ? (state: Parameters<typeof style>[0]) => [style(state), { opacity }]
        : [style, { opacity }];

    return (
      <AnimatedPressable
        ref={ref}
        disabled={disabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={resolvedStyle}
        {...props}
      />
    );
  },
);
