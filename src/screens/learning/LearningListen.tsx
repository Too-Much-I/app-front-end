import { useEffect } from 'react';
import type { LearningProgress } from '@/features/learning/learning-progress';
import { getLearningPlaybackWordStates } from '@/features/learning/learning-playback-words';
import { LearningWordBoxes } from '@/screens/learning/LearningWordBoxes';
import type { LearningAnswer, LearningLesson } from '@/features/learning/learning-types';
import { useLearningListening } from '@/features/learning/use-learning-listening';
import { LearningControls } from '@/screens/learning/LearningControls';
import { LearningFrame } from '@/screens/learning/LearningFrame';

export function LearningListen({
  lesson,
  answer,
  onNext,
  active = true,
  initial,
  onProgress,
  registerLeave,
}: {
  lesson: LearningLesson;
  answer: LearningAnswer;
  onNext: () => void;
  active?: boolean;
  initial: LearningProgress['listen'];
  onProgress: (value: LearningProgress['listen']) => void;
  registerLeave: (leave: () => Promise<boolean>) => () => void;
}) {
  const { index, seconds, running, error, pause, resume, move } = useLearningListening(
    answer.sentences,
    active,
    onNext,
    initial,
    onProgress,
  );
  useEffect(
    () =>
      registerLeave(async () => {
        pause();
        return true;
      }),
    [pause, registerLeave],
  );
  const last = index === answer.sentences.length - 1;
  const sentence = answer.sentences[index];
  return (
    <>
      <LearningFrame
        translation={{ english: sentence.text, text: sentence.translation, key: String(index) }}
        onSourceOpen={pause}
        lesson={lesson}
        stage="listen"
        label="현재 문장"
        progress={{ current: index + 1, total: answer.sentences.length }}
      >
        <LearningWordBoxes
          key={index}
          words={sentence.words.map((word) => word.text)}
          states={getLearningPlaybackWordStates(sentence.words, seconds)}
        />
      </LearningFrame>
      <LearningControls
        message={
          error ??
          (running
            ? '문장을 듣고 말하는 흐름을 익혀요.'
            : '재생 버튼을 누르면 끝까지 이어서 들어요.')
        }
        primary={{
          label: running ? '듣기 일시정지' : '답변 듣기',
          icon: running ? 'pause' : 'play',
          onPress: () => {
            if (running) pause();
            else resume();
          },
        }}
        left={{
          label: '이전 문장',
          icon: 'skip-back',
          onPress: () => move(-1),
          disabled: index === 0,
        }}
        right={{
          label: last
            ? lesson.part === 1
              ? '따라 읽기로 이동'
              : '따라 말하기로 이동'
            : '다음 문장',
          caption: last ? (lesson.part === 1 ? '따라 읽기' : '따라 말하기') : '다음 문장',
          icon: 'skip-forward',
          onPress: () => move(1),
        }}
      />
    </>
  );
}
