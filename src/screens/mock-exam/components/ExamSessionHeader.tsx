import { ShardHeader } from "@/components/ui/ShardHeader";

interface ExamSessionHeaderProps {
  partNumber: number;
  onExit?: () => void;
}

export function ExamSessionHeader({ partNumber, onExit }: ExamSessionHeaderProps) {
  return (
    <ShardHeader
      title={`Part ${partNumber}`}
      leftAction={
        onExit
          ? {
              // 프레임을 빠져나가는 화살표 형태의 3번 아이콘 후보.
              icon: "log-out",
              accessibilityLabel: "시험 나가기",
              accessibilityHint: "시험을 나갈지 확인합니다",
              onPress: onExit,
            }
          : undefined
      }
    />
  );
}
