import { useEffect } from "react";
import {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const PULSE_MIN_OPACITY = 0.55;
const PULSE_DURATION_MS = 850;

/**
 * 스켈레톤 전체를 함께 숨 쉬게 하는 애니메이션 스타일.
 *
 * 덩어리마다 애니메이션을 걸지 않고 컨테이너 하나에 적용한다 — 여러 개가 제각각
 * 깜빡이면 로딩이 아니라 고장처럼 보인다. 모션을 줄인 사용자에게는 고정 불투명도를 준다.
 */
export function useSkeletonPulseStyle() {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(reduceMotion ? 1 : PULSE_MIN_OPACITY);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withRepeat(withTiming(1, { duration: PULSE_DURATION_MS }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity, reduceMotion]);

  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}
