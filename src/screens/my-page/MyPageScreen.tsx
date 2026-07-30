import { Feather } from "@expo/vector-icons";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { Image, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import type { MainTabParamList } from "@/navigation/types";
import { colors, shadows } from "@/theme";

const feedbackMascot = require("../../../public/mascots/paper_rabbit.png");

type MyPageNavigationProp = BottomTabNavigationProp<MainTabParamList, "MyPage">;

export function MyPageScreen() {
  const navigation = useNavigation<MyPageNavigationProp>();

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface-subtle">
      <View className="mx-auto w-full max-w-3xl flex-1 px-5 pt-5">
        <Text accessibilityRole="header" className="text-3xl">마이페이지</Text>
        <Text className="mt-2 text-sm text-ink-muted">
          학습 기록과 피드백을 확인해보세요.
        </Text>

        <View
          className="mt-8 overflow-hidden rounded-3xl border border-line bg-surface p-5"
          style={shadows.card}
        >
          <View className="flex-row items-center gap-4">
            <Image
              source={feedbackMascot}
              className="h-28 w-20"
              resizeMode="contain"
              accessible={false}
            />
            <View className="min-w-0 flex-1">
              <Text className="text-xs" style={{ color: colors.feedback.positive }}>
                FEEDBACK
              </Text>
              <Text className="mt-1 text-xl">종합 피드백</Text>
              <Text className="mt-2 text-sm leading-6 text-ink-muted">
                모의고사를 완료하면 예상 총점과 파트별 분석을 확인할 수 있어요.
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityLabel="종합 피드백 화면 바로 보기"
            className="mt-5 flex-row items-center justify-center gap-2 rounded-2xl bg-brand-cta px-4 py-4"
            onPress={() => navigation.navigate("Feedback")}
          >
            <Text className="text-base text-white">피드백 바로 보기</Text>
            <Feather name="arrow-right" size={20} color={colors.surface.DEFAULT} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
