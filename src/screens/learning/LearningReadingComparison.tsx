import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { Pressable } from '@/components/ui/Pressable';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { colors, size } from '@/theme';
import { formatLearningTime, type LearningTake } from '@/features/learning/learning-progress';
import type { LearningAnswer, LearningMedia } from '@/features/learning/learning-types';
import { useLearningAudio } from '@/features/learning/use-learning-audio';

type RecordingKind = 'mine' | 'model';

export function LearningReadingComparison({
  answer,
  take,
  registerLeave,
  onHome,
  onRetake,
}: {
  answer: LearningAnswer;
  take: LearningTake | null;
  registerLeave: (leave: () => Promise<boolean>) => () => void;
  onHome: () => void;
  onRetake: () => void;
}) {
  // Both recordings share one player, including while a file is loading.
  const audio = useLearningAudio();
  const { play, stop } = audio;
  const [active, setActive] = useState<RecordingKind | null>(null);
  const [choice, setChoice] = useState<RecordingKind>('mine');
  const request = useRef(0);
  const selected = useRef<RecordingKind | null>(null);
  const invalidatePlayback = useCallback(() => {
    request.current++;
    selected.current = null;
    stop();
  }, [stop]);
  const stopPlayback = useCallback(() => {
    invalidatePlayback();
    setActive(null);
  }, [invalidatePlayback]);
  useEffect(
    () =>
      registerLeave(async () => {
        stopPlayback();
        return true;
      }),
    [registerLeave, stopPlayback],
  );
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') stopPlayback();
    });
    return () => {
      invalidatePlayback();
      listener.remove();
    };
  }, [invalidatePlayback, stopPlayback]);
  const startPlayback = async (kind: RecordingKind, source: number | string | LearningMedia) => {
    const id = ++request.current;
    selected.current = kind;
    setActive(kind);
    await play(source);
    if (request.current === id) {
      selected.current = null;
      setActive(null);
    }
  };
  const recordings = [
    { kind: 'mine', label: '내 녹음', source: take?.uri, seconds: take?.seconds ?? 0 },
    {
      kind: 'model',
      label: '모범 답안',
      source: answer.fullAudio,
      seconds: answer.durationSeconds ?? 0,
    },
  ] as const;
  const recording = recordings.find((item) => item.kind === choice)!;
  const sameSource = audio.position.source === recording.source;
  const elapsed = sameSource ? audio.position.seconds : 0;
  const total =
    sameSource && audio.position.duration > 0 ? audio.position.duration : recording.seconds;
  const running = active === choice && !audio.paused;
  const chooseRecording = (next: RecordingKind) => {
    if (next === choice) return;
    const nextRecording = recordings.find((item) => item.kind === next)!;
    const continuePlaying = running;
    stopPlayback();
    setChoice(next);
    if (continuePlaying && nextRecording.source !== undefined)
      void startPlayback(next, nextRecording.source);
  };
  const togglePlayback = () => {
    if (recording.source === undefined) return;
    if (active === choice) {
      if (audio.paused) {
        if (!audio.resume()) void startPlayback(choice, recording.source);
      } else audio.pause();
    } else void startPlayback(choice, recording.source);
  };
  return (
    <View className="min-h-0 flex-1">
      <View className="gap-xs px-screen pb-md pt-md">
        <Text className="text-xl font-semibold">녹음 비교</Text>
        <Text className="text-sm leading-5 text-ink-muted">지문을 보며 두 음성을 들어 보세요.</Text>
      </View>
      <View className="mx-screen min-h-0 flex-1 overflow-hidden rounded-card border border-learning-paperLine bg-surface">
        <ScrollView
          className="min-h-0 flex-1"
          contentContainerClassName="gap-md p-card"
          showsVerticalScrollIndicator
        >
          <Text className="text-base leading-7">{answer.example}</Text>
        </ScrollView>
        <View className="gap-md border-t border-learning-paperLine p-md">
          <SegmentedTabs
            items={recordings.map(({ kind, label }) => ({ value: kind, label }))}
            value={choice}
            onChange={chooseRecording}
            label="비교할 음성"
          />
          <View className="flex-row items-center gap-md">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${recording.label} ${running ? '일시정지' : audio.paused && active === choice ? '이어서 듣기' : '듣기'}`}
              disabled={recording.source === undefined}
              accessibilityState={{ disabled: recording.source === undefined }}
              style={{ width: size.control.md, height: size.control.md }}
              className={`items-center justify-center rounded-pill ${recording.source === undefined ? 'bg-line' : 'bg-brand-cta'}`}
              onPress={togglePlayback}
            >
              <Feather
                name={running ? 'pause' : 'play'}
                size={size.icon.lg}
                color={colors.surface.DEFAULT}
              />
            </Pressable>
            <View className="flex-1 gap-sm">
              <View
                className="h-1 overflow-hidden rounded-pill bg-learning-paperLine"
                accessible={false}
              >
                <View
                  className="h-full bg-brand"
                  style={{ width: `${total > 0 ? Math.min(100, (elapsed / total) * 100) : 0}%` }}
                />
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs tabular-nums text-ink-muted">
                  {formatLearningTime(elapsed)}
                </Text>
                <Text className="text-xs tabular-nums text-ink-muted">
                  {formatLearningTime(total)}
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${recording.label} 처음부터 듣기`}
              disabled={recording.source === undefined}
              accessibilityState={{ disabled: recording.source === undefined }}
              className="h-11 w-11 items-center justify-center rounded-pill"
              onPress={() => {
                if (recording.source !== undefined) void startPlayback(choice, recording.source);
              }}
            >
              <Feather name="rotate-ccw" size={size.icon.md} color={colors.ink.muted} />
            </Pressable>
          </View>
          {audio.error || recording.source === undefined ? (
            <Text accessibilityRole="alert" className="text-sm !text-brand-text">
              {audio.error ??
                (choice === 'mine'
                  ? '녹음 파일이 없어요. 다시 녹음해 주세요.'
                  : '모범 음성을 불러오지 못했어요.')}
            </Text>
          ) : null}
        </View>
      </View>
      <View className="gap-xs px-screen pb-sm pt-lg">
        <Button label="학습 홈으로 돌아가기" size="lg" onPress={onHome} />
        <Button label="다시 녹음하기" variant="text" onPress={onRetake} />
      </View>
    </View>
  );
}
