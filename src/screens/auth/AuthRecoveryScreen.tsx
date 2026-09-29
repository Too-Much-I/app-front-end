import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";

interface AuthRecoveryScreenProps {
  message: string;
  isRetrying: boolean;
  onRetry: () => Promise<void>;
  recoveryAction?: "retry" | "get-help";
  onHelp?: () => void;
}

export function AuthRecoveryScreen({
  message,
  isRetrying,
  onRetry,
  recoveryAction = "retry",
  onHelp,
}: AuthRecoveryScreenProps) {
  const handleRetry = async () => {
    if (isRetrying) return;
    await onRetry();
  };

  return (
    <SafeAreaView
      className="flex-1 bg-surface-subtle"
      edges={["top", "bottom"]}
    >
      <View className="flex-1 items-center justify-center px-screen">
        <View className="w-full max-w-xl items-center rounded-card border border-line bg-surface p-xl">
          <Text className="text-center text-2xl">인증을 준비하지 못했어요</Text>
          <Text className="mt-md text-center text-sm leading-6 text-ink-muted">
            {message}
          </Text>
          {recoveryAction === "retry" ? (
            <Button
              accessibilityLabel="인증 준비 다시 시도하기"
              className="mt-section w-full"
              label={isRetrying ? "다시 시도하는 중..." : "다시 시도하기"}
              loading={isRetrying}
              size="lg"
              onPress={handleRetry}
            />
          ) : null}
          {onHelp ? (
            <Button
              className="mt-content w-full"
              label="도움받기"
              variant={recoveryAction === "get-help" ? "primary" : "secondary"}
              onPress={onHelp}
            />
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
