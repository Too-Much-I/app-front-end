import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/features/auth/auth-context";

export function AuthRecoveryScreen() {
  const { retry, state } = useAuth();
  const isRetrying = state.status === "RETRYABLE_ERROR" && state.isRetrying === true;
  const message =
    state.status === "RETRYABLE_ERROR"
      ? state.message
      : "인증 상태를 다시 확인하고 있습니다.";

  const handleRetry = async () => {
    if (isRetrying) {
      return;
    }
    await retry();
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-subtle" edges={["top", "bottom"]}>
      <View className="flex-1 items-center justify-center px-screen">
        <View className="w-full max-w-xl items-center rounded-card border border-line bg-surface p-6">
          <Text className="text-center text-2xl">인증을 준비하지 못했어요</Text>
          <Text className="mt-3 text-center text-sm leading-6 text-ink-muted">{message}</Text>
          <Button
            accessibilityLabel="인증 준비 다시 시도하기"
            className="mt-section w-full"
            label={isRetrying ? "다시 시도하는 중..." : "다시 시도하기"}
            loading={isRetrying}
            size="lg"
            onPress={handleRetry}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
