import { View } from "react-native";

import { Text } from "@/components/ui/Text";
import {
  EXAM_TOTAL_MAX_SCORE,
  averageTotalScore,
} from "@/features/exam/map-exam-history";
import { EmptyExamHistory } from "@/screens/feedback/components/EmptyExamHistory";
import { ExamHistoryCard } from "@/screens/feedback/components/ExamHistoryCard";
import {
  HistoryPanelLoading,
  HistoryPanelNotice,
} from "@/screens/feedback/components/HistoryPanelNotice";
import { ScoreTrendChart } from "@/screens/feedback/components/ScoreTrendChart";
import {
  CONTRACT_ERROR_DESCRIPTION,
  type ExamHistoryState,
} from "@/screens/feedback/exam-history-state";
import { shadows } from "@/theme";

/** 모의고사 기록 탭. 조회는 부모가 한 번만 하고 이 패널은 그 결과를 그린다. */
export function ExamHistoryPanel({
  state,
  onRetry,
  onOpenExam,
  onStartExam,
}: {
  state: ExamHistoryState;
  onRetry: () => void;
  onOpenExam: (examId: string) => void;
  onStartExam: () => void;
}) {
  if (state.status === "loading") {
    return <HistoryPanelLoading />;
  }

  // 조회 실패를 빈 상태로 바꾸지 않는다 — 기록이 정말 없는 경우와 구분해야 한다.
  if (state.status === "error") {
    return (
      <HistoryPanelNotice
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
        <ScoreTrendChart items={state.items} />
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
