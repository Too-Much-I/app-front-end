import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import {
  CHALLENGE_QUESTIONS_PER_DAY,
  formatChallengeDateLabel,
} from '@/features/challenge/challenge-day';
import type { RootStackParamList } from '@/navigation/types';
import {
  toChallengeDayStageQuestions,
  type ChallengeStageQuestion,
} from '@/screens/challenge/challenge-stage-status';
import { ChallengeHeader } from '@/screens/challenge/components/ChallengeHeader';
import { ChallengeStageField } from '@/screens/challenge/components/ChallengeStageField';
import { ChallengeStageProgressCard } from '@/screens/challenge/components/ChallengeStageProgressCard';

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const greetingRabbit = require('../../../public/mascots/greeting_rabbit_bust.png');

type ChallengeDayStageScreenProps = NativeStackScreenProps<RootStackParamList, 'ChallengeDayStage'>;

/**
 * 지난 날짜에 어디까지 뽑았는지 보는 화면.
 *
 * 오늘 스테이지(`ChallengeStageScreen`)와 같은 밭을 쓰지만 조회하지 않는다. 달력이 넘긴
 * 개수가 이 날짜의 최종 값이다 — 지난 날짜는 새로 풀 수 없다. 그래서 로딩·오류 상태도 없다.
 *
 * 뽑은 당근은 그날의 결과 화면으로 간다. "한 문장 더"는 오늘에만 의미가 있어서 넘기지 않는다.
 */
export function ChallengeDayStageScreen({ navigation, route }: ChallengeDayStageScreenProps) {
  const { challengeDate, solvedQuestionCount } = route.params;
  const questions = toChallengeDayStageQuestions(solvedQuestionCount, CHALLENGE_QUESTIONS_PER_DAY);
  const isCompleted = solvedQuestionCount >= CHALLENGE_QUESTIONS_PER_DAY;

  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  const openResult = useCallback(
    (question: ChallengeStageQuestion) => {
      // 밭이 `done`이 아닌 자리는 누를 수 없게 막지만, 화면이 갈 곳을 고르는 판단은 여기 둔다.
      if (question.status !== 'done') return;
      navigation.navigate('ChallengeResult', {
        challengeDate,
        questionNumber: question.questionNumber,
      });
    },
    [challengeDate, navigation],
  );

  return (
    <View className="flex-1 bg-surface-subtle">
      <StatusBar style="dark" />
      <ChallengeHeader onClose={goBack} />

      <SafeAreaView className="flex-1" edges={['bottom']}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="grow px-screen pb-6"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-row items-start">
            <View className="flex-1 pt-2">
              <Text accessibilityRole="header" className="text-2xl">
                {formatChallengeDateLabel(challengeDate)}의 진행도
              </Text>
              {/* 오늘 스테이지와 같은 강조 획. 접근성 트리에서는 뺀다. */}
              <View
                accessibilityElementsHidden
                className="mt-2 h-1 w-10 rounded-full bg-brand-cta"
              />

              <View className="mt-4">
                <ChallengeStageProgressCard
                  isCompleted={isCompleted}
                  label="이날 완료"
                  pendingLabel={null}
                  solvedCount={solvedQuestionCount}
                  totalCount={CHALLENGE_QUESTIONS_PER_DAY}
                />
              </View>
            </View>

            <Image
              accessibilityElementsHidden
              className="-mr-2 h-44 w-36"
              resizeMode="contain"
              source={greetingRabbit}
            />
          </View>

          <View className="-mt-6">
            <ChallengeStageField onSelect={openResult} questions={questions} />
          </View>

          <Text className="mt-auto pt-6 text-center text-sm text-ink-muted">
            뽑은 당근을 누르면 그날의 결과를 볼 수 있어요
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
