import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { getLearningHiddenWords } from '@/features/learning/learning-speech-match';
import type { LearningProgress } from '@/features/learning/learning-progress';
import type { LearningAnswer, LearningLesson } from '@/features/learning/learning-types';
import { useLearningAudio } from '@/features/learning/use-learning-audio';
import { useLearningRecognition } from '@/features/learning/use-learning-recognition';
import { LearningControls } from '@/screens/learning/LearningControls';
import { LearningFrame } from '@/screens/learning/LearningFrame';
import { LearningSpeechFeedback } from '@/screens/learning/LearningSpeechFeedback';
import { LearningShadowSuccess } from '@/screens/learning/LearningShadowSuccess';

// Reading time for the success notice, not a speaking limit or an animation duration.
const SUCCESS_FEEDBACK_HOLD_MS = 1100;

export function LearningShadow({
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
  initial: LearningProgress['shadow'];
  onProgress: (value: LearningProgress['shadow']) => void;
  registerLeave: (leave: () => Promise<boolean>) => () => void;
}) {
  const [position, setPosition] = useState({ index: initial.index, round: initial.round });
  const [hint, setHint] = useState<'none' | 'initials' | 'sentence'>('none');
  const [passed, setPassed] = useState(false);
  const accepted = useRef(new Set(initial.accepted));
  const saveRef = useRef(onProgress);
  saveRef.current = onProgress;
  const automatic = useRef(false);
  const moving = useRef(false);
  const mounted = useRef(true);
  const transition = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audio = useLearningAudio();
  const rounds = lesson.part === 1 ? 1 : 3;
  const sentence = answer.sentences[position.index];
  const attemptKey = `${lesson.id}:${position.index}:${position.round}`;
  const recognition = useLearningRecognition(() => {
    if (!automatic.current || !mounted.current || !active) return;
    accepted.current.add(position.index * rounds + position.round);
    saveRef.current({ ...position, accepted: [...accepted.current] });
    setPassed(true);
    transition.current = setTimeout(() => {
      transition.current = null;
      if (!automatic.current || !mounted.current) return;
      // Clear the previous transcript before revealing the next blank-word round.
      recognition.clearCompleted();
      setPassed(false);
      setHint('none');
      if (position.round + 1 < rounds) setPosition((p) => ({ ...p, round: p.round + 1 }));
      else if (position.index + 1 < answer.sentences.length)
        setPosition((p) => ({ index: p.index + 1, round: 0 }));
      else onNext();
    }, SUCCESS_FEEDBACK_HOLD_MS);
  });
  useEffect(() => {
    saveRef.current({ ...position, accepted: [...accepted.current] });
  }, [position]);
  const { start, cancel } = recognition;
  const statusRef = useRef(recognition.state.status);
  statusRef.current = recognition.state.status;
  const { stop } = audio;
  useEffect(() => {
    if (!active) {
      automatic.current = false;
      if (transition.current) clearTimeout(transition.current);
      transition.current = null;
      setPassed(false);
      stop();
      void cancel().catch(() => undefined);
    }
  }, [active, cancel, stop]);
  useEffect(() => {
    if (automatic.current) void start(sentence.text, attemptKey);
  }, [position, sentence.text, attemptKey, start]);
  useEffect(() => {
    mounted.current = true;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' || (next === 'inactive' && statusRef.current === 'preparing')) return;
      automatic.current = false;
      if (transition.current) clearTimeout(transition.current);
      transition.current = null;
      setPassed(false);
      stop();
      void cancel().catch(() => undefined);
    });
    return () => {
      mounted.current = false;
      if (transition.current) clearTimeout(transition.current);
      sub.remove();
    };
  }, [stop, cancel]);
  const { state } = recognition;
  const listening = state.status === 'listening' || state.status === 'finishing';
  const hidden = getLearningHiddenWords(sentence.text, hint === 'sentence' ? 0 : position.round);
  const pause = async (reset = false) => {
    automatic.current = false;
    if (transition.current) clearTimeout(transition.current);
    transition.current = null;
    setPassed(false);
    stop();
    await cancel({ preserveProgress: !reset });
  };
  const pauseRef = useRef(pause);
  pauseRef.current = pause;
  useEffect(
    () =>
      registerLeave(async () => {
        await pauseRef.current(true);
        return true;
      }),
    [registerLeave],
  );
  const begin = () => {
    automatic.current = true;
    stop();
    void start(sentence.text, attemptKey);
  };
  const replay = async () => {
    await pause();
    await audio.play(sentence.audio);
  };
  const last = position.index === answer.sentences.length - 1 && position.round === rounds - 1;
  const nextLabel =
    position.round + 1 < rounds
      ? ['일부 빈칸', '전체 빈칸'][position.round]
      : last
        ? lesson.part === 1
          ? '실전 읽기'
          : '실전 연습'
        : '다음 문장';
  const move = async (delta: number) => {
    if (moving.current) return;
    moving.current = true;
    try {
      await pause(true);
      if (!mounted.current) return;
      const step = position.index * rounds + position.round + delta;
      setHint('none');
      if (step >= answer.sentences.length * rounds) onNext();
      else if (step >= 0) setPosition({ index: Math.floor(step / rounds), round: step % rounds });
    } finally {
      moving.current = false;
    }
  };
  const hintLabel =
    position.round === 0
      ? '전체 문장'
      : hint === 'none'
        ? '힌트 보기'
        : hint === 'initials'
          ? '전체 문장'
          : '다시 가리기';
  return (
    <>
      <LearningFrame
        translation={{ english: sentence.text, text: sentence.translation, key: attemptKey }}
        onSourceOpen={async () => {
          await pause();
          return true;
        }}
        lesson={lesson}
        stage="shadow"
        highlighted={passed}
        feedback={
          passed ? (
            <LearningShadowSuccess nextLabel={nextLabel} displayMs={SUCCESS_FEEDBACK_HOLD_MS} />
          ) : undefined
        }
        label={
          lesson.part === 1
            ? '보고 따라 읽기'
            : ['전체 보기', '일부 빈칸', '전체 빈칸'][position.round]
        }
        progress={{ current: position.index + 1, total: answer.sentences.length }}
        round={lesson.part === 1 ? undefined : position.round}
        actions={
          <>
            <Button
              label={audio.playing ? '예시 정지' : '예시 듣기'}
              variant="text"
              size="sm"
              renderIcon={({ size, color }) => (
                <Feather name={audio.playing ? 'square' : 'headphones'} size={size} color={color} />
              )}
              onPress={() => {
                if (audio.playing) audio.stop();
                else void replay().catch(() => undefined);
              }}
            />
            {position.round > 0 ? (
              <Button
                label={hintLabel}
                variant="text"
                size="sm"
                accessibilityLabel={
                  hint === 'none'
                    ? '빈칸의 첫 글자 힌트 보기'
                    : hint === 'initials'
                      ? '전체 문장 보기'
                      : '힌트 가리기'
                }
                renderIcon={({ size, color }) => (
                  <Feather
                    name={hint === 'sentence' ? 'eye-off' : 'eye'}
                    size={size}
                    color={color}
                  />
                )}
                onPress={() =>
                  setHint((current) =>
                    current === 'none' ? 'initials' : current === 'initials' ? 'sentence' : 'none',
                  )
                }
              />
            ) : null}
          </>
        }
      >
        <LearningSpeechFeedback
          key={`${position.index}:${position.round}`}
          text={sentence.text}
          transcript={state.transcript}
          recognized={state.matched}
          hidden={hidden}
          showInitials={hint === 'initials'}
        />
        {state.status === 'unavailable' || state.status === 'denied' ? (
          <View className="mt-lg gap-sm">
            <Text className="text-sm leading-6 text-ink-muted">{state.message}</Text>
            <Button
              label="기기 설정 열기"
              variant="text"
              size="sm"
              onPress={() => void Linking.openSettings()}
            />
            <Button label="실전 연습으로 이동" variant="neutral" size="sm" onPress={onNext} />
          </View>
        ) : null}
      </LearningFrame>
      <LearningControls
        message={audio.error ?? state.message}
        primary={{
          caption:
            state.status === 'preparing'
              ? '준비 취소'
              : listening
                ? '말하는 중'
                : state.status === 'complete'
                  ? '통과'
                  : '말하기',
          label:
            state.status === 'preparing'
              ? '인식 준비 취소'
              : listening
                ? '말하기 일시정지'
                : '마이크 켜기',
          icon:
            state.status === 'preparing'
              ? 'x'
              : listening
                ? 'pause'
                : state.status === 'complete'
                  ? 'check'
                  : 'mic',
          onPress: () => {
            if (listening || state.status === 'preparing') void pause().catch(() => undefined);
            else begin();
          },
          disabled: state.status === 'complete',
        }}
        left={{
          caption: '이전 단계',
          label: '이전 단계',
          icon: 'skip-back',
          disabled: position.index === 0 && position.round === 0,
          onPress: () => void move(-1).catch(() => undefined),
        }}
        right={{
          caption: last ? (lesson.part === 1 ? '실전 읽기' : '실전 연습') : '건너뛰기',
          label: last
            ? lesson.part === 1
              ? '실전 읽기로 이동'
              : '실전 연습으로 이동'
            : '다음 연습으로 건너뛰기',
          icon: 'skip-forward',
          onPress: () => void move(1).catch(() => undefined),
        }}
      />
    </>
  );
}
