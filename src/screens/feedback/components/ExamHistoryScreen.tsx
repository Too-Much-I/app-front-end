import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { StartMockExamButton } from "@/components/ui/StartMockExamButton";
import { Text } from "@/components/ui/Text";
import { getExamHistory } from "@/features/exam/api/exam-history";
import {
  EXAM_TOTAL_MAX_SCORE,
  ExamHistoryContractError,
  averageTotalScore,
  type ExamHistoryItem,
  type ExamHistoryTone,
} from "@/features/exam/map-exam-history";
import { getExamRetries } from "@/features/exam/api/exam-retries";
import {
  ExamRetriesContractError,
  summarizeReanswerProgress,
  type ReanswerQuestionItem,
} from "@/features/exam/map-exam-retries";
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
const greetingCat = require("../../../../public/mascots/greeting_cat.png");
const graduateTurtle = require("../../../../public/mascots/graduate_turtle.png");
const historyTrendBird = require("../../../../public/mascots/headset_bird.png");

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

/** 빈 이력의 고양이 주변에 홈 인사 영역과 같은 색 조합으로 흩뿌리는 반짝임. */
const EMPTY_HISTORY_SPARKLES: SparkleProps[] = [
  { className: "left-[7%] top-4", size: "2xl", colorClassName: "text-sky-300" },
  { className: "right-[9%] top-2", size: "xl", colorClassName: "text-brand-300" },
  { className: "left-[14%] top-[118px]", size: "lg", colorClassName: "text-yellow-400" },
  { className: "right-[10%] top-[132px]", size: "2xl", colorClassName: "text-sky-400" },
  { className: "left-[24%] top-[66px]", size: "sm", colorClassName: "text-brand-200" },
  { className: "right-[23%] top-[76px]", size: "base", colorClassName: "text-yellow-300" },
];

type ExamHistoryScreenProps = {
  onOpenExam: (examId: string) => void;
  onStartExam: () => void;
};

