import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Image, View, type LayoutChangeEvent } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Sparkle, type SparkleProps } from "@/components/ui/Sparkle";
import { Text } from "@/components/ui/Text";
import type { ExamHistoryItem } from "@/features/exam/map-exam-history";
import type { RecentFeedbackState } from "@/screens/home/use-recent-feedback";
import { colors, shadows } from "@/theme";

const feedbackMascot = require("../../../public/mascots/paper_rabbit.png");
/** paper_rabbit.png를 내용 기준으로 타이트 크롭한 실제 가로/세로 비율. */
const FEEDBACK_MASCOT_ASPECT_RATIO = 1329 / 1918;
const FEEDBACK_MASCOT_MAX_HEIGHT = 136;

/** 피드백 카드 마스코트 주변의 반짝임. 카드 강조용으로 노란 계열을 쓴다. */
const FEEDBACK_SPARKLES: SparkleProps[] = [
  { className: "-top-2 left-2", colorClassName: "text-yellow-400" },
  { className: "-right-3 top-8", size: "base", colorClassName: "text-yellow-300" },
  { className: "-bottom-2 left-6", colorClassName: "text-yellow-400" },
];

function completedDateLabel(completedAt: string): string {
  const date = new Date(completedAt);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}.${month}.${day}`;
}

function FeedbackMascot({ height }: { height: number }) {
  if (height <= 0) return null;
  const boundedHeight = Math.min(height, FEEDBACK_MASCOT_MAX_HEIGHT);

  return (
    <View className="relative">
      <Image
        source={feedbackMascot}
        style={{
          height: boundedHeight,
          width: boundedHeight * FEEDBACK_MASCOT_ASPECT_RATIO,
        }}
        resizeMode="contain"
      />
      {FEEDBACK_SPARKLES.map((sparkle) => (
        <Sparkle key={sparkle.className} {...sparkle} />
      ))}
    </View>
  );
}

function ReadyFeedbackCard({
  item,
  onOpenFeedback,
}: {
  item: ExamHistoryItem;
  onOpenFeedback: (examId: string) => void;
}) {
  const [textHeight, setTextHeight] = useState(0);
  const title = item.title.trim() || "토선생 모의고사";

  return (
    <Pressable
      accessibilityHint="이 모의고사의 피드백을 엽니다"
      accessibilityLabel={`${title}, ${item.level}, 총점 ${item.maxTotalScore}점 만점에 ${item.totalScore}점`}
      className="mt-3 flex-row items-center justify-between rounded-3xl bg-surface p-5"
      style={shadows.card}
      onPress={() => onOpenFeedback(item.examId)}
    >
      <View
        className="flex-1 pr-3"
        onLayout={(event: LayoutChangeEvent) => setTextHeight(event.nativeEvent.layout.height)}
      >
        <Text className="text-xl" numberOfLines={2}>
          {title}
        </Text>
        <Text className="mt-1 text-sm text-ink-muted">예상 등급 {item.level}</Text>
        <View className="mt-2 flex-row items-end gap-1">
          <Text className="text-2xl text-brand-text">{item.totalScore}</Text>
          <Text className="pb-0.5 text-sm text-ink-muted">/{item.maxTotalScore}점</Text>
        </View>
        <Text className="mt-3 text-xs text-ink-disabled">
          {completedDateLabel(item.completedAt)}
        </Text>
      </View>
      <FeedbackMascot height={textHeight} />
    </Pressable>
  );
}

function EmptyFeedbackCard() {
  const [textHeight, setTextHeight] = useState(0);

  return (
    <View
      accessible
      accessibilityLabel="아직 완료한 모의고사가 없습니다. 모의고사를 완료하면 맞춤 피드백을 확인할 수 있습니다."
      className="mt-3 flex-row items-center justify-between rounded-3xl bg-surface p-5"
      style={shadows.card}
    >
      <View
        className="min-w-0 flex-1 pr-3"
        onLayout={(event: LayoutChangeEvent) => setTextHeight(event.nativeEvent.layout.height)}
      >
        <Text className="text-xl">아직 완료한 모의고사가 없어요</Text>
        <Text className="mt-2 text-sm leading-6 text-ink-muted">
          모의고사를 완료하면 이곳에서 맞춤 피드백을 확인할 수 있어요.
        </Text>
      </View>
      <FeedbackMascot height={textHeight} />
    </View>
  );
}

function LoadingFeedbackCard() {
  return (
    <View
      accessibilityLabel="최근 피드백을 불러오는 중입니다"
      accessibilityLiveRegion="polite"
      className="mt-3 min-h-40 items-center justify-center rounded-3xl bg-surface p-5"
      style={shadows.card}
    >
      <ActivityIndicator color={colors.brand.DEFAULT} />
      <Text className="mt-3 text-sm text-ink-muted">최근 기록을 확인하는 중이에요.</Text>
    </View>
  );
}

function ErrorFeedbackCard({ onRetry }: { onRetry: () => void }) {
  return (
    <Pressable
      accessibilityHint="최근 피드백을 다시 불러옵니다"
      accessibilityLabel="최근 피드백을 불러오지 못했습니다. 다시 시도"
      className="mt-3 min-h-40 items-center justify-center rounded-3xl bg-surface p-5"
      style={shadows.card}
      onPress={onRetry}
    >
      <Feather name="refresh-cw" size={22} color={colors.ink.muted} />
      <Text className="mt-3 text-center text-base">최근 피드백을 불러오지 못했어요</Text>
      <Text className="mt-1 text-center text-sm text-ink-muted">눌러서 다시 시도해 주세요.</Text>
    </Pressable>
  );
}

export function RecentFeedbackCard({
  state,
  onOpenFeedback,
  onRetry,
}: {
  state: RecentFeedbackState;
  onOpenFeedback: (examId: string) => void;
  onRetry: () => void;
}) {
  if (state.status === "loading") return <LoadingFeedbackCard />;
  if (state.status === "error") return <ErrorFeedbackCard onRetry={onRetry} />;
  if (!state.item) return <EmptyFeedbackCard />;

  return <ReadyFeedbackCard item={state.item} onOpenFeedback={onOpenFeedback} />;
}
