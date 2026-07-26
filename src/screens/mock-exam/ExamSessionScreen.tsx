import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { getExamPartDirections } from "@/features/exam/part-directions";
import type { MockExamStackParamList } from "@/navigation/types";
import { ExamPartDirectionsContent } from "@/screens/mock-exam/components/ExamPartDirectionsContent";
import { ExamQuestionContent } from "@/screens/mock-exam/components/ExamQuestionContent";
import { ExamQuestionProgress } from "@/screens/mock-exam/components/ExamQuestionProgress";
import { ExamSessionHeader } from "@/screens/mock-exam/components/ExamSessionHeader";
import {
  ExamTimerCard,
  type ExamTimerMode,
} from "@/screens/mock-exam/components/ExamTimerCard";

type ExamSessionScreenProps = NativeStackScreenProps<MockExamStackParamList, "ExamSession">;

const WAVEFORM_HEIGHTS = [
  8, 13, 20, 29, 18, 35, 24, 15, 31, 39, 25, 17, 28, 36, 21, 12, 19, 30, 23, 15, 9, 18,
  13, 8,
];

type ExamSessionPhase = "directions" | ExamTimerMode;

function getInitialPhase(partNumber: number | undefined): ExamSessionPhase {
  return partNumber !== undefined && getExamPartDirections(partNumber)
    ? "directions"
    : "preparation";
}

export function ExamSessionScreen({ navigation, route }: ExamSessionScreenProps) {
  const { questions } = route.params.session;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<ExamSessionPhase>(() =>
    getInitialPhase(questions[0]?.partNumber),
  );

  const question = questions[currentIndex];
  const timerMode: ExamTimerMode = phase === "response" ? "response" : "preparation";
  const remainingSeconds = question
    ? timerMode === "preparation"
      ? question.prepTimeSec
      : question.speakTimeSec
    : 0;

  useEffect(() => {
    const tabNavigator = navigation.getParent();
    tabNavigator?.setOptions({ tabBarStyle: { display: "none" } });

    return () => {
      tabNavigator?.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation]);

  if (!question) return null;

  const directions = getExamPartDirections(question.partNumber);

  const handleNextPhase = () => {
    if (phase === "preparation") {
      setPhase("response");
      return;
    }

    if (phase === "response" && currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextQuestion = questions[nextIndex];
      const isStartingNextPart = nextQuestion.partNumber !== question.partNumber;

      setCurrentIndex(nextIndex);
      setPhase(isStartingNextPart ? getInitialPhase(nextQuestion.partNumber) : "preparation");
    }
  };

  return (
    <View className="flex-1 bg-surface-subtle">
      <StatusBar style="light" />
      <ExamSessionHeader partNumber={question.partNumber} />

      <SafeAreaView edges={["bottom"]} className="flex-1 bg-surface-subtle">
        {phase === "directions" && directions ? (
          <ExamPartDirectionsContent
            directions={directions}
            partNumber={question.partNumber}
            onComplete={() => setPhase("preparation")}
          />
        ) : (
          <>
            <View className="bg-surface px-4 py-3">
              <ExamQuestionProgress currentIndex={currentIndex} total={questions.length} />
            </View>

            <ScrollView
              bounces={false}
              className="flex-1"
              contentContainerClassName="flex-grow px-6 pb-5 pt-6"
              showsVerticalScrollIndicator={false}
            >
              <ExamQuestionContent question={question} />
            </ScrollView>

            <View className="items-center gap-3 bg-surface px-5 pb-3 pt-4">
              {timerMode === "response" ? (
                <View accessibilityElementsHidden className="h-10 flex-row items-center gap-1">
                  {WAVEFORM_HEIGHTS.map((height, index) => (
                    <View
                      key={index}
                      className="w-1 rounded-full bg-exam-dangerSoft"
                      style={{ height }}
                    />
                  ))}
                </View>
              ) : null}

              <ExamTimerCard mode={timerMode} remainingSeconds={remainingSeconds} />

              <Pressable
                accessibilityRole="button"
                className="rounded-full border border-brand-300 px-4 py-2"
                onPress={handleNextPhase}
              >
                <Text className="text-sm text-brand-text">
                  {timerMode === "preparation"
                    ? "준비 완료, 바로 답변 시작하기"
                    : currentIndex < questions.length - 1
                      ? "답변 완료, 다음 문제 보기"
                      : "마지막 답변 확인"}
                </Text>
              </Pressable>

              <Text className="text-center text-xs leading-4 text-ink-disabled">
                다음 문제로 자동 전환되며 뒤로 갈 수 없어요.
              </Text>
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}