const badgeColors: Record<ExamHistoryTone, { backgroundColor: string; color: string }> = {
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

function ScoreTrendChart({ items }: { items: readonly ExamHistoryItem[] }) {
  const [width, setWidth] = useState(0);
  // 목록은 최신순이다. 최근 5개만 골라 시간순으로 뒤집는다 —
  // 이력이 쌓이면 점과 날짜 라벨이 겹쳐 읽을 수 없다.
  const chronologicalItems = [...items].slice(0, 5).reverse();
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
  item: ExamHistoryItem;
  onPress: () => void;
}) {
  const badgeColor = badgeColors[item.tone];
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

function ReanswerQuestionCard({ item }: { item: ReanswerQuestionItem }) {
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

/**
 * 조회 실패는 두 종류다.
 *
 * `retryable`은 네트워크·타임아웃·서버 오류처럼 나중에 풀릴 수 있는 실패다.
 * 계약 오류(서버 응답 형태와 앱의 기대가 어긋남)는 재시도해도 절대 안 풀리므로
 * 재시도 버튼을 주지 않는다 — 주면 사용자를 무의미한 반복으로 유도한다.
 */
type FailureKind = { retryable: boolean };

type ExamHistoryState =
  | { status: "loading" }
  | ({ status: "error" } & FailureKind)
  | { status: "ready"; items: readonly ExamHistoryItem[] };

type ReanswerState =
  | { status: "loading" }
  | ({ status: "error" } & FailureKind)
  | { status: "ready"; items: readonly ReanswerQuestionItem[] };

function isRetryableFailure(error: unknown): boolean {
  return !(
    error instanceof ExamHistoryContractError ||
    error instanceof ExamRetriesContractError
  );
}

/** 재시도해도 풀리지 않는 실패에 쓰는 안내. 앱과 서버 중 한쪽이 바뀌어야 한다. */
const CONTRACT_ERROR_DESCRIPTION =
  "앱을 최신 버전으로 업데이트하면 해결될 수 있어요.";

function PanelLoading() {
  return (
    <View className="mt-16 items-center">
      <ActivityIndicator color={colors.brand.DEFAULT} size="large" />
    </View>
  );
}

/** 두 탭이 공유하는 안내 화면. onRetry가 없으면 빈 상태, 있으면 오류 상태다. */
function PanelNotice({
  title,
  description,
  actionLabel,
  onAction,
  actionHint,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHint?: string;
}) {
  return (
    <View className="mt-16 items-center px-6">
      <Text accessibilityRole="header" className="text-center text-lg">
        {title}
      </Text>
      <Text className="mt-2 text-center text-sm leading-6 text-ink-muted">
        {description}
      </Text>
      {actionLabel && onAction && (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityHint={actionHint}
          className="mt-5 rounded-full bg-brand px-6 py-3"
          onPress={onAction}
        >
          <Text className="text-base text-white">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** 시험 이력이 비었을 때 고양이 마스코트와 첫 응시 CTA를 함께 보여준다. */
function EmptyExamHistory({ onStartExam }: { onStartExam: () => void }) {
  return (
    <View className="mt-8 items-center rounded-3xl border border-line bg-surface px-5 pb-6 pt-4">
      <View className="relative h-52 w-full max-w-sm overflow-hidden">
        <Image
          accessible={false}
          source={greetingCat}
          style={{
            bottom: 0,
            height: "100%",
            left: "29%",
            position: "absolute",
            width: "42%",
            zIndex: 10,
          }}
          resizeMode="contain"
        />
        {EMPTY_HISTORY_SPARKLES.map((sparkle) => (
          <Sparkle key={sparkle.className} {...sparkle} />
        ))}
      </View>

      <Text accessibilityRole="header" className="mt-3 text-center text-xl">
        첫 모의고사를 시작해 볼까요?
      </Text>
      <Text className="mt-2 text-center text-sm leading-6 text-ink-muted">
        시험을 완료하면 점수 추이와 문제별 피드백이 여기에 쌓여요.
      </Text>
      <StartMockExamButton
        accessibilityHint="모의고사 준비 화면으로 이동합니다"
        className="mt-6 w-full"
        onPress={onStartExam}
      />
    </View>
  );
}

/** 재답변 기록이 비었을 때 터틀 마스코트와 다음 행동을 함께 보여준다. */
function EmptyReanswerHistory({
  feedbackExamId,
  onOpenExam,
  onStartExam,
}: {
  feedbackExamId: string | null;
  onOpenExam: (examId: string) => void;
  onStartExam: () => void;
}) {
  return (
    <View className="mt-8 items-center rounded-3xl border border-line bg-surface px-5 pb-6 pt-4">
      <View className="relative h-52 w-full max-w-sm overflow-hidden">
        <Image
          accessible={false}
          source={graduateTurtle}
          style={{
            bottom: 0,
            height: "100%",
            left: "29%",
            position: "absolute",
            width: "42%",
            zIndex: 10,
          }}
          resizeMode="contain"
        />
        {EMPTY_HISTORY_SPARKLES.map((sparkle) => (
          <Sparkle key={sparkle.className} {...sparkle} />
        ))}
      </View>

      <Text accessibilityRole="header" className="mt-3 text-center text-xl">
        아직 다시 답변한 기록이 없어요
      </Text>
      <Text className="mt-2 text-center text-sm leading-6 text-ink-muted">
        문제별 피드백에서 다시 답변하면 최초 답변과 비교해 볼 수 있어요.
      </Text>
      {/* 재답변할 시험이 있으면 그쪽 피드백으로 보내고, 없을 때만 응시를 권한다. */}
      {feedbackExamId ? (
        <Pressable
          accessibilityLabel="문제별 피드백 보기"
          accessibilityHint="재답변할 수 있는 모의고사의 종합 피드백으로 이동합니다"
          className="mt-6 w-full items-center rounded-2xl bg-brand px-6 py-4"
          onPress={() => onOpenExam(feedbackExamId)}
        >
          <Text className="text-base text-white">문제별 피드백 보기</Text>
        </Pressable>
      ) : (
        <StartMockExamButton
          accessibilityHint="모의고사 준비 화면으로 이동합니다"
          className="mt-6 w-full"
          onPress={onStartExam}
        />
      )}
    </View>
  );
}

/**
 * 재답변 성과 탭.
 *
 * 재답변 조회는 시험 단위라 대상 시험이 필요하다 — 이력에서 재답변이 있는 가장 최근
 * 시험을 고른다(목록은 최신순이다). 사용자 전체 스냅샷 endpoint가 생기면 이 선택은
 * 없어진다.
 */
function ReanswerHistoryPanel({
  enabled,
  history,
  onRetryHistory,
  onOpenExam,
  onStartExam,
}: {
  enabled: boolean;
  history: ExamHistoryState;
  onRetryHistory: () => void;
  onOpenExam: (examId: string) => void;
  onStartExam: () => void;
}) {
  const targetExamId =
    history.status === "ready"
      ? (history.items.find((item) => item.retriedQuestionCount > 0)?.examId ?? null)
      : null;

  const [state, setState] = useState<ReanswerState>({ status: "loading" });
  // 값 자체엔 의미가 없다. 재시도 버튼이 아래 effect를 다시 돌리기 위한 트리거다.
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    // 탭을 처음 열기 전에는 불필요한 요청을 보내지 않는다. 한번 열리면 부모가 enabled를
    // 계속 유지하므로 탭을 왕복해도 이 상태와 조회 결과가 사라지지 않는다.
    if (!enabled) return;

    if (history.status === "loading") {
      setState({ status: "loading" });
      return;
    }
    if (history.status === "error") {
      // 이력을 못 받으면 대상 시험을 못 정한다. 원인 구분은 이력 쪽 판정을 그대로 물려받는다.
      setState({ status: "error", retryable: history.retryable });
      return;
    }
    // 이력은 받았는데 재답변한 시험이 없다 — 조회할 것이 없는 정상 빈 상태다.
    if (!targetExamId) {
      setState({ status: "ready", items: [] });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading" });

    getExamRetries(targetExamId, controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return;
        setState({ status: "ready", items });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("[ReanswerHistory] 재답변 이력 조회 실패", error);
        setState({ status: "error", retryable: isRetryableFailure(error) });
      });

    return () => controller.abort();
  }, [enabled, history, targetExamId, reloadNonce]);

  if (state.status === "loading") {
    return <PanelLoading />;
  }

  if (state.status === "error") {
    return (
      <PanelNotice
        title="재답변 기록을 불러오지 못했어요"
        description={
          state.retryable ? "잠시 후 다시 시도해 주세요." : CONTRACT_ERROR_DESCRIPTION
        }
        actionLabel={state.retryable ? "다시 시도" : undefined}
        onAction={
          state.retryable
            ? () => {
                // 이력 단계에서 실패했다면 그쪽을 다시 받아야 대상 시험이 정해진다.
                if (history.status === "error") {
                  onRetryHistory();
                  return;
                }
                setReloadNonce((nonce) => nonce + 1);
              }
            : undefined
        }
      />
    );
  }

  /**
   * 비교 가능한 문항이 없는 경우가 두 가지다 — 재답변을 아직 안 했거나, 했지만 채점이
   * 끝나지 않았거나. 둘을 구분하려면 회차 상태를 더 봐야 하는데 현재 응답으로는
   * 알 수 없으므로 같은 안내를 쓴다.
   */
  if (state.items.length === 0) {
    const feedbackExamId =
      targetExamId ?? (history.status === "ready" ? history.items[0]?.examId : null);

    return (
      <EmptyReanswerHistory
        feedbackExamId={feedbackExamId}
        onOpenExam={onOpenExam}
        onStartExam={onStartExam}
      />
    );
  }

  const progress = summarizeReanswerProgress(state.items);
  const delta = progress.averageDeltaPercentagePoints;
  const formattedDelta = `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%p`;

  return (
    <>
      {/*
        요약 배너는 홈의 10초 챌린지 배너와 같은 하늘색 표면 + 반짝임을 쓰고,
        브랜드 주황은 아래 문제 카드가 맡는다.
      */}
      <View
        accessible
        accessibilityLabel={`최초 답변 대비 평균 달성률 ${formattedDelta}, ${progress.comparableQuestionCount}문제 중 ${progress.improvedQuestionCount}문제 향상`}
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
              {progress.improvedQuestionCount}/{progress.comparableQuestionCount}
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
          {state.items.map((item) => (
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

function ExamHistoryPanel({
  state,
  onRetry,
  onOpenExam,
  onStartExam,
}: ExamHistoryScreenProps & {
  state: ExamHistoryState;
  onRetry: () => void;
}) {
  if (state.status === "loading") {
    return <PanelLoading />;
  }

  // 조회 실패를 빈 상태로 바꾸지 않는다 — 기록이 정말 없는 경우와 구분해야 한다.
  if (state.status === "error") {
    return (
      <PanelNotice
        title="기록을 불러오지 못했어요"
        description={
          state.retryable ? "잠시 후 다시 시도해 주세요." : CONTRACT_ERROR_DESCRIPTION
        }
        actionLabel={state.retryable ? "다시 시도" : undefined}
        onAction={state.retryable ? onRetry : undefined}
      />
    );
  }

  if (state.items.length === 0) {
    return <EmptyExamHistory onStartExam={onStartExam} />;
  }

  return (
    <>
      <View
        className="mt-5 rounded-3xl border border-line bg-surface p-5"
        style={shadows.card}
      >
        <Text className="text-lg">전체 평균 총점</Text>
        <View className="mt-1 flex-row items-end">
          <Text className="text-3xl text-brand-text">
            {averageTotalScore(state.items).toFixed(1)}
          </Text>
          <Text className="mb-1 ml-1 text-lg text-brand-text">
            /{EXAM_TOTAL_MAX_SCORE}
          </Text>
        </View>
        {state.items.length === 1 ? (
          <SingleExamTrendPrompt />
        ) : (
          <ScoreTrendChart items={state.items} />
        )}
      </View>

      <View className="mt-4 gap-3">
        {state.items.map((item) => (
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

export function ExamHistoryScreen({ onOpenExam, onStartExam }: ExamHistoryScreenProps) {
  const [selectedTab, setSelectedTab] = useState<HistoryTab>("exams");
  // 재답변 패널을 처음 열기 전에는 /retries를 지연하고, 이후에는 마운트를 유지해 결과를 보존한다.
  const [hasOpenedReanswers, setHasOpenedReanswers] = useState(false);
  /**
   * 이력은 화면이 한 번만 받아 두 탭이 나눠 쓴다.
   *
   * 재답변 탭도 어느 시험을 조회할지 알려면 이력이 필요하다. 탭마다 따로 받으면
   * 탭을 오갈 때마다 같은 요청이 반복된다.
   */
  const [historyState, setHistoryState] = useState<ExamHistoryState>({
    status: "loading",
  });
  // 값 자체엔 의미가 없다. 재시도 버튼이 아래 effect를 다시 돌리기 위한 트리거다.
  const [reloadNonce, setReloadNonce] = useState(0);
  const reduceMotion = useReducedMotion();
  const panelOffset = useSharedValue(0);
  const panelOpacity = useSharedValue(1);

  useEffect(() => {
    const controller = new AbortController();
    setHistoryState({ status: "loading" });

    getExamHistory(controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return;
        setHistoryState({ status: "ready", items });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        // 화면 문구만으로는 네트워크·서버·계약 중 무엇이었는지 알 수 없다.
        console.error("[ExamHistory] 모의고사 이력 조회 실패", error);
        setHistoryState({ status: "error", retryable: isRetryableFailure(error) });
      });

    return () => controller.abort();
  }, [reloadNonce]);

  const retryHistory = useCallback(() => {
    setReloadNonce((nonce) => nonce + 1);
  }, []);

  const handleSelectTab = useCallback(
    (tab: HistoryTab) => {
      if (tab === "reanswers") setHasOpenedReanswers(true);
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
          <View style={{ display: selectedTab === "exams" ? "flex" : "none" }}>
            <ExamHistoryPanel
              state={historyState}
              onRetry={retryHistory}
              onOpenExam={onOpenExam}
              onStartExam={onStartExam}
            />
          </View>
          <View style={{ display: selectedTab === "reanswers" ? "flex" : "none" }}>
            <ReanswerHistoryPanel
              enabled={hasOpenedReanswers}
              history={historyState}
              onRetryHistory={retryHistory}
              onOpenExam={onOpenExam}
              onStartExam={onStartExam}
            />
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
