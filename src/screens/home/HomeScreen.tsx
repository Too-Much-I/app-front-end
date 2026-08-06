import { Feather } from "@expo/vector-icons";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation, type CompositeNavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Image, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Sparkle, type SparkleProps } from "@/components/ui/Sparkle";
import { StartMockExamButton } from "@/components/ui/StartMockExamButton";
import { Text } from "@/components/ui/Text";
import { TickingClock } from "@/components/ui/TickingClock";
import type { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { RecentFeedbackCard } from "@/screens/home/RecentFeedbackCard";
import { useRecentFeedback } from "@/screens/home/use-recent-feedback";
import { colors, shadows } from "@/theme";

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const logo = require("../../../public/logo.png");
const greetingMascot = require("../../../public/mascots/greeting_rabbit_bust.png");

/** 탭 안에서 루트 스택의 설정 화면으로 이동해야 하므로 두 내비게이터를 함께 쓴다. */
type HomeNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "Home">,
  NativeStackNavigationProp<RootStackParamList>
>;

/**
 * 인사 섹션 전체(텍스트+마스코트)에 흩뿌리는 반짝임들.
 * 마스코트를 감싸는 링이 아니라 목업처럼 텍스트 위/토끼 위/텍스트 아래에
 * 떨어뜨리는 배치이고, 텍스트+이미지를 함께 감싸는 `relative` 박스 기준 좌표다.
 * 뒤쪽 2개는 토끼 귀 뒤로 살짝 떨어진 자리에 얹는 보조 반짝임.
 */
const GREETING_SPARKLES: SparkleProps[] = [
  { className: "left-12 top-0", size: "xl", colorClassName: "text-sky-300" },
  { className: "right-10 top-2", size: "2xl", colorClassName: "text-brand-300" },
  { className: "top-16 left-16", size: "lg", colorClassName: "text-yellow-300" },
  { className: "right-2 top-0", size: "sm", colorClassName: "text-brand-200" },
  { className: "right-28 top-6", size: "sm", colorClassName: "text-sky-200" },
  // 아래 3개는 디버그 격자(px 좌표)로 짚어서 임의값으로 정확히 배치한 것.
  { className: "top-[180px] left-[60px]", size: "2xl", colorClassName: "text-yellow-500" },
  { className: "top-[50px] left-[180px]", size: "2xl", colorClassName: "text-brand-200" },
  { className: "top-[200px] left-[340px]", size: "lg", colorClassName: "text-sky-400" },
];

/**
 * 10초 챌린지 카드에 흩뿌리는 반짝임.
 * 텍스트·시계 배지의 실제 렌더 크기를 헤드리스 크롬으로 그려서 좌표를 잡았다
 * (`GREETING_SPARKLES`의 마지막 3개와 같은 방식) — 텍스트 위에 겹치지 않고,
 * 텍스트 블록과 시계 사이 빈 공간을 감싸듯 배치된다.
 */
const CHALLENGE_SPARKLES: SparkleProps[] = [
  { className: "left-[18px] top-0", size: "sm", colorClassName: "text-sky-400" },
  { className: "left-[225px] -top-[4px]", size: "base", colorClassName: "text-yellow-300" },
  { className: "left-[236px] top-[60px]", size: "sm", colorClassName: "text-brand-300" },
  { className: "left-[205px] top-[52px]", size: "sm", colorClassName: "text-yellow-400" },
  { className: "left-[296px] top-[96px]", size: "base", colorClassName: "text-sky-300" },
  { className: "left-[150px] top-[104px]", size: "sm", colorClassName: "text-brand-200" },
];

export function HomeScreen() {
  const navigation = useNavigation<HomeNavigationProp>();
  const recentFeedback = useRecentFeedback();

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface-subtle">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 pb-8">
          {/* 헤더 */}
          <View className="flex-row items-center justify-between py-4">
            <View className="flex-row items-center gap-2">
              <Image source={logo} className="h-8 w-9" resizeMode="contain" />
              {/*
                items-center는 텍스트 "박스"를 정렬할 뿐, 박스 안에서 글자가 중앙에 오지는 않는다.
                Jua는 ascent 800 / descent 200으로 비대칭인데 한글에는 디센더가 없어서,
                잉크가 행 박스 위쪽에 쏠린다(20px 기준 baseline 위 16px ~ 아래 1px).
                그 결과 잉크 중심이 박스 중심보다 0.075em 위에 놓이고, lineHeight를 바꿔도
                이 값은 그대로다. text-xl(20px)에서 1.5px이라 그만큼 내려 로고와 광학 중심을 맞춘다.
              */}
              <Text
                className="relative top-[1.5px] text-xl"
                style={{ color: colors.brand.DEFAULT }}
              >
                토선생
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Pressable
                accessibilityLabel="설정"
                className="h-10 w-10 items-center justify-center rounded-full"
                onPress={() => navigation.navigate("Settings")}
              >
                <Feather name="settings" size={22} color={colors.ink.DEFAULT} />
              </Pressable>
            </View>
          </View>

          {/* 인사 섹션 — 페이지 배경 전체가 이 옅은 브랜드 톤이라 별도 박스 없이 바로 얹는다 */}
          <View className="relative flex-row items-center justify-center gap-2 px-4 py-6">
            <Text className="mr-4 text-lg leading-8">
              안녕하세요!{"\n"}오늘도 토익스피킹{"\n"}공부해볼까요? 😊
            </Text>
            <Image source={greetingMascot} className="h-56 w-40" resizeMode="contain" />
            {/* 반짝임은 토끼 그림보다 나중에 그려야 겹치는 자리에서도 가려지지 않는다. */}
            {GREETING_SPARKLES.map((sparkle) => (
              <Sparkle key={sparkle.className} {...sparkle} />
            ))}
          </View>

          <StartMockExamButton
            className="mt-2"
            onPress={() => navigation.navigate("MockExam")}
          />

          {/* 최근 피드백 섹션 헤더 */}
          <View className="mt-8 flex-row items-center justify-between">
            <Text className="text-lg">최근 피드백</Text>
            <Pressable
              className="flex-row items-center gap-1 py-1"
              onPress={() =>
                navigation.navigate("Feedback", {
                  examId: undefined,
                  questionNumber: undefined,
                  retryCount: undefined,
                })
              }
            >
              <Text className="text-sm text-ink-muted">전체 보기</Text>
              <Feather name="chevron-right" size={16} color={colors.ink.muted} />
            </Pressable>
          </View>

          {/* 최근 피드백 카드 — 옅은 배경 위에서 유일하게 흰색인 카드 */}
          <RecentFeedbackCard
            state={recentFeedback.state}
            onOpenFeedback={(examId) => navigation.navigate("Feedback", { examId })}
            onRetry={recentFeedback.retry}
          />

          {/*
            10초 챌린지 배너 — 인사/피드백 카드에서 이미 토끼 마스코트를 두 번 썼기 때문에
            여기서는 마스코트 대신 반짝임을 카드 전체에 고르게 흩뿌리고, 시계 배지만 남긴다.
          */}
          <Pressable
            accessibilityLabel="10초 챌린지, 커밍 순"
            accessibilityState={{ disabled: true }}
            className="relative mt-3 flex-row items-center gap-3 rounded-3xl border border-sky-line bg-sky-surface p-5"
            disabled
            style={shadows.card}
          >
            <View className="flex-1">
              <Text className="text-base">10초 챌린지</Text>
              <Text className="mt-0.5 text-xs text-sky-text">매일 10초, 영작 감각을 깨워요</Text>
              <View className="mt-3 self-start rounded-full bg-surface px-3 py-1.5">
                <Text className="text-xs text-sky-text">Coming Soon</Text>
              </View>
            </View>
            <TickingClock size={56} />
            {/* 반짝임은 텍스트·시계보다 나중에 그려야 겹치는 자리에서도 가려지지 않는다. */}
            {CHALLENGE_SPARKLES.map((sparkle) => (
              <Sparkle key={sparkle.className} {...sparkle} />
            ))}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
