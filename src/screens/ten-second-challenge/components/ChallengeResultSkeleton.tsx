import { View } from "react-native";
import Animated from "react-native-reanimated";

import { SkeletonBlock } from "@/components/ui/Skeleton";
import { useSkeletonPulseStyle } from "@/components/ui/use-skeleton-pulse";
import { shadows } from "@/theme";

function CardSkeleton({ lineClassName }: { lineClassName: string }) {
  return (
    <View className="rounded-3xl bg-surface p-5" style={shadows.card}>
      <SkeletonBlock className="h-4 w-20" />
      <SkeletonBlock className="mt-3 h-6 w-full" />
      <SkeletonBlock className={`mt-2 h-6 ${lineClassName}`} />
    </View>
  );
}

/**
 * 결과를 불러오는 동안의 자리.
 *
 * 제출 직후 진입에는 참고 답안이 초기 결과로 이미 있어서 이 화면을 거치지 않는다.
 * 스테이지에서 지난 문장을 열 때만 잠깐 보이며, 그때도 카드 세 장의 자리를 미리 잡아
 * 도착 후 화면이 튀지 않게 한다.
 */
export function ChallengeResultSkeleton() {
  const pulseStyle = useSkeletonPulseStyle();

  return (
    <Animated.View
      accessible
      accessibilityLabel="결과를 불러오는 중"
      accessibilityRole="progressbar"
      className="flex-1 gap-4 px-5 pb-4 pt-4"
      style={pulseStyle}
    >
      <View className="items-center gap-2">
        <SkeletonBlock className="h-32 w-32 rounded-3xl" />
        <SkeletonBlock className="h-7 w-44" />
        <SkeletonBlock className="h-4 w-56" />
      </View>

      <CardSkeleton lineClassName="w-3/5" />
      <CardSkeleton lineClassName="w-4/5" />
    </Animated.View>
  );
}
