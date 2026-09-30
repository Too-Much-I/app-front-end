import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { colors } from '@/theme';

interface AuthRecoveryScreenProps {
  message: string;
  isRetrying: boolean;
  onRetry: () => Promise<void>;
  recoveryAction?: 'retry' | 'get-help';
  onHelp?: () => void;
  onCancel?: () => void;
}

export function AuthRecoveryScreen({
  message,
  isRetrying,
  onRetry,
  recoveryAction = 'retry',
  onHelp,
  onCancel,
}: AuthRecoveryScreenProps) {
  const handleRetry = async () => {
    if (isRetrying) return;
    await onRetry();
  };

  if (isRetrying) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-content bg-surface-subtle">
        <ActivityIndicator color={colors.brand.text} />
        <Text accessibilityLiveRegion="polite">로그인 정보를 다시 확인하고 있어요.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-subtle" edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center px-screen">
        <View className="w-full max-w-xl items-center rounded-card border border-line bg-surface p-xl">
          <Text className="text-center text-2xl">인증을 준비하지 못했어요</Text>
          <Text className="mt-md text-center text-sm leading-6 text-ink-muted">{message}</Text>
          {recoveryAction === 'retry' ? (
            <Button
              accessibilityLabel="인증 준비 다시 시도하기"
              className="mt-section w-full"
              label="다시 시도하기"
              size="lg"
              onPress={handleRetry}
            />
          ) : null}
          {onCancel ? (
            <Button
              className="mt-content w-full"
              label="로그인 화면으로"
              variant="text"
              onPress={onCancel}
            />
          ) : null}
          {onHelp ? (
            <Button
              className="mt-content w-full"
              label="도움받기"
              variant={recoveryAction === 'get-help' ? 'primary' : 'secondary'}
              onPress={onHelp}
            />
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
