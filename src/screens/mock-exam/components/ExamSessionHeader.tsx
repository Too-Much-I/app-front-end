import { Feather } from "@expo/vector-icons";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { colors } from "@/theme";

interface ExamSessionHeaderProps {
  partNumber: number;
  onExit?: () => void;
}

export function ExamSessionHeader({ partNumber, onExit }: ExamSessionHeaderProps) {
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
        {onExit ? (
          <Pressable
            accessibilityHint="시험을 나갈지 확인합니다"
            accessibilityLabel="시험 나가기"
            accessibilityRole="button"
            className="absolute left-3 z-20 h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/15"
            onPress={onExit}
          >
            {/* 프레임을 빠져나가는 화살표 형태의 3번 아이콘 후보. */}
            <Feather name="log-out" size={23} color={colors.surface.DEFAULT} />
          </Pressable>
        ) : null}

        <View className="z-10 flex-1 items-center justify-center">
          <Text accessibilityRole="header" className="text-lg text-white">
            Part {partNumber}
          </Text>
        </View>
      </View>
    </View>
  );
}
