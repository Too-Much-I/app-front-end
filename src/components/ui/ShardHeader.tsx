import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { colors } from "@/theme";

interface ShardHeaderAction {
  icon: ComponentProps<typeof Feather>["name"];
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress: () => void;
}

interface ShardHeaderProps {
  title: string;
  leftAction?: ShardHeaderAction;
}

/**
 * 주황 바탕을 네이비 조각이 비스듬히 가로지르는 헤더.
 *
 * 응시 화면과 재답변 화면이 같은 띠를 쓰므로 조각의 각도·크기를 여기 한 곳에서만 잡는다.
 * 조각은 오른쪽 위 모서리 밖에서 시작해 헤더를 벗어나므로 `overflow-hidden`으로 잘라낸다.
 */
export function ShardHeader({ title, leftAction }: ShardHeaderProps) {
  const { top: topInset } = useSafeAreaInsets();

  return (
    <View className="overflow-hidden bg-brand-cta" style={{ paddingTop: topInset }}>
      <View
        accessibilityElementsHidden
        className="absolute -right-12 w-52 bg-exam-navy"
        pointerEvents="none"
        style={{
          height: topInset + 248,
          top: -96,
          transform: [{ rotate: "-14deg" }],
        }}
      />

      <View className="h-14 justify-center">
        {leftAction ? (
          <Pressable
            accessibilityHint={leftAction.accessibilityHint}
            accessibilityLabel={leftAction.accessibilityLabel}
            accessibilityRole="button"
            className="absolute left-3 z-20 h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/15"
            onPress={leftAction.onPress}
          >
            <Feather name={leftAction.icon} size={23} color={colors.surface.DEFAULT} />
          </Pressable>
        ) : null}

        <View className="z-10 flex-1 items-center justify-center">
          <Text accessibilityRole="header" className="text-lg text-white">
            {title}
          </Text>
        </View>
      </View>
    </View>
  );
}
