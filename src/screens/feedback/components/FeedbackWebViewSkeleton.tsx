import { View } from "react-native";
import Animated from "react-native-reanimated";

import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { useSkeletonPulseStyle } from "@/components/ui/use-skeleton-pulse-style";
import { colors, shadows } from "@/theme";

function InsightSkeleton() {
  return (
    <View className="min-w-36 flex-1 rounded-3xl border border-line bg-surface p-4" style={shadows.card}>
      <View className="flex-row items-center gap-2">
        <SkeletonBlock className="h-9 w-9" />
        <SkeletonBlock className="h-5 w-20" />
      </View>
      <View className="mt-4 gap-3">
        <SkeletonBlock className="h-4 w-full" />
        <SkeletonBlock className="h-4 w-4/5" />
      </View>
    </View>
  );
}

function PartCardSkeleton() {
  return (
    <View className="rounded-3xl border border-line bg-surface p-4" style={shadows.card}>
      <View className="flex-row gap-3">
        <SkeletonBlock className="h-16 w-16" />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center justify-between gap-3">
            <View className="gap-2">
              <SkeletonBlock className="h-5 w-16" />
              <SkeletonBlock className="h-4 w-28" />
            </View>
            <SkeletonBlock className="h-8 w-20" />
          </View>
          <View className="mt-4 gap-2">
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-3/4" />
          </View>
        </View>
      </View>
      <SkeletonBlock className="mt-5 h-11 w-full rounded-2xl" />
    </View>
  );
}

export function FeedbackWebViewSkeleton() {
  const pulseStyle = useSkeletonPulseStyle();

  return (
    <View
      accessible
      accessibilityLabel="피드백을 불러오는 중"
      accessibilityRole="progressbar"
      className="absolute inset-0 bg-surface-subtle"
    >
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="mx-auto w-full max-w-3xl px-5 pb-14"
        style={pulseStyle}
      >
        <View className="pb-5 pt-3">
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="mt-3 h-9 w-52" />
          <SkeletonBlock className="mt-3 h-4 w-72 max-w-full" />
        </View>

        <View className="rounded-3xl p-2" style={{ backgroundColor: colors.feedback.wood }}>
          <View
            className="rounded-2xl border-2 p-5"
            style={{
              borderColor: colors.feedback.woodLight,
              backgroundColor: colors.feedback.scoreSurface,
            }}
          >
            <View className="h-5 w-24 rounded-full bg-white/20" />
            <View className="mt-5 flex-row items-start justify-between gap-4">
              <View className="flex-1 gap-3">
                <View className="h-10 w-32 rounded-full bg-white/20" />
                <View className="h-4 w-24 rounded-full bg-white/20" />
              </View>
              <View className="h-20 w-20 rounded-2xl bg-white/15" />
            </View>
            <View className="mt-5 h-3 w-full rounded-full bg-white/15" />
            <View className="mt-5 flex-row items-end gap-3">
              <View className="flex-1 gap-2">
                <View className="h-4 w-full rounded-full bg-white/15" />
                <View className="h-4 w-4/5 rounded-full bg-white/15" />
              </View>
              <View className="h-24 w-16 rounded-2xl bg-white/15" />
            </View>
          </View>
        </View>

        <View className="mt-8">
          <SkeletonBlock className="mb-4 h-6 w-32" />
          <View className="flex-row flex-wrap gap-3">
            <InsightSkeleton />
            <InsightSkeleton />
          </View>
        </View>

        <View className="mt-8">
          <SkeletonBlock className="mb-4 h-6 w-36" />
          <View className="rounded-3xl border border-line bg-surface p-5" style={shadows.card}>
            <View className="gap-3">
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-4 w-2/3" />
            </View>
            <SkeletonBlock className="ml-auto mt-5 h-28 w-20 rounded-2xl" />
          </View>
        </View>

        <View className="mt-10">
          <SkeletonBlock className="h-7 w-40" />
          <SkeletonBlock className="mt-3 h-4 w-64 max-w-full" />
          <View className="mt-5 gap-4">
            <PartCardSkeleton />
            <PartCardSkeleton />
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}
