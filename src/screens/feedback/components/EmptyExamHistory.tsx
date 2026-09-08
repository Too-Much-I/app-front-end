import { StartMockExamButton } from "@/components/ui/StartMockExamButton";
import { EmptyHistoryCard } from "@/screens/feedback/components/EmptyHistoryCard";

const greetingCat = require("../../../../public/mascots/greeting_cat.png");

/** 시험 이력이 비었을 때 고양이 마스코트와 첫 응시 CTA를 함께 보여준다. */
export function EmptyExamHistory({ onStartExam }: { onStartExam: () => void }) {
  return (
    <EmptyHistoryCard
      description="시험을 완료하면 점수 추이와 문제별 피드백이 여기에 쌓여요."
      mascot={greetingCat}
      title="첫 모의고사를 시작해 볼까요?"
    >
      <StartMockExamButton
        accessibilityHint="모의고사 준비 화면으로 이동합니다"
        onPress={onStartExam}
      />
    </EmptyHistoryCard>
  );
}
