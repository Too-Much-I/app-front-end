import { Feather } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { colors } from "@/theme";

export type SettingsIconName = ComponentProps<typeof Feather>["name"];

type SettingsRowProps = {
  icon: SettingsIconName;
  title: string;
  description?: string;
  /** 없으면 누를 수 없는 정보 행(예: 버전 정보)으로 렌더링된다. */
  onPress?: () => void;
  trailing?: ReactNode;
  destructive?: boolean;
  showDivider?: boolean;
};

const DEFAULT_TRAILING = (
  <Feather name="chevron-right" size={20} color={colors.ink.disabled} />
);

export function SettingsRow({
  icon,
  title,
  description,
  onPress,
  trailing = DEFAULT_TRAILING,
  destructive = false,
  showDivider = true,
}: SettingsRowProps) {
  const badgeBackground = destructive ? colors.feedback.improvementSoft : colors.brand[100];
  const badgeColor = destructive ? colors.feedback.improvement : colors.brand.DEFAULT;
  const titleColor = destructive ? colors.feedback.improvement : colors.ink.DEFAULT;
  const rowClassName = `flex-row items-center gap-3 py-4 ${
    showDivider ? "border-b border-line" : ""
  }`;

  const content = (
    <>
      <View
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: badgeBackground }}
      >
        <Feather name={icon} size={18} color={badgeColor} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-base" style={{ color: titleColor }}>
          {title}
        </Text>
        {description ? (
          <Text className="mt-1 text-xs text-ink-muted">{description}</Text>
        ) : null}
      </View>
      {trailing}
    </>
  );

  if (!onPress) {
    return <View className={rowClassName}>{content}</View>;
  }

  return (
    <Pressable accessibilityLabel={title} className={rowClassName} onPress={onPress}>
      {content}
    </Pressable>
  );
}
