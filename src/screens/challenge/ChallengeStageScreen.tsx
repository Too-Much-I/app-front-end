import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useCallback } from "react";
import { Image, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { useChallengeToday } from "@/features/challenge/use-challenge-today";
import type { RootStackParamList } from "@/navigation/types";
import {
  toChallengeStageState,
  type ChallengeStageQuestion,
} from "@/screens/challenge/challenge-stage-status";
import { ChallengeHeader } from "@/screens/challenge/components/ChallengeHeader";
import { ChallengeStageField } from "@/screens/challenge/components/ChallengeStageField";
import { ChallengeStageProgressCard } from "@/screens/challenge/components/ChallengeStageProgressCard";
import { ChallengeStageSkeleton } from "@/screens/challenge/components/ChallengeStageSkeleton";
import { shadows } from "@/theme";

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const greetingRabbit = require("../../../public/mascots/greeting_rabbit_bust.png");
const errorRabbit = require("../../../public/mascots/error.png");

type ChallengeStageScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "ChallengeStage"
>;

/**
 * 오늘 어디까지 왔는지 보고 다음 문장으로 들어가는 화면.
 *
 * 챌린지의 모든 진입이 여기서 시작한다. 홈 배너가 문제 화면으로 직행하지 않는 이유는
 * 두 가지다 — 이미 푼 문장을 다시 열 방법이 없어지고, 서버가 정한 날짜를 알 수 없다.
 * 날짜는 이 화면의 조회 응답에만 있고, 아래 두 화면은 그것을 받아 쓴다.
 *
 * 채점 상태는 그리지 않는다. 채점 중인 문장을 눌러도 갈 곳은 결과 화면으로 같고,
 * 대기와 폴링은 그 화면이 이미 소유하고 있다.
 */
export function ChallengeStageScreen({ navigation }: ChallengeStageScreenProps) {
  const query = useChallengeToday();
  const { refetch } = query;
  const state = toChallengeStageState(query);

  const retry = useCallback(() => void refetch(), [refetch]);
  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  /**
   * 이미 푼 문장은 결과로, 지금 풀 차례는 문제 화면으로.
   *
   * `nextQuestionNumber`를 결과 화면까지 실어 보내는 이유는 그 화면의 "한 문장 더"가
   * 다음 **순번**이 아니라 다음 **안 푼** 문장으로 가야 하기 때문이다. 스테이지에서
   * 1번을 다시 열었는데 버튼이 이미 푼 2번으로 보내면, 문제 화면이 곧바로 결과 화면으로
   * 되돌려서 버튼 이름이 한 약속을 지키지 못한다.
   */
  const openQuestion = useCallback(
    (question: ChallengeStageQuestion, date: string, nextQuestionNumber: number | null) => {
      if (question.status === "done") {
        navigation.navigate("ChallengeResult", {
          challengeDate: date,
          questionNumber: question.questionNumber,
          ...(nextQuestionNumber === null ? {} : { nextQuestionNumber }),
        });
        return;
      }

      navigation.navigate("TenSecondChallenge", {
        challengeDate: date,
        questionNumber: question.questionNumber,
      });
    },
    [navigation],
  );

  return (
    <View className="flex-1 bg-surface-subtle">
      <StatusBar style="dark" />
      <ChallengeHeader onClose={goBack} />

      <SafeAreaView className="flex-1" edges={["bottom"]}>
        {state.status === "loading" ? <ChallengeStageSkeleton /> : null}

        {state.status === "error" ? (
          <View className="flex-1 items-center justify-center gap-5 px-5">
            <Image
              accessibilityElementsHidden
              className="h-40 w-40"
              resizeMode="contain"
              source={errorRabbit}
            />
            <View
              className="w-full items-center rounded-3xl bg-surface p-5"
              style={shadows.card}
            >
              <Text className="text-center text-base leading-6 text-exam-danger">
                오늘의 진행도를 불러오지 못했어요.
              </Text>
              <Text className="mt-2 text-center text-sm leading-6 text-ink-muted">
                잠시 뒤 다시 시도해 주세요.
              </Text>

              <Pressable
                accessibilityHint="오늘의 진행도를 다시 요청합니다"
                accessibilityLabel="다시 불러오기"
                accessibilityRole="button"
                className="mt-5 w-full items-center rounded-full bg-brand-cta py-3"
                onPress={retry}
              >
                <Text className="text-sm text-white">다시 불러오기</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {state.status === "ready" ? (
          <ScrollView
            className="flex-1"
            contentContainerClassName="grow px-5 pb-6"
            showsVerticalScrollIndicator={false}
          >
            <View className="flex-row items-start">
              <View className="flex-1 pt-2">
                <Text accessibilityRole="header" className="text-2xl">
                  오늘의 진행도
                </Text>
                {/* 제목 아래 짧은 주황 밑줄. 목업의 강조 획이라 접근성 트리에서는 뺀다. */}
                <View
                  accessibilityElementsHidden
                  className="mt-2 h-1 w-10 rounded-full bg-brand-cta"
                />

                <View className="mt-4">
                  <ChallengeStageProgressCard
                    isCompleted={state.nextQuestionNumber === null}
                    solvedCount={countSolved(state.questions)}
                    totalCount={state.questions.length}
                  />
                </View>
              </View>

              {/* 밭을 내려다보는 자리라 첫 구멍 위에 걸치게 둔다. */}
              <Image
                accessibilityElementsHidden
                className="-mr-2 h-44 w-36"
                resizeMode="contain"
                source={greetingRabbit}
              />
            </View>

            <View className="-mt-6">
              <ChallengeStageField
                onSelect={(question) =>
                  openQuestion(question, state.date, state.nextQuestionNumber)
                }
                questions={state.questions}
              />
            </View>

            {/* 밭 바로 아래가 아니라 화면 맨 아래에 붙인다. 밭과 붙어 있으면 마지막
                구덩이의 설명처럼 읽히는데, 이건 세 자리 전체에 대한 안내다.
                `mt-auto`는 내용이 화면을 넘칠 때 저절로 0이 되어 밭을 밀지 않는다. */}
            <Text className="mt-auto pt-6 text-center text-sm text-ink-muted">
              {state.nextQuestionNumber === null
                ? "오늘 몫을 다 뽑았어요. 내일 또 만나요!"
                : "당근을 따라 오늘의 문제를 시작해요"}
            </Text>
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

function countSolved(questions: ChallengeStageQuestion[]): number {
  return questions.filter((question) => question.status === "done").length;
}
