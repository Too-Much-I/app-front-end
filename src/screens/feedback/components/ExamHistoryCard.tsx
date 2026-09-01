import { Feather } from "@expo/vector-icons";
import { View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import type { ExamHistoryItem } from "@/features/exam/map-exam-history";
import {
  formatCompletedDate,
  historyToneColors,
} from "@/screens/feedback/exam-history-format";
import { colors, shadows } from "@/theme";

export function ExamHistoryCard({
  item,
  onPress,
}: {
  item: ExamHistoryItem;
  onPress: () => void;
}) {
  const badgeColor = historyToneColors[item.tone];
  // NM/NL처럼 한 등급에 코드가 둘인 경우 원 안에는 대표 코드 하나만 표시한다.
  // 접근성 라벨에는 아래에서 원래 등급명을 그대로 읽어 정보 손실을 피한다.
  const badgeLevel = item.level.split("/", 1)[0]?.trim() || item.level;
  const completedDate = formatCompletedDate(item.completedAt);
  const subtitle =
    item.retriedQuestionCount > 0
      ? `${completedDate} · 다시 답변 ${item.retriedQuestionCount}문제`
      : completedDate;

  return (
    <Pressable
      accessibilityLabel={`${item.title}, ${item.level}, 총점 ${item.maxTotalScore}점 만점에 ${item.totalScore}점, ${subtitle}`}
      accessibilityHint="이 모의고사의 피드백을 엽니다"
      className="flex-row items-center rounded-3xl border border-line bg-surface p-4"
      style={shadows.card}
      onPress={onPress}
    >
      <View
        className="h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: badgeColor.backgroundColor }}
      >
        <Text className="text-lg" style={{ color: badgeColor.color }}>
          {badgeLevel}
        </Text>
      </View>

      <View className="ml-4 min-w-0 flex-1">
        <Text className="text-lg" numberOfLines={1}>
          {item.title}
        </Text>
        <Text className="mt-1 text-sm text-ink-muted">{subtitle}</Text>
      </View>

      {/* 파트 평균(5점 척도)은 상단 추이 카드가 맡고, 목록에서는 시험 총점만 크게 읽힌다. */}
      <View className="ml-2 items-end">
        <Text className="text-2xl text-brand-text">{item.totalScore}</Text>
        <Text className="text-xs text-ink-muted">/{item.maxTotalScore}점</Text>
      </View>
      <Feather name="chevron-right" size={22} color={colors.ink.disabled} />
    </Pressable>
  );
}
