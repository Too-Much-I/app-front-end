import { View } from "react-native";

import { Text } from "@/components/ui/Text";

export function MockExamScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-surface">
      <Text className="text-lg">모의고사</Text>
    </View>
  );
}
