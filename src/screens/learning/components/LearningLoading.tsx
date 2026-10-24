import { ActivityIndicator, View } from 'react-native';

import { colors } from '@/theme';

/** 불러오는 중. 작은 원 하나만 돌린다(2026-10-23 결정). */
export function LearningLoading() {
  return (
    <View
      accessibilityLabel="불러오는 중"
      className="flex-1 items-center justify-center py-section"
    >
      <ActivityIndicator color={colors.brand.cta} />
    </View>
  );
}
