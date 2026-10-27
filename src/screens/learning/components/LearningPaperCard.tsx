import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, shadows } from '@/theme';

/**
 * 챌린지 결과 화면의 문장 카드와 같은 종이 톤 카드(2026-10-22 시안 S2·G2).
 *
 * 챌린지의 `ChallengeSentenceCard`를 그대로 가져다 쓰지 않은 이유: 화면 영역끼리는 서로 import하지 않는다
 * (`check:architecture`). 공용으로 올리면 챌린지 쪽 코드도 함께 바뀌어 이번 범위를 넘는다.
 */
const TONES = {
  /** 들을 문장 · 체크리스트처럼 "이렇게 말할 수 있다" 쪽. */
  sky: {
    surface: colors.sky.surface,
    label: colors.sky.line,
    text: colors.sky.text,
    tape: colors.challenge.confetti.sky,
  },
  /** 내 문장 · 내 답변처럼 "내가 말한 것" 쪽. */
  mint: {
    surface: colors.challenge.mint.surface,
    label: colors.challenge.mint.label,
    text: colors.challenge.mint.text,
    tape: colors.challenge.confetti.mint,
  },
} as const;

const PUNCH_HOLE_COUNT = 3;

interface LearningPaperCardProps {
  tone: keyof typeof TONES;
  label: string;
  hint?: string;
  children: ReactNode;
}

export function LearningPaperCard({ tone, label, hint, children }: LearningPaperCardProps) {
  const palette = TONES[tone];

  return (
    <View>
      <View
        className="overflow-hidden rounded-card"
        style={[shadows.card, { backgroundColor: palette.surface }]}
      >
        <View className="absolute bottom-0 left-2 top-0 justify-around py-lg">
          {Array.from({ length: PUNCH_HOLE_COUNT }, (_, index) => (
            <View
              key={index}
              className="h-2.5 w-2.5 rounded-full border bg-surface-subtle"
              style={{ borderColor: colors.challenge.holeEdge }}
            />
          ))}
        </View>
        <View className="gap-sm py-lg pl-2xl pr-lg">
          <View className="flex-row items-center gap-sm">
            <View
              className="flex-row items-center gap-xs rounded-chip px-sm py-xs"
              style={{ backgroundColor: palette.label }}
            >
              <Feather color={palette.text} name="star" size={12} />
              <Text className="text-xs" style={{ color: palette.text }}>
                {label}
              </Text>
            </View>
            {hint ? (
              <Text className="flex-1 text-xs" style={{ color: palette.text }}>
                {hint}
              </Text>
            ) : null}
          </View>
          <View className="rounded-2xl bg-surface px-lg py-md">{children}</View>
        </View>
      </View>
      {/* 테이프 조각. 카드 위 가장자리에 비스듬히 붙어 종이를 붙여 둔 느낌을 준다. */}
      <View
        className="absolute -top-2 right-6 h-5 w-16"
        style={{ backgroundColor: palette.tape, opacity: 0.85, transform: [{ rotate: '7deg' }] }}
      />
    </View>
  );
}
