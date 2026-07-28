import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";
import { useGradingStatus } from "@/features/exam/use-grading-status";
import type { MainTabParamList, MockExamStackParamList } from "@/navigation/types";
import { GradingFailedNotice } from "@/screens/mock-exam/components/GradingFailedNotice";
import { GradingRabbitBanner } from "@/screens/mock-exam/components/GradingRabbitBanner";
import { GradingRetryNotice } from "@/screens/mock-exam/components/GradingRetryNotice";
import { GradingSheet } from "@/screens/mock-exam/components/GradingSheet";
import { colors } from "@/theme";

type GradingWaitScreenProps = NativeStackScreenProps<
  MockExamStackParamList,
  "GradingWait"
>;

/**
 * 채점 대기 화면.
 *
 * 헤드라인·남은 시간·진행 바를 두지 않는다. 진행 상황은 채점표 위에 체크가
 * 하나씩 그어지는 것과 종이 머리의 "5개 중 n개 완료"로만 전달한다.
 *
 * 탭바는 숨기지 않는다. "화면을 벗어나도 채점은 계속돼요"라고 안내하는 이상
 * 실제로 빠져나갈 길이 있어야 한다. 대신 뒤로 가기 제스처는 막는다(스택 옵션) —
 * 뒤는 이미 끝난 응시 화면이라 돌아갈 곳이 아니다.
 */
export function GradingWaitScreen({ navigation, route }: GradingWaitScreenProps) {
  const { examId } = route.params;

  const goToHome = useCallback(() => {
    const tabNavigation = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
    navigation.popToTop();
    tabNavigation?.navigate("Home");
  }, [navigation]);

  const handleComplete = useCallback(() => {
    // 결과 화면이 아직 없어서 피드백 탭으로 보낸다. 채점 결과 화면이 생기면
    // 이 한 곳만 그 화면으로 바꾸면 된다.
    const tabNavigation = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
    navigation.popToTop();
    tabNavigation?.navigate("Feedback");
  }, [navigation]);

  const { phase, gradedPartCount, retry } = useGradingStatus(examId, handleComplete);

  const isRetryPhase = phase === "retry-ready" || phase === "retry-requesting";
  if (phase === "terminal-error" || isRetryPhase) {
    return (
      <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface-subtle">
        <ScrollView
          bounces={false}
          contentContainerClassName="flex-grow justify-center px-5 py-5"
          showsVerticalScrollIndicator={false}
        >
          {phase === "terminal-error" ? (
            <GradingFailedNotice onGoHome={goToHome} />
          ) : (
            <GradingRetryNotice
              isRequesting={phase === "retry-requesting"}
              onRetry={retry}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface-subtle">
      <GradingRabbitBanner />

      <View className="flex-1 px-5 pt-6">
        <GradingSheet gradedPartCount={gradedPartCount} />
      </View>

      {/* 안심시키는 한 줄이라 카드로 감싸지 않는다. 상자를 두르면 조용한 안내가
          아니라 눌러야 하는 것처럼 보인다. */}
      <View className="flex-row items-center justify-center gap-1.5 px-5 pb-5 pt-4">
        <MaterialCommunityIcons name="star" size={15} color={colors.brand.DEFAULT} />
        <Text className="text-sm text-ink-muted">화면을 벗어나도 채점은 계속돼요</Text>
      </View>
    </SafeAreaView>
  );
}
