import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { useQuery } from "@tanstack/react-query";

import { examHistoryQueryOptions } from "@/features/exam/exam-history-queries";
import { ExamHistoryPanel } from "@/screens/feedback/components/ExamHistoryPanel";
import { HistoryTabs } from "@/screens/feedback/components/HistoryTabs";
import { ReanswerHistoryPanel } from "@/screens/feedback/components/ReanswerHistoryPanel";
import { toHistoryPanelState } from "@/screens/feedback/exam-history-state";
import {
  type HistoryTab,
  TAB_TRANSITION_DURATION_MS,
  tabIndexOf,
} from "@/screens/feedback/exam-history-tabs";
import { useHistoryFailureReport } from "@/screens/feedback/use-history-failure-report";

/** 패널이 밀려 들어오는 거리. 화면 폭만큼 밀면 스크롤 화면에서 과하게 흔들린다. */
const PANEL_SLIDE_DISTANCE = 28;

/**
 * 시험 이력 탭 화면. 라우트가 아니라 `FeedbackScreen`이 examId 없이 열렸을 때 그리는 뷰다.
 *
 * 이 파일이 맡는 것은 탭 전환과 이력 조회 하나뿐이고, 각 탭의 내용은 패널이 맡는다.
 */
export function ExamHistoryTabView({
  onOpenExam,
  onStartExam,
}: {
  onOpenExam: (examId: string) => void;
  onStartExam: () => void;
}) {
  const [selectedTab, setSelectedTab] = useState<HistoryTab>("exams");
  // 재답변 패널을 처음 열기 전에는 /retries를 지연하고, 이후에는 마운트를 유지해 결과를 보존한다.
  const [hasOpenedReanswers, setHasOpenedReanswers] = useState(false);
  /**
   * 이력은 이 뷰가 한 번만 받아 두 탭이 나눠 쓴다.
   *
   * 재답변 탭도 어느 시험을 조회할지 알려면 이력이 필요하다. 탭마다 따로 받으면
   * 탭을 오갈 때마다 같은 요청이 반복된다.
   */
  const historyQuery = useQuery(examHistoryQueryOptions());
  const { refetch: refetchHistory } = historyQuery;
  const reduceMotion = useReducedMotion();
  const panelOffset = useSharedValue(0);
  const panelOpacity = useSharedValue(1);

  const historyState = toHistoryPanelState(historyQuery);
  useHistoryFailureReport(
    "exam-history",
    "[ExamHistory] 모의고사 이력 조회 실패",
    historyState.status === "error" ? historyQuery.error : null,
  );

  const retryHistory = useCallback(() => {
    void refetchHistory();
  }, [refetchHistory]);

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
