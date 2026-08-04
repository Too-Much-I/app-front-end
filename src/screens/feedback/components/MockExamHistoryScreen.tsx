import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  View,
  type DimensionValue,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Sparkle, type SparkleProps } from "@/components/ui/Sparkle";
import { Text } from "@/components/ui/Text";
import {
  MOCK_EXAM_AVERAGE_TOTAL_SCORE,
  MOCK_EXAM_HISTORY,
  MOCK_EXAM_MAX_TOTAL_SCORE,
  MOCK_REANSWER_PROGRESS,
  MOCK_REANSWER_QUESTIONS,
  type MockExamHistoryItem,
  type MockExamHistoryTone,
  type MockReanswerQuestionItem,
} from "@/screens/feedback/mocks/mock-exam-history";
import { colors, shadows } from "@/theme";

const CHART_HEIGHT = 112;
const CHART_TOP = 28;
const CHART_BOTTOM = 94;
const CHART_LINE_WIDTH = 3;
const CHART_POINT_SIZE = 12;
/** 재답변 카드의 달성 게이지 두께. */
const GAUGE_HEIGHT = 14;
const TAB_TRANSITION_DURATION_MS = 220;
/** 패널이 밀려 들어오는 거리. 화면 폭만큼 밀면 스크롤 화면에서 과하게 흔들린다. */
const PANEL_SLIDE_DISTANCE = 28;
const chartIllustration = require("../../../../public/icons/chart.png");

type HistoryTab = "reanswers" | "exams";

/** 탭 순서가 곧 슬라이드 방향의 기준이다. */
const HISTORY_TABS: readonly { key: HistoryTab; label: string }[] = [
  { key: "reanswers", label: "다시 답변한 문제" },
  { key: "exams", label: "모의고사 기록" },
];

function tabIndexOf(tab: HistoryTab): number {
  return HISTORY_TABS.findIndex((item) => item.key === tab);
}

/**
 * 재답변 요약 배너에 흩뿌리는 반짝임.
 *
 * 왼쪽 텍스트 블록을 피해 위쪽 여백 띠와 오른쪽 일러스트 주변에만 둔다.
 * 배너가 `overflow-hidden`이라 카드 밖으로 나가는 좌표는 잘린다.
 */
const REANSWER_SUMMARY_SPARKLES: SparkleProps[] = [
  { className: "left-4 top-1", size: "sm", colorClassName: "text-sky-400" },
  { className: "right-[108px] top-2", size: "base", colorClassName: "text-yellow-300" },
  { className: "right-3 top-1", size: "sm", colorClassName: "text-brand-300" },
  { className: "right-[96px] top-[74px]", size: "sm", colorClassName: "text-sky-300" },
  { className: "right-2 top-[84px]", size: "base", colorClassName: "text-yellow-400" },
];

type MockExamHistoryScreenProps = {
  onOpenExam: (examId: string) => void;
};

const badgeColors: Record<MockExamHistoryTone, { backgroundColor: string; color: string }> = {
  green: {
    backgroundColor: colors.feedback.history.greenSoft,
    color: colors.feedback.history.green,
  },
  blue: {
    backgroundColor: colors.feedback.history.blueSoft,
    color: colors.feedback.history.blue,
  },
  purple: {
    backgroundColor: colors.feedback.history.purpleSoft,
    color: colors.feedback.history.purple,
  },
  orange: {
    backgroundColor: colors.feedback.history.orangeSoft,
    color: colors.feedback.history.orange,
  },
};

function scoreToY(score: number, maxScore: number): number {
  const boundedScore = Math.min(maxScore, Math.max(0, score));
  const ratio = maxScore > 0 ? boundedScore / maxScore : 0;
  return CHART_BOTTOM - ratio * (CHART_BOTTOM - CHART_TOP);
}

