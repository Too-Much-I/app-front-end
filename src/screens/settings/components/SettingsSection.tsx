import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "@/components/ui/Text";
import { shadows } from "@/theme";

type SettingsSectionProps = {
  title: string;
  children: ReactNode;
};

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <View className="mt-section">
      <Text accessibilityRole="header" className="text-lg">
        {title}
      </Text>
      <View
        className="mt-element overflow-hidden rounded-card border border-line bg-surface px-4"
        style={shadows.card}
      >
        {children}
      </View>
    </View>
  );
}
