import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import {
  buildPuzzlePieces,
  pressPuzzlePiece,
  scatterPuzzlePieces,
} from '@/features/learning/learning-puzzle';
import type { RootStackParamList } from '@/navigation/types';
import { LearningLessonFallback } from '@/screens/learning/components/LearningLessonFallback';
import { LearningStepHeader } from '@/screens/learning/components/LearningStepHeader';
import { PuzzleBoard } from '@/screens/learning/components/PuzzleBoard';
import { PuzzleMeaningMemo } from '@/screens/learning/components/PuzzleMeaningMemo';
import { PuzzleTrayPiece } from '@/screens/learning/components/PuzzleTrayPiece';
import { useLearningLesson } from '@/screens/learning/use-learning-lesson';
import { colors } from '@/theme';

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const puzzleRabbit = require('../../../public/mascots/puzzle_rabbit.png');

type LearningPuzzleScreenProps = NativeStackScreenProps<RootStackParamList, 'LearningPuzzle'>;

const GUIDE_MESSAGE = '퍼즐 조각을 눌러서 완성된 문장을 만들어 주세요';
/** 틀렸을 때도 문제처럼 굴지 않는다(2026-10-19 결정). 다음 조각이 반짝이니 그쪽을 가리킨다. */
const WRONG_MESSAGE = '그 조각은 조금 뒤에 와요. 반짝이는 조각부터 놓아 볼까요?';

/**
 * 학습 ① 조각 퍼즐.
 *
 * 한국어 뜻을 보고 모범답안 문장을 조각으로 맞춘다. 문장마다 판을 새로 깔고, 마지막 문장을 맞추면
 * ② 듣기·쉐도잉으로 넘어간다. 소리는 ②에서 듣는다.
 */
export function LearningPuzzleScreen({ navigation, route }: LearningPuzzleScreenProps) {
  const lookup = useLearningLesson(route.params);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [placedCount, setPlacedCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [lastWrongOrder, setLastWrongOrder] = useState<number | null>(null);

  const closeToParts = () => navigation.popTo('LearningParts', { level: route.params.level });

  if (lookup.status !== 'found') {
    return <LearningLessonFallback lookup={lookup} onClose={closeToParts} />;
  }

  const { detail, lesson } = lookup;
  const sentence = lesson.sentences[sentenceIndex];
  if (!sentence) {
    return <LearningLessonFallback lookup={{ status: 'missing' }} onClose={closeToParts} />;
  }

  const pieces = buildPuzzlePieces(sentence);
  const remaining = scatterPuzzlePieces(pieces).filter((piece) => piece.order >= placedCount);
  const completed = placedCount === pieces.length;
  const isLastSentence = sentenceIndex === lesson.sentences.length - 1;
  const hintActive = lastWrongOrder !== null;

  function pressPiece(order: number) {
    const result = pressPuzzlePiece(placedCount, pieces.length, order);
    if (result === 'wrong') {
      setWrongCount((count) => count + 1);
      setLastWrongOrder(order);
      return;
    }
    setPlacedCount((count) => count + 1);
    setLastWrongOrder(null);
  }

  function goNext() {
    if (isLastSentence) {
      navigation.navigate('LearningShadowing', route.params);
      return;
    }
    setSentenceIndex((index) => index + 1);
    setPlacedCount(0);
    setLastWrongOrder(null);
  }

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      className="flex-1"
      style={{ backgroundColor: colors.learningPuzzle.surface }}
    >
      <LearningStepHeader
        onClose={closeToParts}
        progress={{ current: sentenceIndex, total: lesson.sentences.length }}
        title={`${detail.unit.title} · Q${lesson.questionNumber}`}
      />

      <ScrollView contentContainerClassName="gap-section px-screen pb-section">
        <View className="flex-row items-end gap-sm">
          <Image
            accessibilityLabel="퍼즐 조각을 든 토끼"
            className="h-28 w-20"
            resizeMode="contain"
            source={puzzleRabbit}
          />
          <View className="mb-lg flex-1 rounded-card bg-surface p-card">
            <Text className="text-sm text-ink-muted">
              {hintActive ? WRONG_MESSAGE : GUIDE_MESSAGE}
            </Text>
          </View>
        </View>

        <PuzzleMeaningMemo text={sentence.translation ?? sentence.text} />

        <PuzzleBoard pieces={pieces} placedCount={placedCount} />

        <View className="flex-row flex-wrap justify-center gap-lg">
          {remaining.map((piece, slotIndex) => (
            <PuzzleTrayPiece
              key={piece.order}
              hinted={hintActive && piece.order === placedCount}
              piece={piece}
              shakeSignal={lastWrongOrder === piece.order ? wrongCount : 0}
              slotIndex={slotIndex}
              onPress={() => pressPiece(piece.order)}
            />
          ))}
        </View>
      </ScrollView>

      {completed ? (
        <View className="px-screen pb-lg">
          <Pressable
            accessibilityRole="button"
            className="min-h-control-lg items-center justify-center rounded-control bg-brand-cta"
            onPress={goNext}
          >
            <Text className="text-lg text-surface">
              {isLastSentence ? '듣고 따라 말하기' : '다음 문장'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
