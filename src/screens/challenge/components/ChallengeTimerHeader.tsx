import { Feather } from "@expo/vector-icons";
import { View } from "react-native";

import { Text } from "@/components/ui/Text";
import { formatCountdown, isUrgentRemaining } from "@/screens/challenge/challenge-status";
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
      {/*
        점 사이 간격에 토큰을 쓰지 않는 이유: 이건 요소 사이의 여백이 아니라
        점 크기(`h-2 w-2` = 8px)와 짝을 이루는 조형 값이다. 간격이 점보다 좁아야
        낱개가 아니라 하나의 진행 표시로 읽힌다.

        문항 수만큼 반복되므로 간격이 곧 전체 폭이기도 하다. `gap-content`(8px)로
        벌리면 폭이 문항당 8px씩 늘어 헤더 가운데 영역을 넘길 수 있다.

        `ChallengeNoteSkeleton`이 이 점들의 자리를 잡아두므로 값을 바꿀 때 같이 고친다.
      */}
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
        className={`flex-row items-center gap-content rounded-full px-4 py-1.5 ${
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
