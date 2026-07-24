import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { colors } from "@/theme";

interface DeviceTestLayoutProps {
  children: ReactNode;
  currentStep: 1 | 2;
  onBack: () => void;
}

export function DeviceTestLayout({ children, currentStep, onBack }: DeviceTestLayoutProps) {
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface-subtle">
      <View className="h-16 flex-row items-center px-5">
        <Pressable
          accessibilityLabel="뒤로 가기"
          className="h-10 w-10 items-center justify-center rounded-full"
          hitSlop={8}
          onPress={onBack}
        >
          <MaterialCommunityIcons name="chevron-left" size={30} color={colors.ink.DEFAULT} />
        </Pressable>
        <Text className="flex-1 text-center text-xl">기기 테스트</Text>
        <Text
          accessibilityLabel={`전체 2단계 중 ${currentStep}단계`}
          className="w-10 text-right text-sm text-ink-muted"
        >
          {currentStep}/2
        </Text>
      </View>

      <ScrollView
        bounces={false}
        className="flex-1"
        contentContainerClassName="flex-grow px-5 pb-6 pt-2"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-6 flex-row justify-center gap-2">
          <View className="h-2 w-12 rounded-full bg-brand-cta" />
          <View className={`h-2 w-12 rounded-full ${currentStep === 2 ? "bg-brand-cta" : "bg-line"}`} />
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
