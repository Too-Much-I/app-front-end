import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import type { MockExamStackParamList } from "@/navigation/types";
import { ExamQuestionContent } from "@/screens/mock-exam/components/ExamQuestionContent";
import { ExamQuestionProgress } from "@/screens/mock-exam/components/ExamQuestionProgress";
import {
  ExamTimerCard,
  type ExamTimerMode,
} from "@/screens/mock-exam/components/ExamTimerCard";

type ExamSessionScreenProps = NativeStackScreenProps<MockExamStackParamList, "ExamSession">;

const WAVEFORM_HEIGHTS = [
  8, 13, 20, 29, 18, 35, 24, 15, 31, 39, 25, 17, 28, 36, 21, 12, 19, 30, 23, 15, 9, 18,
  13, 8,
];

export function ExamSessionScreen({ navigation, route }: ExamSessionScreenProps) {
  const { questions } = route.params.session;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timerMode, setTimerMode] = useState<ExamTimerMode>("preparation");

  const question = questions[currentIndex];
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

  const handleNextPhase = () => {
    if (timerMode === "preparation") {
      setTimerMode("response");
      return;
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((index) => index + 1);
      setTimerMode("preparation");
    }
  };

  const handleStop = () => {
    Alert.alert(
      "모의고사를 중단할까요?",
      "지금까지 확인한 문항까지만 남고 시험 준비 화면으로 돌아가요.",
      [
        { text: "계속 풀기", style: "cancel" },
        { text: "중단하기", style: "destructive", onPress: () => navigation.popToTop() },
      ],
    );
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface">
      <View className="h-14 flex-row items-center border-b border-line px-5">
        <Text className="flex-1 text-xl">Part {question.partNumber}</Text>
        <Pressable
          accessibilityLabel="모의고사 중단하기"
          accessibilityRole="button"
          className="rounded-full border border-line px-3 py-1.5"
          onPress={handleStop}
        >
          <Text className="text-sm text-ink-muted">중단하기</Text>
        </Pressable>
      </View>

      <View className="border-b border-line bg-surface px-4 py-3">
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

      <View className="items-center gap-3 border-t border-line bg-surface px-5 pb-3 pt-4">
        <ExamTimerCard mode={timerMode} remainingSeconds={remainingSeconds} />

        {timerMode === "response" ? (
          <>
            <View className="flex-row items-center gap-2">
              <View className="h-2.5 w-2.5 rounded-full bg-exam-danger" />
              <Text className="text-sm text-exam-danger">답변을 녹음하고 있어요</Text>
            </View>
            <View accessibilityElementsHidden className="h-10 flex-row items-center gap-1">
              {WAVEFORM_HEIGHTS.map((height, index) => (
                <View
                  key={index}
                  className="w-1 rounded-full bg-exam-dangerSoft"
                  style={{ height }}
                />
              ))}
            </View>
          </>
        ) : (
          <Text className="text-center text-sm text-ink-muted">
            곧 답변 시간이 시작돼요. 답변을 준비해 주세요.
          </Text>
        )}

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
    </SafeAreaView>
  );
}
