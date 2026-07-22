import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/theme";

const STEP_DEGREES = 30;
const STEPS_PER_LOOP = 360 / STEP_DEGREES;
const OVERSHOOT_DEGREES = 6;
const SNAP_DURATION = 90;
const SETTLE_DURATION = 60;
const HOLD_DURATION = 550;

export type TickingClockProps = {
  /** 시계 전체 지름(px). */
  size?: number;
};

/**
 * 실제 카운트다운과 무관한 장식용 초침 애니메이션.
 * 30도씩 오버슈트 후 되튕기며 멈추는 걸 반복해 "똑딱" 소리가 나는 듯한 리듬을 낸다.
 * react-native-svg 없이 원형 View + 회전하는 막대 View만으로 그린다.
 */
export function TickingClock({ size = 46 }: TickingClockProps) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    const ticks = Array.from({ length: STEPS_PER_LOOP }, (_, i) => (i + 1) * STEP_DEGREES).flatMap(
      (target) => [
        withTiming(target + OVERSHOOT_DEGREES, {
          duration: SNAP_DURATION,
          easing: Easing.out(Easing.quad),
        }),
        withTiming(target, { duration: SETTLE_DURATION, easing: Easing.inOut(Easing.quad) }),
        withTiming(target, { duration: HOLD_DURATION }),
      ],
    );
    rotation.value = withRepeat(withSequence(...ticks), -1);
  }, [rotation]);

  const handStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const borderWidth = size * 0.09;
  const handThickness = size * 0.1;
  const handLength = size * 0.32;
  const markSize = size * 0.06;
  const markOffset = size / 2 - size * 0.14;

  return (
    <View
      className="items-center justify-center rounded-full bg-surface"
      style={{ width: size, height: size, borderWidth, borderColor: colors.brand[500] }}
    >
      {/* 12/3/6/9시 방향 눈금 */}
      {[0, 90, 180, 270].map((deg) => (
        <View
          key={deg}
          className="absolute rounded-full bg-brand-200"
          style={{
            width: markSize,
            height: markSize,
            transform: [{ rotate: `${deg}deg` }, { translateY: -markOffset }],
          }}
        />
      ))}
      {/* 클락 중심의 0×0 피벗을 회전시키고, 초침은 그 피벗에서 위로 그려 중심 기준 회전을 만든다. */}
      <Animated.View style={[{ width: 0, height: 0 }, handStyle]}>
        <View
          className="absolute rounded-full bg-brand-700"
          style={{
            width: handThickness,
            height: handLength,
            left: -handThickness / 2,
            top: -handLength,
          }}
        />
      </Animated.View>
      <View
        className="absolute rounded-full bg-brand-700"
        style={{ width: size * 0.14, height: size * 0.14 }}
      />
    </View>
  );
}
