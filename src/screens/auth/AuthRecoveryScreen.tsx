import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/features/auth/auth-context";
import { colors } from "@/theme";

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
      <View className="flex-1 items-center justify-center px-5">
        <View className="w-full max-w-xl items-center rounded-3xl border border-line bg-surface p-6">
          <Text className="text-center text-2xl">인증을 준비하지 못했어요</Text>
          <Text className="mt-3 text-center text-sm leading-6 text-ink-muted">{message}</Text>
          <Pressable
            accessibilityLabel="인증 준비 다시 시도하기"
            accessibilityState={{ busy: isRetrying, disabled: isRetrying }}
            className="mt-6 min-h-14 w-full flex-row items-center justify-center gap-2 rounded-full bg-brand px-5"
            disabled={isRetrying}
            onPress={handleRetry}
          >
            {isRetrying ? <ActivityIndicator color={colors.surface.DEFAULT} /> : null}
            <Text className="text-base text-surface">
              {isRetrying ? "다시 시도하는 중..." : "다시 시도하기"}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
