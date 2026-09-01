import { useState } from "react";
import { Image, View, type LayoutChangeEvent } from "react-native";

import { Text } from "@/components/ui/Text";
import type { ExamHistoryItem } from "@/features/exam/map-exam-history";
import { historyToneColors } from "@/screens/feedback/exam-history-format";
import { colors } from "@/theme";

const CHART_HEIGHT = 112;
const CHART_TOP = 28;
const CHART_BOTTOM = 94;
const CHART_LINE_WIDTH = 3;
const CHART_POINT_SIZE = 12;
/** 점과 날짜 라벨이 겹치지 않는 상한. 이력이 더 쌓여도 최근 이만큼만 그린다. */
const CHART_MAX_POINTS = 5;

const historyTrendBird = require("../../../../public/mascots/headset_bird.png");

function scoreToY(score: number, maxScore: number): number {
  const boundedScore = Math.min(maxScore, Math.max(0, score));
  const ratio = maxScore > 0 ? boundedScore / maxScore : 0;
  return CHART_BOTTOM - ratio * (CHART_BOTTOM - CHART_TOP);
}

/** 기록이 하나뿐이라 아직 추이를 만들 수 없을 때 그래프 자리에 보여주는 안내. */
function SingleExamTrendPrompt() {
  return (
    <View
      accessible
      accessibilityLabel="모의고사를 한 번 더 풀면 점수 변화를 그래프로 확인할 수 있어요"
      className="mt-4 flex-row items-end justify-center gap-3"
    >
      <Image
        accessible={false}
        source={historyTrendBird}
        className="h-24 w-24"
        resizeMode="contain"
      />
      <View className="relative mb-4 min-w-0 flex-1 rounded-2xl border border-sky-line bg-sky-surface px-4 py-3">
        <View className="absolute -left-2 top-1/2 h-4 w-4 rotate-45 border-b border-l border-sky-line bg-sky-surface" />
        <Text className="text-sm leading-6 text-sky-text">
          모의고사를 한 번 더 풀면 점수 변화를 그래프로 확인할 수 있어요!
        </Text>
      </View>
    </View>
  );
}

/**
 * 최근 시험의 총점 추이.
 *
 * 점을 두 개는 찍어야 추이가 되므로, 기록이 하나뿐이면 그래프 대신 안내를 그린다.
 * 이 판단을 호출부에 두면 "이 그래프는 몇 개부터 그려지나"를 호출부가 알아야 한다.
 */
export function ScoreTrendChart({ items }: { items: readonly ExamHistoryItem[] }) {
  const [width, setWidth] = useState(0);

  if (items.length < 2) {
    return <SingleExamTrendPrompt />;
  }

  // 목록은 최신순이다. 최근 몇 개만 골라 시간순으로 뒤집는다.
  const chronologicalItems = [...items].slice(0, CHART_MAX_POINTS).reverse();
  const columnWidth = width > 0 ? width / chronologicalItems.length : 0;
  const points = chronologicalItems.map((item, index) => ({
    item,
    x: columnWidth * (index + 0.5),
    y: scoreToY(item.totalScore, item.maxTotalScore),
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  return (
    <View className="mt-3" onLayout={handleLayout}>
      <View style={{ height: CHART_HEIGHT }}>
        {width > 0 &&
          points.slice(0, -1).map((point, index) => {
            const nextPoint = points[index + 1];
            const deltaX = nextPoint.x - point.x;
            const deltaY = nextPoint.y - point.y;
            const lineLength = Math.hypot(deltaX, deltaY);
            const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

            return (
              <View
                key={`${point.item.examId}-${nextPoint.item.examId}`}
                className="absolute rounded-full"
                style={{
                  backgroundColor: colors.feedback.history.chartLine,
                  height: CHART_LINE_WIDTH,
                  left: (point.x + nextPoint.x) / 2 - lineLength / 2,
                  top: (point.y + nextPoint.y) / 2 - CHART_LINE_WIDTH / 2,
                  transform: [{ rotate: `${angle}deg` }],
                  width: lineLength,
                }}
              />
            );
          })}

        {width > 0 &&
          points.map((point, index) => {
            const isLatest = index === points.length - 1;
            const pointColor = isLatest
              ? colors.brand.DEFAULT
              : historyToneColors[point.item.tone].color;

            return (
              <View key={point.item.examId} pointerEvents="none">
                <Text
                  className="absolute text-center text-sm"
                  style={{
                    color: pointColor,
                    left: point.x - 24,
                    top: point.y - 28,
                    width: 48,
                  }}
                >
                  {point.item.totalScore}
                </Text>
                <View
                  className="absolute rounded-full"
                  style={{
                    backgroundColor: pointColor,
                    height: CHART_POINT_SIZE,
                    left: point.x - CHART_POINT_SIZE / 2,
                    top: point.y - CHART_POINT_SIZE / 2,
                    width: CHART_POINT_SIZE,
                  }}
                />
              </View>
            );
          })}
      </View>

      <View className="flex-row">
        {chronologicalItems.map((item) => (
          <Text key={item.examId} className="flex-1 text-center text-xs text-ink-muted">
            {item.chartDateLabel}
          </Text>
        ))}
      </View>
    </View>
  );
}
