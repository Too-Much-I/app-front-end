import { useQuery } from "@tanstack/react-query";
import { Image, View } from "react-native";

import { Sparkle, type SparkleProps } from "@/components/ui/Sparkle";
import { Text } from "@/components/ui/Text";
import { examRetriesQueryOptions } from "@/features/exam/exam-history-queries";
import { summarizeReanswerProgress } from "@/features/exam/map-exam-retries";
import { EmptyReanswerHistory } from "@/screens/feedback/components/EmptyReanswerHistory";
import {
  HistoryPanelLoading,
  HistoryPanelNotice,
} from "@/screens/feedback/components/HistoryPanelNotice";
import { ReanswerGrowthCard } from "@/screens/feedback/components/ReanswerGrowthCard";
import {
  CONTRACT_ERROR_DESCRIPTION,
  type ExamHistoryState,
  resolveReanswerHistoryState,
} from "@/screens/feedback/exam-history-state";
import { useHistoryFailureReport } from "@/screens/feedback/use-history-failure-report";
import { shadows } from "@/theme";

const chartIllustration = require("../../../../public/icons/chart.png");

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

/**
 * 재답변 성과 탭.
 *
 * 재답변 조회는 시험 단위라 대상 시험이 필요하다 — 이력에서 재답변이 있는 가장 최근
 * 시험을 고른다(목록은 최신순이다). 사용자 전체 스냅샷 endpoint가 생기면 이 선택은
 * 없어진다.
 */
export function ReanswerHistoryPanel({
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

  // 탭을 처음 열기 전에는 요청을 보내지 않는다. 한번 열리면 부모가 enabled를 계속 유지한다.
  const retriesQuery = useQuery({
    ...examRetriesQueryOptions(targetExamId),
    enabled,
  });
  const { refetch: refetchRetries } = retriesQuery;

  const state = resolveReanswerHistoryState(history, targetExamId, retriesQuery);
  useHistoryFailureReport(
    "reanswer-history",
    "[ReanswerHistory] 재답변 이력 조회 실패",
    state.status === "error" && history.status !== "error" ? retriesQuery.error : null,
  );

  if (state.status === "loading") {
    return <HistoryPanelLoading />;
  }

  if (state.status === "error") {
    return (
      <HistoryPanelNotice
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
                void refetchRetries();
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
            <ReanswerGrowthCard
              key={`${item.examId}-${item.questionNumber}`}
              item={item}
            />
          ))}
        </View>
      </View>
    </>
  );
}
