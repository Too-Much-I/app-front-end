import { View } from "react-native";

import { StartMockExamButton } from "@/components/ui/StartMockExamButton";
import { Text } from "@/components/ui/Text";
import { EmptyHistoryIllustration } from "@/screens/feedback/components/EmptyHistoryIllustration";

const greetingCat = require("../../../../public/mascots/greeting_cat.png");

/** 시험 이력이 비었을 때 고양이 마스코트와 첫 응시 CTA를 함께 보여준다. */
export function EmptyExamHistory({ onStartExam }: { onStartExam: () => void }) {
  return (
    <View className="mt-8 items-center rounded-3xl border border-line bg-surface px-5 pb-6 pt-4">
      <EmptyHistoryIllustration mascot={greetingCat} />

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
