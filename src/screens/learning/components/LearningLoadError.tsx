import { Image, View } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const errorRabbit = require('../../../../public/mascots/error.png');

interface LearningLoadErrorProps {
  message?: string;
  /** 다시 받아도 소용없는 실패는 다른 행동(파트로 돌아가기)을 건다. */
  actionLabel?: string;
  onRetry: () => void;
}

/**
 * 불러오지 못했을 때. 네트워크·401·세트 없음을 나누지 않고 토끼와 다시 불러오기를 준다(2026-10-23 결정).
 * 토끼는 웹 오류 화면과 같은 그림이다.
 */
export function LearningLoadError({
  message = '학습 내용을 불러오지 못했어요',
  actionLabel = '다시 불러오기',
  onRetry,
}: LearningLoadErrorProps) {
  return (
    <View className="flex-1 items-center justify-center gap-lg px-screen py-section">
      <Image
        accessibilityElementsHidden
        className="h-40 w-40"
        resizeMode="contain"
        source={errorRabbit}
      />
      <Text className="text-center text-base text-ink-muted">{message}</Text>
      <Pressable
        accessibilityRole="button"
        className="min-h-control-lg items-center justify-center self-stretch rounded-control bg-brand-cta"
        onPress={onRetry}
      >
        <Text className="text-lg text-surface">{actionLabel}</Text>
      </Pressable>
    </View>
  );
}
