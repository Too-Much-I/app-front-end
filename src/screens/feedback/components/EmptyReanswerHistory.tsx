import { Button } from "@/components/ui/Button";
import { StartMockExamButton } from "@/components/ui/StartMockExamButton";
import { EmptyHistoryCard } from "@/screens/feedback/components/EmptyHistoryCard";

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
    <EmptyHistoryCard
      description="문제별 피드백에서 다시 답변하면 최초 답변과 비교해 볼 수 있어요."
      mascot={graduateTurtle}
      title="아직 다시 답변한 기록이 없어요"
    >
      {/* 재답변할 시험이 있으면 그쪽 피드백으로 보내고, 없을 때만 응시를 권한다. */}
      {feedbackExamId ? (
        <Button
          accessibilityHint="재답변할 수 있는 모의고사의 종합 피드백으로 이동합니다"
          label="문제별 피드백 보기"
          size="lg"
          onPress={() => onOpenExam(feedbackExamId)}
        />
      ) : (
        <StartMockExamButton
          accessibilityHint="모의고사 준비 화면으로 이동합니다"
          onPress={onStartExam}
        />
      )}
    </EmptyHistoryCard>
  );
}
