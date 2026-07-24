import { View } from "react-native";

import { Text } from "@/components/ui/Text";

interface ExamQuestionProgressProps {
  currentIndex: number;
  total: number;
}

/** 파트 가이드의 도트 규칙을 문항 단위 진행 상태로 확장한 읽기 전용 진행 표시다. */
export function ExamQuestionProgress({ currentIndex, total }: ExamQuestionProgressProps) {
  if (total <= 0) return null;

  const edgeInset = `${100 / total / 2}%` as `${number}%`;

  return (
    <View
      accessibilityLabel={`전체 ${total}문제 중 ${currentIndex + 1}번째 문제`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: currentIndex + 1 }}
      className="relative flex-row items-center"
    >
      <View
        className="absolute h-0.5 bg-line"
        style={{ left: edgeInset, right: edgeInset }}
      />

      {Array.from({ length: total }, (_, index) => {
        const isCurrent = index === currentIndex;
        const isComplete = index < currentIndex;

        return (
          <View key={index} className="h-7 flex-1 items-center justify-center">
            <View
              className={`items-center justify-center rounded-full ${
                isCurrent
                  ? "h-7 w-7 bg-brand-cta"
                  : isComplete
                    ? "h-2.5 w-2.5 bg-brand-cta"
                    : "h-2.5 w-2.5 bg-line"
              }`}
            >
              {isCurrent ? <Text className="text-sm text-white">{index + 1}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
