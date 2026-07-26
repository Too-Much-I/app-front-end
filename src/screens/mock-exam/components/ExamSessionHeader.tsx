import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";

export function ExamSessionHeader({ partNumber }: { partNumber: number }) {
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

      <View className="h-14">
        <View className="z-10 flex-1 items-center justify-center">
          <Text className="text-lg text-white">Part {partNumber}</Text>
        </View>
      </View>
    </View>
  );
}
