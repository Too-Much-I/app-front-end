import { View } from "react-native";
import Animated from "react-native-reanimated";

import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { useSkeletonPulseStyle } from "@/components/ui/use-skeleton-pulse-style";

/**
 * 진행도를 불러오는 동안의 자리.
 *
 * 제목·진행 카드·밭의 자리를 미리 잡아두면 도착 순간에 채워지는 것으로 보인다.
 * 밭은 세로로 긴 한 덩어리라 당근 자리까지 흉내 내지 않는다 — 도착하면 그림 한 장이
 * 한꺼번에 들어오므로, 자리표시가 더 자세할수록 바뀌는 폭이 오히려 커진다.
 */
export function ChallengeStageSkeleton() {
  const pulseStyle = useSkeletonPulseStyle();

  return (
    <Animated.View
      accessible
      accessibilityLabel="오늘의 진행도를 불러오는 중"
      accessibilityRole="progressbar"
      className="flex-1 px-5"
      style={pulseStyle}
    >
      <View className="flex-row items-start">
        <View className="flex-1 gap-2 pt-2">
          <SkeletonBlock className="h-8 w-40" />
          <SkeletonBlock className="h-1 w-10 rounded-full" />
          <SkeletonBlock className="mt-4 h-16 w-48 rounded-3xl" />
        </View>
        <SkeletonBlock className="h-36 w-32 rounded-3xl" />
      </View>

      <SkeletonBlock className="mt-2 grow rounded-3xl" />
    </Animated.View>
  );
}
