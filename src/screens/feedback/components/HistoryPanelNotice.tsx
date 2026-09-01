import { ActivityIndicator, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { colors } from "@/theme";

/**
 * 두 탭이 목록 대신 보여주는 화면 둘. 늘 같이 바뀌므로 한 파일에 둔다 —
 * 로딩과 안내는 "패널이 아직/결국 목록을 못 그린 상태"라는 한 가지를 나눠 맡는다.
 */

/** onAction이 없으면 빈 상태, 있으면 되돌릴 수 있는 오류 상태다. */
export function HistoryPanelNotice({
  title,
  description,
  actionLabel,
  onAction,
  actionHint,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHint?: string;
}) {
  return (
    <View className="mt-16 items-center px-6">
      <Text accessibilityRole="header" className="text-center text-lg">
        {title}
      </Text>
      <Text className="mt-2 text-center text-sm leading-6 text-ink-muted">
        {description}
      </Text>
      {actionLabel && onAction && (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityHint={actionHint}
          className="mt-5 rounded-full bg-brand px-6 py-3"
          onPress={onAction}
        >
          <Text className="text-base text-white">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function HistoryPanelLoading() {
  return (
    <View className="mt-16 items-center">
      <ActivityIndicator color={colors.brand.DEFAULT} size="large" />
    </View>
  );
}
