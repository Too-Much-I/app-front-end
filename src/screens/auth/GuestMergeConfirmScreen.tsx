import { Feather } from '@expo/vector-icons';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { colors, size } from '@/theme';

interface GuestMergeConfirmScreenProps {
  onConfirm: () => void;
  /** 상단 취소 아이콘. 화면이 확인 대화상자를 띄운 뒤 로그인 화면으로 보낸다. */
  onCancel: () => void;
}

/**
 * 이 SNS 계정이 이미 회원일 때 학습 기록을 합칠지 확인한다. Safe area는 병합 흐름의 root가 소유한다.
 * 문구는 2026-10-05 사용자 결정. 되돌릴 수 없다는 안내는 넣지 않기로 했다.
 */
export function GuestMergeConfirmScreen({ onConfirm, onCancel }: GuestMergeConfirmScreenProps) {
  return (
    <View className="flex-1 bg-surface-subtle">
      <View className="min-h-control-lg flex-row items-center justify-end px-screen">
        <Pressable
          accessibilityLabel="학습 기록 합치기 취소"
          accessibilityRole="button"
          className="h-11 w-11 items-center justify-center"
          onPress={onCancel}
        >
          <Feather name="x" size={size.icon.lg} color={colors.ink.muted} />
        </Pressable>
      </View>
      <View className="flex-1 items-center justify-center px-screen">
        <View className="w-full max-w-xl items-center rounded-card border border-line bg-surface p-xl">
          <Text accessibilityRole="header" className="text-center text-2xl">
            지금까지의 학습 기록이 이 SNS 계정으로 옮겨져요
          </Text>
          <Text className="mt-md text-center text-sm leading-6 text-ink-muted">
            이제 여러 기기에 흩어져 있던 학습 기록을 한곳에서 확인할 수 있어요.
          </Text>
          <Button
            className="mt-section w-full"
            label="학습 기록 합치기"
            size="lg"
            onPress={onConfirm}
          />
        </View>
      </View>
    </View>
  );
}
