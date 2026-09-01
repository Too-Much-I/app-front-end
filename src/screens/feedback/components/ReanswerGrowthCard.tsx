import { View, type DimensionValue } from "react-native";

import { Text } from "@/components/ui/Text";
import type { ReanswerQuestionItem } from "@/features/exam/map-exam-retries";
import { formatCompletedDate } from "@/screens/feedback/exam-history-format";
import { colors, shadows } from "@/theme";

/** 달성 게이지 두께. */
const GAUGE_HEIGHT = 14;

function gaugeWidth(score: number, maxScore: number): DimensionValue {
  const ratio = maxScore <= 0 ? 0 : Math.min(1, Math.max(0, score / maxScore));
  return `${ratio * 100}%`;
}

function GaugeLegendDot({ color }: { color: string }) {
  return (
    <View className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
  );
}

/**
 * 한 문제의 최초 답변 대비 최신 답변 성장을 게이지로 보여준다.
 *
 * 재답변 화면의 `ReanswerQuestionCard`(녹음·제출 UI)와는 다른 것을 그린다 — 이쪽은
 * 이미 끝난 답변들의 점수 비교만 맡는다.
 */
export function ReanswerGrowthCard({ item }: { item: ReanswerQuestionItem }) {
  const delta = item.latestScore - item.initialScore;
  const hasGrown = delta > 0;
  const initialWidth = gaugeWidth(item.initialScore, item.maxScore);
  const latestWidth = gaugeWidth(item.latestScore, item.maxScore);

  return (
    <View
      accessible
      accessibilityLabel={`파트 ${item.partNumber} ${item.questionNumber}번 문제, 만점 ${item.maxScore}점, 최초 ${item.initialScore}점에서 최신 ${item.latestScore}점`}
      className="rounded-3xl border border-line bg-surface p-5"
      style={shadows.card}
    >
      <View className="flex-row items-center gap-2">
        <View className="rounded-full bg-brand-100 px-3 py-1">
          <Text className="text-xs text-brand-text">Part {item.partNumber}</Text>
        </View>
        <Text className="min-w-0 flex-1 text-lg" numberOfLines={1}>
          {item.questionNumber}번 문제
        </Text>
        <View
          className={`rounded-full px-3 py-1 ${hasGrown ? "bg-brand-100" : "bg-surface-muted"}`}
        >
          <Text className={`text-sm ${hasGrown ? "text-brand-text" : "text-ink-muted"}`}>
            {hasGrown ? "+" : ""}
            {delta.toFixed(1)}점
          </Text>
        </View>
      </View>

      <Text className="mt-2 text-sm text-ink-muted">
        {formatCompletedDate(item.completedAt)} · {item.retryCount + 1}차 답변
      </Text>

      {/*
        옅은 주황이 최초 달성분, 그 뒤로 이어지는 진한 브랜드 주황이 다시 답변으로
        늘어난 만큼이다. 같은 색조의 명도 차로만 구분해 화면의 톤을 브랜드에 맞춘다.

        점수가 오르지 않았다면 성장분 막대를 아예 그리지 않고 최신 점수만큼만 채운다.
        위에 덮이는 최초 막대가 더 넓어 실제 최신 점수보다 많이 찬 것처럼 보이면
        배지의 숫자와 달리 게이지만 성과를 부풀리게 된다.
      */}
      <View
        className="mt-4 rounded-full bg-brand-100"
        style={{ height: GAUGE_HEIGHT }}
      >
        {hasGrown && (
          <View
            className="absolute bottom-0 left-0 top-0 rounded-full"
            style={{ backgroundColor: colors.brand.DEFAULT, width: latestWidth }}
          />
        )}
        <View
          className="absolute bottom-0 left-0 top-0 rounded-full"
          style={{
            backgroundColor: colors.brand[300],
            width: hasGrown ? initialWidth : latestWidth,
          }}
        />
      </View>

      <View className="mt-3 flex-row items-end justify-between gap-3">
        <View>
          <View className="flex-row items-center gap-1.5">
            <GaugeLegendDot color={colors.brand[300]} />
            <Text className="text-xs text-ink-muted">최초 답변</Text>
          </View>
          <Text className="mt-1 text-base text-ink-muted">
            {item.initialScore.toFixed(1)}점
          </Text>
        </View>

        <View className="items-end">
          <View className="flex-row items-center gap-1.5">
            <GaugeLegendDot color={colors.brand.DEFAULT} />
            <Text className="text-xs text-ink-muted">최신 답변</Text>
          </View>
          <View className="mt-1 flex-row items-end">
            <Text className="text-xl text-brand-text">
              {item.latestScore.toFixed(1)}
            </Text>
            <Text className="mb-0.5 ml-1 text-xs text-ink-muted">
              /{item.maxScore}점
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
