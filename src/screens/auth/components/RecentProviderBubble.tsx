import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { colors, duration } from '@/theme';

// 쉬지 않고 같은 높이로 부드럽게 오르내린다(2026-10-07 사용자 "규칙적으로 두루뭉실하게").
// 높이는 말풍선 글자 크기에 맞춘 값이다. 한 번 오르내림이 `duration.loop` 한 주기다.
const BOB_HEIGHT_PX = -6;
// `easings.standard`(왕복)와 같은 곡선. 테마 프리셋은 RN Animated용이라 Reanimated 것을 쓴다.
const BOB_EASING = Easing.inOut(Easing.quad);
// 꼬리 삼각형 반 폭. 테두리 삼각형이라 border 두께가 곧 크기다.
const TAIL_HALF_WIDTH = 6;

/**
 * 로그인 버튼 위 "최근 사용" 말풍선. 감싸는 쪽이 `relative`인 원형 버튼 위에 둔다.
 * 동작 줄이기를 켠 사용자에게는 움직이지 않는다.
 */
export function RecentProviderBubble() {
  const reduceMotion = useReducedMotion();
  const offset = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    offset.value = withRepeat(
      withTiming(BOB_HEIGHT_PX, { duration: duration.loop / 2, easing: BOB_EASING }),
      -1,
      true,
    );
    return () => cancelAnimation(offset);
  }, [offset, reduceMotion]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));

  return (
    <View pointerEvents="none" className="absolute bottom-full left-0 right-0 mb-sm items-center">
      <Animated.View className="items-center" style={style}>
        <View className="rounded-pill bg-brand-cta px-sm py-xs">
          <Text className="text-xs !text-white">최근 사용</Text>
        </View>
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: TAIL_HALF_WIDTH,
            borderRightWidth: TAIL_HALF_WIDTH,
            borderTopWidth: TAIL_HALF_WIDTH,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopColor: colors.brand.cta,
          }}
        />
      </Animated.View>
    </View>
  );
}
