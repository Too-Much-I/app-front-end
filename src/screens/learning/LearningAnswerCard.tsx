import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { AudioWaveform } from '@/features/audio/components/AudioWaveform';
import { formatLearningTime } from '@/features/learning/learning-progress';
import { colors, size } from '@/theme';

export type LearningAnswerCardState =
  | { kind: 'ready' }
  | { kind: 'busy'; message: string }
  | { kind: 'retry'; message: string }
  | { kind: 'recording'; seconds: number; limit: number; meteringDb: number | null }
  | {
      kind: 'recorded';
      seconds: number;
      position: number;
      playing: boolean;
      paused: boolean;
      onPlayback: () => void;
    };

function LearningAnswerCardContent({ state }: { state: LearningAnswerCardState }) {
  switch (state.kind) {
    case 'ready':
      return (
        <View className="flex-1 justify-center gap-xs">
          <Text className="text-base leading-6">이제 내 말로 답해 보세요.</Text>
          <Text className="text-sm leading-5 text-ink-muted">
            배운 표현을 떠올리며 편하게 말해 보세요.
          </Text>
        </View>
      );
    case 'busy':
      return (
        <View className="flex-1 flex-row items-center justify-center gap-sm">
          <ActivityIndicator color={colors.brand.text} />
          <Text className="text-sm text-ink-muted">{state.message}</Text>
        </View>
      );
    case 'retry':
      return (
        <View className="flex-1 justify-center">
          <Text className="text-sm leading-5 text-ink-muted">{state.message}</Text>
        </View>
      );
    case 'recording':
      return (
        <View className="flex-1 items-center justify-center gap-xs">
          <AudioWaveform active meteringDb={state.meteringDb} variant="learning" />
          <Text className="text-xs text-ink-muted">말을 마치면 아래 정지 버튼을 눌러 주세요.</Text>
        </View>
      );
    case 'recorded': {
      const position = Math.max(0, Math.min(state.seconds, state.position));
      const percent = state.seconds > 0 ? (position / state.seconds) * 100 : 0;
      return (
        <View className="flex-1 justify-center gap-sm">
          <View className="flex-row items-center gap-md">
            <Button
              label={state.playing ? '일시정지' : state.paused ? '이어 듣기' : '재생'}
              accessibilityLabel={state.playing ? '내 답변 일시정지' : '내 답변 재생'}
              variant="neutral"
              size="sm"
              onPress={state.onPlayback}
              renderIcon={({ size: iconSize, color }) => (
                <Feather name={state.playing ? 'pause' : 'play'} size={iconSize} color={color} />
              )}
            />
            <View className="flex-1 gap-sm">
              <View
                accessibilityRole="progressbar"
                accessibilityLabel="내 답변 재생 위치"
                accessibilityValue={{ min: 0, max: state.seconds, now: position }}
                className="h-1 overflow-hidden rounded-pill bg-line"
              >
                <View className="h-full rounded-pill bg-brand" style={{ width: `${percent}%` }} />
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs tabular-nums text-ink-muted">
                  {formatLearningTime(position)}
                </Text>
                <Text className="text-xs tabular-nums text-ink-muted">
                  {formatLearningTime(state.seconds)}
                </Text>
              </View>
            </View>
          </View>
          <Text className="text-xs text-ink-muted">내 답변을 듣고 한 번 더 연습해 보세요.</Text>
        </View>
      );
    }
  }
}

export function LearningAnswerCard({ state }: { state: LearningAnswerCardState }) {
  return (
    <View className="gap-sm rounded-card border border-learning-paperLine bg-surface p-card">
      <View className="flex-row items-center justify-between gap-sm">
        <View className="flex-row items-center gap-sm">
          <Feather name="mic" size={size.icon.sm} color={colors.ink.muted} />
          <Text className="text-sm font-semibold">내 답변</Text>
        </View>
        {state.kind === 'recording' ? (
          <View className="flex-row items-center gap-xs">
            <View className="h-1.5 w-1.5 rounded-pill bg-brand" />
            <Text className="text-xs !text-brand-text">녹음 중</Text>
            <Text className="text-xs tabular-nums text-ink-muted">
              {formatLearningTime(state.seconds)} / {formatLearningTime(state.limit)}
            </Text>
          </View>
        ) : state.kind === 'recorded' ? (
          <Text className="text-xs text-ink-muted">
            {state.playing ? '재생 중' : '녹음한 답변'}
          </Text>
        ) : null}
      </View>
      {/* Reserve only a compact body; long questions can use the rest of the scroll area. */}
      <View className="min-h-20">
        <LearningAnswerCardContent state={state} />
      </View>
    </View>
  );
}
