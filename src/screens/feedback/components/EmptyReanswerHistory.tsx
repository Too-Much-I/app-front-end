import { View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { StartMockExamButton } from "@/components/ui/StartMockExamButton";
import { Text } from "@/components/ui/Text";
import { EmptyHistoryIllustration } from "@/screens/feedback/components/EmptyHistoryIllustration";

const graduateTurtle = require("../../../../public/mascots/graduate_turtle.png");

/** 재답변 기록이 비었을 때 터틀 마스코트와 다음 행동을 함께 보여준다. */
export function EmptyReanswerHistory({
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
      <EmptyHistoryIllustration mascot={graduateTurtle} />

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
