import { View } from "react-native";
import Animated from "react-native-reanimated";

import { SkeletonBlock } from "@/components/ui/Skeleton";
import { useSkeletonPulseStyle } from "@/components/ui/use-skeleton-pulse";
import { shadows } from "@/theme";

/**
 * 문제를 불러오는 동안의 노트 자리.
 *
 * 스피너 대신 쓰는 이유는 조회가 몇 초면 끝나서다 — 그 사이 화면 한가운데 뱅뱅 도는
 * 원을 띄우면 "무언가 오래 걸린다"는 신호가 되고, 도착한 뒤 레이아웃이 통째로 바뀐다.
 * 제목·진행 점·타이머 배지·노트의 자리를 미리 잡아두면 문장만 채워지는 것으로 보인다.
 */
export function ChallengeNoteSkeleton() {
  const pulseStyle = useSkeletonPulseStyle();

  return (
    <Animated.View
      accessible
      accessibilityLabel="오늘의 문장을 불러오는 중"
      accessibilityRole="progressbar"
      className="flex-1 gap-5 px-5 pb-4 pt-4"
      style={pulseStyle}
    >
      <View className="items-center gap-3">
        <SkeletonBlock className="h-8 w-40" />
        <View className="flex-row gap-1.5">
          <SkeletonBlock className="h-2 w-2" />
          <SkeletonBlock className="h-2 w-2" />
          <SkeletonBlock className="h-2 w-2" />
        </View>
        <SkeletonBlock className="h-8 w-24 rounded-full" />
      </View>

      <View className="rounded-3xl bg-challenge-mat p-3" style={shadows.card}>
        <View className="rounded-2xl bg-surface py-5 pl-9 pr-5">
          <View className="items-center gap-4">
            <SkeletonBlock className="h-6 w-24 rounded-lg" />
            <SkeletonBlock className="h-6 w-4/5" />
            <SkeletonBlock className="h-6 w-3/5" />
            <SkeletonBlock className="h-px w-full" />
            <SkeletonBlock className="h-4 w-32 self-end" />
            <SkeletonBlock className="h-20 w-full rounded-2xl" />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}
