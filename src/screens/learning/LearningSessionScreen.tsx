import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import type { RootStackParamList } from '@/navigation/types';
import { LEVEL_CARDS } from '@/screens/learning/learning-level-cards';
import { LEARNING_PART_ROWS } from '@/screens/learning/learning-parts';
import { colors, size } from '@/theme';

type LearningSessionScreenProps = NativeStackScreenProps<RootStackParamList, 'LearningSession'>;

/**
 * 학습 화면 자리.
 *
 * 퍼즐·쉐도잉 화면은 아직 없다. 등급과 파트가 이 화면까지 제대로 넘어오는지만 보이게 해 둔다.
 */
export function LearningSessionScreen({ navigation, route }: LearningSessionScreenProps) {
  const { level, part } = route.params;
  const partRow = LEARNING_PART_ROWS.find((row) => row.part === part);

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface-subtle">
      <View className="h-16 flex-row items-center px-screen">
        <Pressable
          accessibilityLabel="뒤로 가기"
          accessibilityRole="button"
          className="h-10 w-10 items-center justify-center rounded-full"
          hitSlop={8}
          onPress={navigation.goBack}
        >
          <Feather name="arrow-left" size={size.icon.lg} color={colors.ink.DEFAULT} />
        </Pressable>
      </View>
      <View className="flex-1 items-center justify-center gap-content px-screen">
        <Text className="text-xl">
          Part {part} · {partRow?.name}
        </Text>
        <Text className="text-sm text-ink-muted">
          {LEVEL_CARDS[level].label} ({level}) 학습 화면은 준비 중이에요
        </Text>
      </View>
    </SafeAreaView>
  );
}
