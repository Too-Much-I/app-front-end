import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import {
  getMockLearningGrade,
  markMockLearningLessonCompleted,
} from '@/features/learning/learning-mock-source';
import type { RootStackParamList } from '@/navigation/types';
import { LearningLessonFallback } from '@/screens/learning/components/LearningLessonFallback';
import { LearningPaperCard } from '@/screens/learning/components/LearningPaperCard';
import { LearningStepHeader } from '@/screens/learning/components/LearningStepHeader';
import { useLearningLesson } from '@/screens/learning/use-learning-lesson';
import type { LearningGradeResult, LearningVerdict } from '@/types/learning';
import { colors, shadows, size } from '@/theme';

type LearningGradingScreenProps = NativeStackScreenProps<RootStackParamList, 'LearningGrading'>;

type GradingState =
  { status: 'ready' } | { status: 'grading' } | { status: 'graded'; result: LearningGradeResult };

/** 실제 채점은 상태 조회를 1.2초 간격으로 몇 번 돈다. 목에서는 한 번 기다리는 척만 한다. */
const MOCK_GRADING_MS = 1200;

const VERDICT_CHIPS = {
  met: {
    label: '지켰어요',
    surface: colors.challenge.mint.surface,
    text: colors.challenge.mint.text,
  },
  not_met: { label: '아쉬워요', surface: colors.brand[100], text: colors.brand.text },
  uncertain: { label: '잘 모르겠어요', surface: colors.surface.muted, text: colors.ink.muted },
} as const satisfies Record<LearningVerdict, { label: string; surface: string; text: string }>;

/**
 * 학습 ③ 실전처럼 답해 보기 + 채점 결과(시안 G2 토선생의 한마디).
 *
 * 녹음 없이 버튼을 누르면 목데이터의 채점 결과를 보여 준다. 결과가 나오면 서버처럼 이 문항을 완료로 남기고,
 * 같은 세트에 다음 문항이 있으면 그 문항의 퍼즐부터 다시 시작한다.
 */
export function LearningGradingScreen({ navigation, route }: LearningGradingScreenProps) {
  const lookup = useLearningLesson(route.params);
  const [state, setState] = useState<GradingState>({ status: 'ready' });
  const { level, part, lessonId } = route.params;

  useEffect(() => {
    if (state.status !== 'grading') return undefined;
    const timer = setTimeout(() => {
      // Part 2~5 완료는 채점이 끝날 때 서버가 남긴다.
      markMockLearningLessonCompleted(lessonId, part, level);
      setState({ status: 'graded', result: getMockLearningGrade() });
    }, MOCK_GRADING_MS);
    return () => clearTimeout(timer);
  }, [state.status, lessonId, part, level]);

  const closeToParts = () => navigation.popTo('LearningParts', { level });

  if (lookup.status !== 'found') {
    return <LearningLessonFallback lookup={lookup} onClose={closeToParts} />;
  }
  const { lesson, nextLesson } = lookup;

  function goNextLesson() {
    closeToParts();
    if (nextLesson) {
      navigation.navigate('LearningPuzzle', { ...route.params, lessonId: nextLesson.id });
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface-subtle">
      <LearningStepHeader onClose={closeToParts} title="토선생의 한마디" />

      <ScrollView contentContainerClassName="gap-section px-screen pb-section pt-sm">
        {state.status === 'graded' ? (
          <GradeResult result={state.result} />
        ) : (
          <LearningPaperCard label={`Q${lesson.questionNumber} 질문`} tone="sky">
            <Text className="text-base leading-7">{lesson.question}</Text>
            {lesson.questionTranslation ? (
              <Text className="mt-sm text-sm text-ink-muted">{lesson.questionTranslation}</Text>
            ) : null}
          </LearningPaperCard>
        )}
      </ScrollView>

      <View className="gap-sm px-screen pb-lg">
        {state.status === 'graded' ? (
          <>
            <Pressable
              accessibilityRole="button"
              className="min-h-control-lg items-center justify-center rounded-control border border-line bg-surface"
              onPress={() => setState({ status: 'ready' })}
            >
              <Text className="text-base">다시 녹음</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              className="min-h-control-lg items-center justify-center rounded-control bg-brand-cta"
              onPress={goNextLesson}
            >
              <Text className="text-lg text-surface">
                {nextLesson ? `Q${nextLesson.questionNumber}로 넘어가기` : '세트 끝내기'}
              </Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            className="min-h-control-lg flex-row items-center justify-center gap-sm rounded-control bg-brand-cta"
            disabled={state.status === 'grading'}
            onPress={() => setState({ status: 'grading' })}
          >
            {state.status === 'grading' ? (
              <ActivityIndicator color={colors.surface.DEFAULT} />
            ) : (
              <Feather name="mic" size={size.icon.md} color={colors.surface.DEFAULT} />
            )}
            <Text className="text-lg text-surface">
              {state.status === 'grading' ? '채점하고 있어요' : '답하고 채점받기'}
            </Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

function GradeResult({ result }: { result: LearningGradeResult }) {
  return (
    <>
      <View>
        <View
          className="rounded-card p-card"
          style={[shadows.card, { backgroundColor: colors.challenge.verdict }]}
        >
          <View className="items-center gap-sm rounded-2xl bg-surface p-lg">
            <Text className="text-center text-xl">
              {result.metCount}/{result.totalCount} 지켰어요!
            </Text>
            <Text className="text-xs text-ink-muted">
              답변 체크리스트예요. 공식 점수가 아니에요
            </Text>
          </View>
        </View>
        {/* 판정 카드 모서리의 별 스티커. */}
        <View className="absolute -left-2 -top-3" style={{ transform: [{ rotate: '-12deg' }] }}>
          <Feather name="star" size={size.icon.xl} color={colors.challenge.star} />
        </View>
      </View>

      <LearningPaperCard label="체크리스트" tone="sky">
        <View className="gap-md">
          {result.items.map((item) => {
            const chip = VERDICT_CHIPS[item.verdict];
            return (
              <View key={item.id} className="flex-row items-start gap-sm">
                <View
                  className="rounded-chip px-sm py-xs"
                  style={{ backgroundColor: chip.surface }}
                >
                  <Text className="text-xs" style={{ color: chip.text }}>
                    {chip.label}
                  </Text>
                </View>
                <View className="flex-1 gap-xs">
                  <Text className="text-base">{item.label}</Text>
                  <Text className="text-xs text-ink-muted">{item.feedback}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </LearningPaperCard>

      <LearningPaperCard label="내 답변" tone="mint">
        <Text className="text-base leading-7">{result.transcript}</Text>
      </LearningPaperCard>
    </>
  );
}
