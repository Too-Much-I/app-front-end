import { Feather } from "@expo/vector-icons";
import { View } from "react-native";

import { Text } from "@/components/ui/Text";
import {
  formatCountdown,
  isUrgentRemaining,
} from "@/screens/ten-second-challenge/challenge-ui";
import { colors } from "@/theme";

interface ChallengeTimerHeaderProps {
  questionNumber: number;
  totalQuestionCount: number;
  /** 녹음이 끝난 뒤에는 셀 시간이 없으므로 `null`로 배지를 지운다. */
  remainingSeconds: number | null;
}

/**
 * 화면 맨 위의 오늘 진행 점 · 남은 시간 배지.
 *
 * 진행 점은 스테이지 화면의 당근밭과 같은 사실(오늘 몇 번째 문장인지)을 보여주지만
 * 여기서는 눌러서 이동할 수 없는 표시일 뿐이라 같은 그림을 다시 그리지 않는다.
 */
export function ChallengeTimerHeader({
  questionNumber,
  totalQuestionCount,
  remainingSeconds,
}: ChallengeTimerHeaderProps) {
  const isUrgent = isUrgentRemaining(remainingSeconds);

  return (
    <View className="items-center gap-3">
      <View
        accessibilityLabel={`오늘 ${totalQuestionCount}문장 중 ${questionNumber}번째`}
        className="flex-row items-center gap-1.5"
      >
        {Array.from({ length: totalQuestionCount }, (_, index) => index + 1).map((number) => (
          <View
            className={`h-2 w-2 rounded-full ${
              number === questionNumber
                ? "bg-brand-cta"
                : number < questionNumber
                  ? "bg-brand-300"
                  : "bg-line"
            }`}
            key={number}
          />
        ))}
      </View>

      {remainingSeconds === null ? null : (
      <View
        accessibilityLabel={`남은 시간 ${Math.max(0, Math.ceil(remainingSeconds))}초`}
        className={`flex-row items-center gap-1.5 rounded-full px-4 py-1.5 ${
          isUrgent ? "bg-exam-danger" : "bg-brand-cta"
        }`}
      >
        <Feather color={colors.surface.DEFAULT} name="clock" size={14} />
        <Text className="text-base tabular-nums text-white">
          {formatCountdown(remainingSeconds)}
        </Text>
      </View>
      )}
    </View>
  );
}
