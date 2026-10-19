import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import type { RootStackParamList } from '@/navigation/types';
import { LEVEL_CARDS } from '@/screens/learning/learning-level-cards';
import { LEARNING_PART_ROWS } from '@/screens/learning/learning-parts';
import { colors, shadows, size } from '@/theme';

type LearningPartsScreenProps = NativeStackScreenProps<RootStackParamList, 'LearningParts'>;

/**
 * 학습 파트 고르기.
 *
 * 등급은 앞 화면에서 고른 값을 route로 받아 그대로 다음 화면에 넘긴다. 진행률은 서버 응답이 없어서
 * 보여 주지 않는다(2026-10-19 결정).
 */
export function LearningPartsScreen({ navigation, route }: LearningPartsScreenProps) {
  const { level } = route.params;
  const card = LEVEL_CARDS[level];

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface-subtle">
      <View className="h-16 flex-row items-center justify-between px-screen">
        <Pressable
          accessibilityLabel="뒤로 가기"
          accessibilityRole="button"
          className="h-10 w-10 items-center justify-center rounded-full"
          hitSlop={8}
          onPress={navigation.goBack}
        >
          <Feather name="arrow-left" size={size.icon.lg} color={colors.ink.DEFAULT} />
        </Pressable>
        {/* 등급은 이 화면에서 바꾸지 않는다. 바꾸려면 카드 화면으로 돌아가 다시 고른다. */}
        <Pressable
          accessibilityHint="등급 카드 화면으로 돌아갑니다"
          accessibilityLabel={`목표 ${card.label}, 바꾸기`}
          accessibilityRole="button"
          className="min-h-control-sm justify-center rounded-pill px-md"
          style={{ backgroundColor: card.color }}
          onPress={navigation.goBack}
        >
          <Text className="text-sm">목표 {card.label} · 바꾸기</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="gap-element px-screen pb-section">
        <View className="mb-content gap-xs">
          <Text accessibilityRole="header" className="text-2xl">
            어떤 파트를 연습할까요?
          </Text>
          <Text className="text-sm text-ink-muted">모든 연습이 {card.label} 답변으로 나와요</Text>
        </View>

        {LEARNING_PART_ROWS.map((row) => (
          <Pressable
            key={row.part}
            accessibilityHint="이 파트의 학습 화면으로 이동합니다"
            accessibilityLabel={`Part ${row.part} ${row.name}. ${row.description}`}
            accessibilityRole="button"
            className="flex-row items-center gap-md rounded-card bg-surface p-card"
            style={shadows.card}
            onPress={() => navigation.navigate('LearningSession', { level, part: row.part })}
          >
            <View className="h-12 w-12 items-center justify-center rounded-control bg-surface-subtle">
              <Feather name={row.icon} size={size.icon.md} color={colors.brand.text} />
            </View>
            <View className="flex-1 gap-xs">
              <View className="flex-row items-center gap-sm">
                <Text className="text-xs text-ink-muted">
                  Part {row.part} · {row.questions}
                </Text>
                {row.sharedAcrossLevels ? (
                  <View className="rounded-chip bg-surface-muted px-sm">
                    <Text className="text-xs text-ink-muted">등급 공통</Text>
                  </View>
                ) : null}
              </View>
              <Text className="text-lg">{row.name}</Text>
              <Text className="text-xs text-ink-muted">{row.description}</Text>
            </View>
            <Feather name="chevron-right" size={size.icon.md} color={colors.ink.disabled} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