function ScoreTrendChart({ items }: { items: readonly MockExamHistoryItem[] }) {
  const [width, setWidth] = useState(0);
  const chronologicalItems = [...items].reverse();
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
              : badgeColors[point.item.tone].color;

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

function ExamHistoryCard({
  item,
  onPress,
}: {
  item: MockExamHistoryItem;
  onPress: () => void;
}) {
  const badgeColor = badgeColors[item.tone];
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
          {item.level}
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

function HistoryTabs({
  selectedTab,
  onSelect,
}: {
  selectedTab: HistoryTab;
  onSelect: (tab: HistoryTab) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const tabWidth = trackWidth / HISTORY_TABS.length;
  const indicatorOffset = useSharedValue(0);

  useEffect(() => {
    const nextOffset = tabWidth * tabIndexOf(selectedTab);
    // 폭을 재기 전에는 애니메이션 없이 자리만 잡는다.
    indicatorOffset.value =
      reduceMotion || tabWidth === 0
        ? nextOffset
        : withTiming(nextOffset, {
            duration: TAB_TRANSITION_DURATION_MS,
            easing: Easing.out(Easing.cubic),
          });
  }, [indicatorOffset, reduceMotion, selectedTab, tabWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorOffset.value }],
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  return (
    <View accessibilityRole="tablist" className="rounded-2xl bg-surface-muted p-1">
      <View className="flex-row" onLayout={handleLayout}>
        {tabWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            className="absolute bottom-0 left-0 top-0 rounded-xl border border-brand bg-surface"
            style={[{ width: tabWidth }, indicatorStyle]}
          />
        )}

        {HISTORY_TABS.map((tab) => {
          const isSelected = tab.key === selectedTab;

          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              className="flex-1 items-center rounded-xl py-3"
              onPress={() => onSelect(tab.key)}
            >
              <Text
                className={`text-base ${isSelected ? "text-brand-text" : "text-ink-muted"}`}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function formatCompletedDate(completedAt: string): string {
  const date = new Date(completedAt);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function gaugeWidth(score: number, maxScore: number): DimensionValue {
  const ratio = maxScore <= 0 ? 0 : Math.min(1, Math.max(0, score / maxScore));
  return `${ratio * 100}%`;
}

function GaugeLegendDot({ color }: { color: string }) {
  return (
    <View className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
  );
}

function ReanswerQuestionCard({ item }: { item: MockReanswerQuestionItem }) {
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

function ReanswerHistoryPanel() {
  const delta = MOCK_REANSWER_PROGRESS.averageDeltaPercentagePoints;
  const formattedDelta = `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%p`;

  return (
    <>
      {/*
        요약 배너는 홈의 10초 챌린지 배너와 같은 하늘색 표면 + 반짝임을 쓰고,
        브랜드 주황은 아래 문제 카드가 맡는다.
      */}
      <View
        accessible
        accessibilityLabel={`최초 답변 대비 평균 달성률 ${formattedDelta}, ${MOCK_REANSWER_PROGRESS.comparableQuestionCount}문제 중 ${MOCK_REANSWER_PROGRESS.improvedQuestionCount}문제 향상`}
        className="relative mt-5 overflow-hidden rounded-3xl border border-sky-line bg-sky-surface p-5"
        style={shadows.card}
      >
        <View className="flex-row items-center gap-3">
          <View className="min-w-0 flex-1">
            <Text className="text-lg">다시 답하며 성장했어요</Text>
            <Text className="mt-2 text-sm leading-6 text-sky-text">
              최초 답변과 최신 완료 답변의 달성률을 비교했어요.
            </Text>
          </View>
          <Image
            accessible={false}
            source={chartIllustration}
            className="h-24 w-24"
            resizeMode="contain"
          />
        </View>

        {/* 색 배경 위에서는 흰 타일이 수치를 또렷하게 띄운다(챌린지 배너의 '시작하기' 알약과 같다). */}
        <View className="mt-4 flex-row gap-3">
          <View className="flex-1 rounded-2xl bg-surface p-4">
            <Text className="text-xs text-ink-muted">평균 달성률 변화</Text>
            <Text className="mt-1 text-2xl text-sky-text">{formattedDelta}</Text>
          </View>
          <View className="flex-1 rounded-2xl bg-surface p-4">
            <Text className="text-xs text-ink-muted">향상한 문제</Text>
            <Text className="mt-1 text-2xl text-brand-text">
              {MOCK_REANSWER_PROGRESS.improvedQuestionCount}/
              {MOCK_REANSWER_PROGRESS.comparableQuestionCount}
            </Text>
          </View>
        </View>

        {/* 반짝임은 본문보다 나중에 그려야 겹치는 자리에서도 가려지지 않는다. */}
        {REANSWER_SUMMARY_SPARKLES.map((sparkle) => (
          <Sparkle key={sparkle.className} {...sparkle} />
        ))}
      </View>

      <View className="mt-5">
        <Text className="text-lg">답변 기록</Text>
        <View className="mt-3 gap-3">
          {MOCK_REANSWER_QUESTIONS.map((item) => (
            <ReanswerQuestionCard
              key={`${item.examId}-${item.questionNumber}`}
              item={item}
            />
          ))}
        </View>
      </View>
    </>
  );
}

function ExamHistoryPanel({ onOpenExam }: MockExamHistoryScreenProps) {
  return (
    <>
      <View
        className="mt-5 rounded-3xl border border-line bg-surface p-5"
        style={shadows.card}
      >
        <Text className="text-lg">전체 평균 총점</Text>
        <View className="mt-1 flex-row items-end">
          <Text className="text-3xl text-brand-text">
            {MOCK_EXAM_AVERAGE_TOTAL_SCORE.toFixed(1)}
          </Text>
          <Text className="mb-1 ml-1 text-lg text-brand-text">
            /{MOCK_EXAM_MAX_TOTAL_SCORE}
          </Text>
        </View>
        <ScoreTrendChart items={MOCK_EXAM_HISTORY} />
      </View>

      <View className="mt-4 gap-3">
        {MOCK_EXAM_HISTORY.map((item) => (
          <ExamHistoryCard
            key={item.examId}
            item={item}
            onPress={() => onOpenExam(item.examId)}
          />
        ))}
      </View>
    </>
  );
}

export function MockExamHistoryScreen({ onOpenExam }: MockExamHistoryScreenProps) {
  const [selectedTab, setSelectedTab] = useState<HistoryTab>("exams");
  const reduceMotion = useReducedMotion();
  const panelOffset = useSharedValue(0);
  const panelOpacity = useSharedValue(1);

  const handleSelectTab = useCallback(
    (tab: HistoryTab) => {
      if (tab === selectedTab) return;
      setSelectedTab(tab);
      if (reduceMotion) return;

      // 새 패널은 누른 탭이 있는 쪽에서 밀려 들어온다.
      const direction = tabIndexOf(tab) > tabIndexOf(selectedTab) ? 1 : -1;
      panelOffset.value = direction * PANEL_SLIDE_DISTANCE;
      panelOffset.value = withTiming(0, {
        duration: TAB_TRANSITION_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      });
      panelOpacity.value = 0;
      panelOpacity.value = withTiming(1, { duration: TAB_TRANSITION_DURATION_MS });
    },
    [panelOffset, panelOpacity, reduceMotion, selectedTab],
  );

  const panelStyle = useAnimatedStyle(() => ({
    opacity: panelOpacity.value,
    transform: [{ translateX: panelOffset.value }],
  }));

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface-subtle">
      <ScrollView
        className="flex-1"
        contentContainerClassName="mx-auto w-full max-w-3xl px-5 pb-8 pt-4"
        showsVerticalScrollIndicator={false}
      >
        <HistoryTabs selectedTab={selectedTab} onSelect={handleSelectTab} />
        <Animated.View style={panelStyle}>
          {selectedTab === "exams" ? (
            <ExamHistoryPanel onOpenExam={onOpenExam} />
          ) : (
            <ReanswerHistoryPanel />
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
