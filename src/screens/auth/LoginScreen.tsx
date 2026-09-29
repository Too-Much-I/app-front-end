import { Feather, FontAwesome } from "@expo/vector-icons";
import { Image, ScrollView, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { colors, size } from "@/theme";

export type LoginProviderChoice = "kakao" | "google" | "apple";

interface LoginScreenProps {
  onSelectProvider: (provider: LoginProviderChoice) => void;
  onBrowse: () => void;
  onClose: () => void;
}

// Provider 고유 로고 색은 앱의 의미 색이 아니라 외부 브랜드 규격이다.
const PROVIDER_APPEARANCE = {
  kakao: {
    label: "카카오",
    background: "#FEE500",
    color: "#191919",
    icon: "comment",
  },
  google: {
    label: "Google",
    background: colors.surface.DEFAULT,
    color: "#4285F4",
    icon: "google",
  },
  apple: {
    label: "Apple",
    background: "#000000",
    color: "#FFFFFF",
    icon: "apple",
  },
} as const satisfies Record<LoginProviderChoice, object>;
const PROVIDERS: LoginProviderChoice[] = ["kakao", "google", "apple"];

/** Provider 노출 정책과 인증은 호출자가 맡는다. 현재는 개발용 UI 미리보기에서만 사용한다. */
export function LoginScreen({
  onSelectProvider,
  onBrowse,
  onClose,
}: LoginScreenProps) {
  return (
    <View className="flex-1 bg-surface-subtle">
      <View className="min-h-control-lg flex-row items-center justify-between px-screen">
        <View className="flex-row items-center gap-content">
          <Image
            source={require("../../../public/logo.png")}
            className="h-8 w-8"
            resizeMode="contain"
            accessible={false}
          />
          <Text className="text-2xl !text-brand">토선생</Text>
        </View>
        <Pressable
          accessibilityLabel="로그인 닫기"
          accessibilityRole="button"
          className="h-11 w-11 items-center justify-center"
          onPress={onClose}
        >
          <Feather name="x" size={size.icon.lg} color={colors.ink.muted} />
        </Pressable>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow px-screen pb-section pt-section"
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center gap-content">
          <Text accessibilityRole="header" className="text-center text-3xl">
            토익스피킹,{"\n"}
            <Text className="text-3xl !text-brand-text">
              첫 모의고사 1회 무료
            </Text>
          </Text>
          <Text className="text-center text-sm text-ink-muted">
            가입을 마치고, 내 실력부터 확인해요.
          </Text>
        </View>
        <View className="my-section flex-1 items-center justify-center">
          <View className="relative h-56 w-64 items-center justify-end">
            <View className="absolute bottom-0 h-40 w-60 rounded-pill bg-brand-100" />
            <Text
              className="absolute left-0 top-12 text-3xl !text-brand"
              accessible={false}
            >
              ✦
            </Text>
            <View
              className="absolute right-0 top-4 h-11 w-10 items-center justify-center rounded-chip border border-sky-line bg-sky-surface"
              style={{ transform: [{ rotate: "12deg" }] }}
            >
              <Feather
                name="file-text"
                size={size.icon.lg}
                color={colors.sky.text}
              />
            </View>
            <Image
              source={require("../../../public/mascots/greeting_rabbit_bust.png")}
              className="h-52 w-48"
              resizeMode="contain"
              accessible={false}
            />
          </View>
        </View>
        <View className="gap-section pt-element">
          <Text className="text-center text-lg">
            소셜 로그인으로 간단하게 시작하세요
          </Text>
          <View className="flex-row justify-center gap-section-lg">
            {PROVIDERS.map((provider) => {
              const appearance = PROVIDER_APPEARANCE[provider];
              return (
                <Pressable
                  key={provider}
                  accessibilityRole="button"
                  accessibilityLabel={`${appearance.label}로 계속하기`}
                  className="h-16 w-16 items-center justify-center rounded-pill border border-line"
                  style={{ backgroundColor: appearance.background }}
                  onPress={() => onSelectProvider(provider)}
                >
                  {provider === "google" ? (
                    <Image
                      source={require("../../../public/auth/google-logo.png")}
                      className="h-7 w-7"
                      resizeMode="contain"
                      accessible={false}
                    />
                  ) : (
                    <FontAwesome
                      name={appearance.icon}
                      size={size.icon.xl}
                      color={appearance.color}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
          <Button label="먼저 둘러볼게요" variant="text" onPress={onBrowse} />
        </View>
      </ScrollView>
    </View>
  );
}
