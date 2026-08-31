import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
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
import { findCorrectionSpans } from "@/screens/ten-second-challenge/challenge-ui";
import { ChallengeCelebration } from "@/screens/ten-second-challenge/components/ChallengeCelebration";
import { ChallengeCorrectionSheet } from "@/screens/ten-second-challenge/components/ChallengeCorrectionSheet";
import { ChallengeSentenceCard } from "@/screens/ten-second-challenge/components/ChallengeSentenceCard";
import { ChallengeVerdictCard } from "@/screens/ten-second-challenge/components/ChallengeVerdictCard";
import { Tape } from "@/screens/ten-second-challenge/components/paper/Tape";
import { ChallengeMarkedTranscript } from "@/screens/ten-second-challenge/components/ChallengeMarkedTranscript";
import { ChallengeHeader } from "@/screens/ten-second-challenge/components/ChallengeHeader";
import { ChallengeResultSkeleton } from "@/screens/ten-second-challenge/components/ChallengeResultSkeleton";

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
  const { challengeDate, questionNumber, initialResult, totalQuestionCount } = route.params;
  const { status, question, retry } = useChallengeResult(
    challengeDate,
    questionNumber,
    initialResult,
  );
  const goToStage = () => navigation.goBack();

  /*
   * 다음 문장으로 바로 넘어갈 수 있는가.
   *
   * 챌린지는 순서대로만 진행하고 서버가 순서 밖 요청을 막으므로 다음 번호는 +1이다.
   * 다만 마지막 문장에서 없는 번호로 보내지 않으려면 총 문항 수가 필요한데, 결과 조회
   * 응답에는 없어서 문제 화면이 넘겨준 값에 기댄다. 스테이지에서 들어오면 그 값이 없고,
   * 그때는 이 버튼 대신 진행도로 돌아가는 버튼만 남는다.
   */
  const nextQuestionNumber =
    totalQuestionCount !== undefined && questionNumber < totalQuestionCount
      ? questionNumber + 1
      : null;

  const goToNextQuestion = () => {
    if (nextQuestionNumber === null) return;
    navigation.replace("TenSecondChallenge", {
      challengeDate,
      questionNumber: nextQuestionNumber,
    });
  };

  /*
   * 첨삭 시트가 열려 있는 항목. 여는 쪽(밑줄·목록)과 넘기는 쪽(시트 하단)이 같은 값을
   * 봐야 해서 시트가 아니라 화면이 들고 있다.
   */
  const [openedCorrection, setOpenedCorrection] = useState<number | null>(null);

  const corrections = question?.corrections ?? [];

  /*
   * 밑줄 자리와, 밑줄을 얻지 못한 항목.
   *
   * 항목이 많아야 서너 개라 매 렌더 다시 계산한다. 두 값이 같은 배열에서 나와야
   * 시트의 인덱스와 밑줄이 어긋나지 않으므로 한자리에서 함께 만든다.
   */
  const spans = findCorrectionSpans(question?.transcript ?? "", corrections);
  const markedIndexes = new Set(spans.map((span) => span.index));
  const unmarkedIndexes = corrections
    .map((_, index) => index)
    .filter((index) => !markedIndexes.has(index));

  /*
   * 채점은 끝났는데 옮겨 적을 발화가 없다 — 무음으로 제출됐거나 인식하지 못한 경우다.
   *
   * 이때는 피드백도 첨삭도 같이 비어 있는 게 보통이라, "한마디"와 "내가 말한 문장"이
   * 둘 다 "없다"만 말하는 카드 두 장이 된다. 그래서 문장 카드 한 장으로 합친다.
   */
  const missedSpeech = (question?.hasAiResult ?? false) && question?.transcript == null;

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
      <ChallengeHeader onClose={goToStage} title="토선생의 한마디" />

      <SafeAreaView className="flex-1" edges={["bottom"]}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow gap-4 px-5 pb-4 pt-4"
          showsVerticalScrollIndicator={false}
        >
          {/*
            채점이 끝난 화면만 축하한다. 기다리는 중이거나 실패한 화면은 마스코트와
            안내 문구가 상황을 설명해야 해서 색종이가 낄 자리가 아니다.
          */}
          {status === "completed" ? (
            /*
              잘린 하반신이 판정 카드 윗변에 맞물려야 "카드 뒤에 서 있는" 것으로 보인다.
              `-mb-4`는 스크롤 컨테이너의 `gap-4`를 상쇄해 둘 사이를 0으로 만든다.
            */
            <View className="-mb-4">
              <ChallengeCelebration />
            </View>
          ) : (
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
          )}

          {question ? (
            <>
              {missedSpeech ? null : (
                <ChallengeVerdictCard
                  decoration={<Tape side="right" tone="mint" />}
                  message={
                    question.feedbackSummary ??
                    getFeedbackNotice(status, question.hasAiResult)
                  }
                >
                  {/* 채점 중에는 곧 채워질 본문의 자리를 잡아둔다. */}
                  {status === "grading" ? (
                    <View className="gap-2">
                      <SkeletonBlock className="h-4 w-full" />
                      <SkeletonBlock className="h-4 w-4/5" />
                    </View>
                  ) : null}
                </ChallengeVerdictCard>
              )}

              {question.transcript ? (
                <ChallengeSentenceCard
                  hint={spans.length > 0 ? "밑줄을 누르면 설명이 나와요" : undefined}
                  label="내 문장"
                  tone="mint"
                >
                  <ChallengeMarkedTranscript
                    corrections={question.corrections}
                    onSelect={setOpenedCorrection}
                    spans={spans}
                    transcript={question.transcript}
                  />

                  {/*
                    밑줄을 그을 수 없었던 항목만 모으는 줄.

                    `original`을 문장에서 못 찾으면 밑줄이 생기지 않는데, 이 줄이 없으면
                    그 지적은 화면에서 통째로 사라진다. 시트는 전체 목록을 넘겨받으므로
                    여기서 연 뒤에도 하단 이동으로 다른 지적까지 갈 수 있다.
                  */}
                  {unmarkedIndexes.length > 0 ? (
                    <Pressable
                      accessibilityHint="첨삭 설명을 엽니다"
                      accessibilityLabel={`그 외 지적 ${unmarkedIndexes.length}개`}
                      accessibilityRole="button"
                      className="mt-3 flex-row items-center border-t border-challenge-mint-label pt-3"
                      onPress={() => setOpenedCorrection(unmarkedIndexes[0] ?? 0)}
                    >
                      <Text className="flex-1 text-xs text-challenge-mint-text">
                        그 외 지적 {unmarkedIndexes.length}개
                      </Text>
                      <Text className="text-xs text-challenge-mint-text">›</Text>
                    </Pressable>
                  ) : null}
                </ChallengeSentenceCard>
              ) : missedSpeech ? (
                <ChallengeSentenceCard label="내 문장" tone="mint">
                  <Text className="text-base leading-7">
                    이번에는 말한 내용을 알아듣지 못했어요.
                  </Text>
                  <Text className="text-sm leading-6 text-challenge-mint-text">
                    아래 모범 답안을 보고 내일 다시 도전해 보세요.
                  </Text>

                  {/*
                    문장이 없으면 첨삭도 전부 밑줄을 얻지 못한다. 드물지만 서버가 지적을
                    함께 준다면 이 줄이 유일한 입구다 — 없으면 그대로 묻힌다.
                  */}
                  {corrections.length > 0 ? (
                    <Pressable
                      accessibilityHint="첨삭 설명을 엽니다"
                      accessibilityLabel={`지적 ${corrections.length}개 보기`}
                      accessibilityRole="button"
                      className="mt-3 flex-row items-center border-t border-challenge-mint-label pt-3"
                      onPress={() => setOpenedCorrection(0)}
                    >
                      <Text className="flex-1 text-xs text-challenge-mint-text">
                        지적 {corrections.length}개 보기
                      </Text>
                      <Text className="text-xs text-challenge-mint-text">›</Text>
                    </Pressable>
                  ) : null}
                </ChallengeSentenceCard>
              ) : null}

              {question.referenceAnswer ? (
                <ChallengeSentenceCard
                  decoration={<Tape side="right" tone="sky" />}
                  label="추천 표현"
                  tone="sky"
                >
                  <Text className="text-lg leading-8 text-sky-text">
                    {question.referenceAnswer}
                  </Text>
                </ChallengeSentenceCard>
              ) : null}
            </>
          ) : null}
        </ScrollView>

        <View className="gap-2 px-5 pb-3">
          {nextQuestionNumber !== null ? (
            <Pressable
              accessibilityHint={`${nextQuestionNumber}번째 문장으로 넘어갑니다`}
              accessibilityLabel="한 문장 더"
              accessibilityRole="button"
              className="w-full items-center rounded-full bg-brand-cta py-4"
              onPress={goToNextQuestion}
            >
              <Text className="text-base text-white">한 문장 더</Text>
            </Pressable>
          ) : null}

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

      <ChallengeCorrectionSheet
        index={openedCorrection}
        items={corrections}
        onClose={() => setOpenedCorrection(null)}
        onIndexChange={setOpenedCorrection}
      />
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
