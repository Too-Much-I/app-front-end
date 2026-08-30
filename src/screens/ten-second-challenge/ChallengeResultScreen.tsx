import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { Image, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import {
  useChallengeResult,
  type ChallengeResultStatus,
} from "@/features/challenge/use-challenge-result";
import type { RootStackParamList } from "@/navigation/types";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { ChallengeHeader } from "@/screens/ten-second-challenge/components/ChallengeHeader";
import { ChallengeResultSkeleton } from "@/screens/ten-second-challenge/components/ChallengeResultSkeleton";
import { shadows } from "@/theme";

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const graduateTurtle = require("../../../public/mascots/graduate_turtle.png");
const waitingRabbit = require("../../../public/mascots/waiting_rabbit_tight.png");
const errorRabbit = require("../../../public/mascots/error.png");

type ChallengeResultScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "ChallengeResult"
>;

/**
 * 채점을 기다리고 결과를 보여주는 화면.
 *
 * 진입 경로가 둘이다 — 방금 제출하고 넘어오거나, 스테이지에서 이미 푼 문장을 다시 열거나.
 * 그래서 넘겨받는 값은 날짜와 문제 번호뿐이고 나머지는 전부 서버에서 다시 읽는다.
 * 채점 대기를 문제 화면이 아니라 여기 두는 이유도 같다: 대기 중 앱을 나갔다 와도
 * 스테이지를 거쳐 이 화면으로 돌아오면 같은 자리에서 이어진다.
 *
 * 참고 답안은 제출 접수 즉시 서버에 생기므로 AI 피드백을 기다리는 동안에도 보여준다 —
 * 사용자가 이 화면에서 얻어갈 것이 "기다리세요" 하나뿐인 순간을 만들지 않는다.
 */
export function ChallengeResultScreen({
  navigation,
  route,
}: ChallengeResultScreenProps) {
  const { challengeDate, questionNumber, initialResult } = route.params;
  const { status, question, retry } = useChallengeResult(
    challengeDate,
    questionNumber,
    initialResult,
  );
  const goToStage = () => navigation.goBack();

  if (status === "loading") {
    return (
      <View className="flex-1 bg-surface-subtle">
        <StatusBar style="dark" />
        <ChallengeHeader onClose={goToStage} />
        <ChallengeResultSkeleton />
      </View>
    );
  }

  const notice = getStatusNotice(status);

  return (
    <View className="flex-1 bg-surface-subtle">
      <StatusBar style="dark" />
      <ChallengeHeader onClose={goToStage} />

      <SafeAreaView className="flex-1" edges={["bottom"]}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow gap-4 px-5 pb-4 pt-4"
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center gap-2">
            <Image
              accessibilityElementsHidden
              className="h-32 w-32"
              resizeMode="contain"
              source={notice.mascot}
            />
            <Text accessibilityRole="header" className="text-xl text-brand-text">
              {notice.title}
            </Text>
            <Text className="text-center text-sm leading-6 text-ink-muted">
              {notice.description}
            </Text>
          </View>

          {question ? (
            <>
              <View className="rounded-3xl bg-surface p-5" style={shadows.card}>
                <Text className="text-xs text-ink-muted">오늘의 문장</Text>
                <Text className="mt-2 text-lg leading-8">{question.promptKo}</Text>
              </View>

              {question.referenceAnswer ? (
                <View
                  className="rounded-3xl border border-sky-line bg-sky-surface p-5"
                  style={shadows.card}
                >
                  <Text className="text-xs text-sky-text">이렇게 말할 수 있어요</Text>
                  <Text className="mt-2 text-lg leading-8 text-sky-text">
                    {question.referenceAnswer}
                  </Text>
                </View>
              ) : null}

              {/*
                AI 개인화 피드백. 응답 필드가 아직 동결되지 않아(명세 9절 `aiResult`)
                지금은 준비 상태만 말한다. 필드가 정해지면 이 자리에 본문이 들어간다.
              */}
              <View className="rounded-3xl bg-surface p-5" style={shadows.card}>
                <Text className="text-xs text-ink-muted">토선생의 한마디</Text>
                <Text className="mt-2 text-sm leading-6 text-ink-muted">
                  {getFeedbackNotice(status, question.hasAiResult)}
                </Text>
                {/* 채점 중에는 곧 채워질 본문의 자리를 잡아둔다. */}
                {status === "grading" ? (
                  <View className="mt-3 gap-2">
                    <SkeletonBlock className="h-4 w-full" />
                    <SkeletonBlock className="h-4 w-4/5" />
                  </View>
                ) : null}
              </View>
            </>
          ) : null}
        </ScrollView>

        <View className="gap-2 px-5 pb-3">
          {notice.canRetry ? (
            <Pressable
              accessibilityHint="채점 상태를 서버에 다시 물어봅니다"
              accessibilityLabel="다시 확인하기"
              accessibilityRole="button"
              className="w-full items-center rounded-full bg-brand-cta py-3"
              onPress={retry}
            >
              <Text className="text-sm text-white">다시 확인하기</Text>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityHint="오늘의 진행도 화면으로 돌아갑니다"
            accessibilityLabel="오늘의 진행도로"
            accessibilityRole="button"
            className="w-full items-center rounded-full border border-line bg-surface py-3"
            onPress={goToStage}
          >
            <Text className="text-sm text-ink-muted">오늘의 진행도로</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function getStatusNotice(status: Exclude<ChallengeResultStatus, "loading">) {
  switch (status) {
    case "completed":
      return {
        mascot: graduateTurtle,
        title: "오늘의 문장 완료!",
        description: "참고 답안과 비교해 보세요.",
        canRetry: false,
      };
    case "grading":
      return {
        mascot: waitingRabbit,
        title: "채점 중이에요",
        description: "먼저 참고 답안부터 볼 수 있어요. 피드백은 끝나는 대로 채워져요.",
        canRetry: false,
      };
    case "grading-failed":
      return {
        mascot: waitingRabbit,
        title: "피드백을 만들지 못했어요",
        description: "제출한 답변은 그대로 남아 있어요. 참고 답안은 아래에서 볼 수 있어요.",
        canRetry: true,
      };
    case "timed-out":
      return {
        mascot: waitingRabbit,
        title: "채점이 예상보다 오래 걸리고 있어요",
        description: "답변은 접수됐어요. 잠시 뒤 다시 확인해 주세요.",
        canRetry: true,
      };
    case "not-attempted":
      return {
        mascot: waitingRabbit,
        title: "아직 풀지 않은 문장이에요",
        description: "오늘의 진행도에서 이 문장을 열어 도전해 보세요.",
        canRetry: false,
      };
    case "load-failed":
      return {
        mascot: errorRabbit,
        title: "결과를 불러오지 못했어요",
        description: "잠시 뒤 다시 시도해 주세요.",
        canRetry: true,
      };
  }
}

function getFeedbackNotice(
  status: Exclude<ChallengeResultStatus, "loading">,
  hasAiResult: boolean,
): string {
  if (status === "grading") return "피드백을 준비하고 있어요...";
  if (status === "grading-failed") return "피드백 생성에 실패했어요. 답변은 그대로 남아 있어요.";
  if (status === "timed-out") return "아직 준비 중이에요. 다시 확인해 주세요.";
  return hasAiResult ? "피드백이 준비됐어요." : "이번 문장에는 개인화 피드백이 없어요.";
}
