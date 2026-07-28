import { ActivityIndicator, Image, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { colors } from "@/theme";

const retryMascot = require("../../../../public/mascots/waiting_rabbit.png");

interface GradingRetryNoticeProps {
  isRequesting: boolean;
  onRetry: () => void;
}

/** 최초 채점 실패나 3분 초과 뒤 한 번의 재요청을 제공한다. */
export function GradingRetryNotice({
  isRequesting,
  onRetry,
}: GradingRetryNoticeProps) {
  return (
    <View
      accessibilityLiveRegion="assertive"
      className="w-full max-w-xl items-center self-center rounded-2xl border border-brand-200 bg-surface p-6"
    >
      <Image
        accessible
        accessibilityLabel="채점 재요청을 안내하는 토끼 캐릭터"
        className="h-44 w-44"
        resizeMode="contain"
        source={retryMascot}
      />
      <Text className="mt-4 text-center text-xl text-brand-text">
        채점이 예상보다 오래 걸리고 있어요
      </Text>
      <Text className="mt-2 text-center text-sm leading-6 text-ink-muted">
        답변은 안전하게 보관돼 있어요. 채점을 한 번 다시 요청해주세요.
      </Text>
      <Pressable
        accessibilityHint="보관된 답변의 채점을 서버에 다시 요청합니다"
        accessibilityRole="button"
        accessibilityState={{ busy: isRequesting, disabled: isRequesting }}
        className={`mt-6 min-h-11 w-full flex-row items-center justify-center gap-2 rounded-2xl py-3.5 ${
          isRequesting ? "bg-brand-200" : "bg-brand-cta"
        }`}
        disabled={isRequesting}
        onPress={onRetry}
      >
        {isRequesting ? (
          <ActivityIndicator color={colors.surface.DEFAULT} size="small" />
        ) : null}
        <Text className="text-base text-white">
          {isRequesting ? "다시 요청하는 중이에요" : "채점 다시 요청하기"}
        </Text>
      </Pressable>
    </View>
  );
}
