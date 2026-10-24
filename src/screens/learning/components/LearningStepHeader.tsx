import { Feather } from '@expo/vector-icons';
import { View } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { colors, size } from '@/theme';

interface LearningStepHeaderProps {
  title: string;
  onClose: () => void;
  /** 문장 진행 점. 지금 문장만 길게 그린다. 없으면 그리지 않는다. */
  progress?: { current: number; total: number };
}

/** 학습 단계 화면 공통 머리. 닫으면 파트 화면으로 돌아간다. */
export function LearningStepHeader({ title, onClose, progress }: LearningStepHeaderProps) {
  return (
    <View className="h-16 flex-row items-center gap-sm px-lg">
      <Pressable
        accessibilityLabel="학습 닫기"
        accessibilityRole="button"
        className="h-11 w-11 items-center justify-center rounded-full"
        onPress={onClose}
      >
        <Feather name="x" size={size.icon.lg} color={colors.ink.DEFAULT} />
      </Pressable>
      <Text className="flex-1 text-lg" numberOfLines={1}>
        {title}
      </Text>
      {progress ? (
        <View
          accessibilityLabel={`문장 ${progress.total}개 중 ${progress.current + 1}번째`}
          className="flex-row items-center gap-xs pr-sm"
        >
          {Array.from({ length: progress.total }, (_, index) => (
            <View
              key={index}
              className={`h-2 rounded-full ${index === progress.current ? 'w-6 bg-brand' : 'w-2 bg-line'}`}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
