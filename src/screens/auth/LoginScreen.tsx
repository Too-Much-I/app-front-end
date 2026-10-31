import { StatusBar } from 'expo-status-bar';
import { Image, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { LoginProviderButton } from '@/screens/auth/components/LoginProviderButton';
import { colors, spacing } from '@/theme';

export type LoginProviderChoice = 'kakao' | 'google' | 'apple';

interface LoginScreenProps {
  onSelectProvider: (provider: LoginProviderChoice) => void;
  /** 이 기기에서 마지막으로 로그인한 수단. 비밀이 아닌 힌트이며 없으면 표시하지 않는다. */
  recentProvider?: LoginProviderChoice | null;
  onFindAccount?: () => void;
}

const PROVIDERS: LoginProviderChoice[] = ['kakao', 'google', 'apple'];

/**
 * 주황 무대 위에 흰 시트를 올린 로그인 화면(2026-10-30 시안 C3).
 * 위쪽 안전 영역은 감싸는 쪽이 주황으로 칠하고, 아래쪽은 시트가 직접 비운다.
 * Provider 노출 정책과 인증은 호출자가 맡는다.
 */
export function LoginScreen({
  onSelectProvider,
  recentProvider = null,
  onFindAccount,
}: LoginScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-brand">
      <StatusBar style="light" />
      <View className="min-h-control-lg flex-row items-center px-screen">
        <View className="flex-row items-center gap-element">
          <Image
            source={require('../../../public/logo.png')}
            className="h-8 w-8"
            resizeMode="contain"
            accessible={false}
          />
          <Text className="text-2xl !text-white">토선생</Text>
        </View>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 justify-end px-screen">
          <View className="relative h-80 w-full" accessible={false}>
            <View
              className="absolute left-0 top-1.5 items-start gap-xs"
              style={{ transform: [{ rotate: '-5deg' }] }}
            >
              <View className="bg-login-navy px-md py-1.5">
                <Text className="!font-rubik text-[2.125rem] leading-[2.125rem] !text-white">
                  SPEAK
                </Text>
              </View>
              <Text className="ml-7 !font-caveat text-[2rem] leading-[2rem] !text-white">or</Text>
              <View className="ml-3.5 bg-surface px-md py-1.5">
                <Text className="!font-rubik text-[2.125rem] leading-[2.125rem] !text-login-navy">
                  READING?
                </Text>
              </View>
            </View>
            <Svg
              width={40}
              height={52}
              viewBox="0 0 40 52"
              style={{ position: 'absolute', right: spacing['2xl'], top: spacing.xs }}
            >
              <Path
                d="M20 2 V50 M4 26 H36 M10 14 L30 38 M30 14 L10 38"
                stroke={colors.surface.DEFAULT}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            </Svg>
            <Svg
              width={18}
              height={18}
              viewBox="0 0 18 18"
              style={{ position: 'absolute', right: spacing.sm, top: 60 }}
            >
              <Path
                d="M9 1 V17 M1 9 H17 M3 3 L15 15 M15 3 L3 15"
                stroke={colors.login.navy}
                strokeWidth={2}
                strokeLinecap="round"
              />
            </Svg>
            <Image
              // headset_rabbit.png(1159×1358)는 이 칸(176×208)과 비율이 거의 같아 잘리지 않는다.
              source={require('../../../public/mascots/headset_rabbit.png')}
              className="absolute -bottom-1.5 right-2.5 h-52 w-44"
              resizeMode="contain"
              accessible={false}
            />
          </View>
        </View>
        <View
          className="gap-element rounded-t-card bg-surface-subtle px-screen pt-3xl"
          style={{ paddingBottom: insets.bottom + spacing['3xl'] }}
        >
          <Text accessibilityRole="header" className="text-3xl">
            <Text className="text-3xl !text-brand-text">3초</Text>면 가입 끝!
          </Text>
          <Text className="mb-sm text-base text-ink-muted">아이디도 비밀번호도 필요 없어요.</Text>
          {PROVIDERS.map((provider) => (
            <LoginProviderButton
              key={provider}
              provider={provider}
              isRecent={provider === recentProvider}
              onPress={() => onSelectProvider(provider)}
            />
          ))}
          {onFindAccount ? (
            // 시안 C3대로 회색 글자. 공용 Button의 text variant는 주황이라 직접 그린다.
            <Pressable
              accessibilityRole="button"
              className="min-h-control-md items-center justify-center self-center px-card"
              onPress={onFindAccount}
            >
              <Text className="text-base text-ink-muted">가입한 계정 찾기</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
