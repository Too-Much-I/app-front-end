import { Feather } from '@expo/vector-icons';
import { Image, ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { LoginProviderMark } from '@/screens/auth/components/LoginProviderMark';
import { RecentProviderBubble } from '@/screens/auth/components/RecentProviderBubble';
import { getLoginProviderLabel } from '@/screens/auth/login-provider-label';
import { colors, size } from '@/theme';

export type LoginProviderChoice = 'kakao' | 'google' | 'apple';

interface LoginScreenProps {
  onSelectProvider: (provider: LoginProviderChoice) => void;
  /** 이 기기에서 마지막으로 로그인한 수단. 비밀이 아닌 힌트이며 없으면 표시하지 않는다. */
  recentProvider?: LoginProviderChoice | null;
  onFindAccount?: () => void;
}

const PROVIDERS: LoginProviderChoice[] = ['kakao', 'google', 'apple'];

/** Provider 노출 정책과 인증은 호출자가 맡는다. 현재는 개발용 UI 미리보기에서만 사용한다. */
export function LoginScreen({
  onSelectProvider,
  recentProvider = null,
  onFindAccount,
}: LoginScreenProps) {
  return (
    <View className="flex-1 bg-surface-subtle">
      <View className="min-h-control-lg flex-row items-center px-screen">
        <View className="flex-row items-center gap-content">
          <Image
            source={require('../../../public/logo.png')}
            className="h-8 w-8"
            resizeMode="contain"
            accessible={false}
          />
          <Text className="text-2xl !text-brand">토선생</Text>
        </View>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow px-screen pb-section pt-section"
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center gap-content">
          <Text accessibilityRole="header" className="text-center text-3xl">
            토익스피킹,{'\n'}
            <Text className="text-3xl !text-brand-text">첫 모의고사 1회 무료</Text>
          </Text>
          <Text className="text-center text-sm text-ink-muted">
            가입을 마치고, 내 실력부터 확인해요.
          </Text>
        </View>
        <View className="my-section flex-1 items-center justify-center">
          <View className="relative h-56 w-64 items-center justify-end">
            <View className="absolute bottom-0 h-40 w-60 rounded-pill bg-brand-100" />
            <Text className="absolute left-0 top-12 text-3xl !text-brand" accessible={false}>
              ✦
            </Text>
            <View
              className="absolute right-0 top-4 h-11 w-10 items-center justify-center rounded-chip border border-sky-line bg-sky-surface"
              style={{ transform: [{ rotate: '12deg' }] }}
            >
              <Feather name="file-text" size={size.icon.lg} color={colors.sky.text} />
            </View>
            <Image
              source={require('../../../public/mascots/greeting_rabbit_bust.png')}
              className="h-52 w-48"
              resizeMode="contain"
              accessible={false}
            />
          </View>
        </View>
        <View className="gap-section pt-element">
          <Text className="text-center text-lg">소셜 로그인으로 간단하게 시작하세요</Text>
          {/* 말풍선이 버튼 위로 튀어도 안내 문구에 닿지 않게 위 여백을 비워 둔다. */}
          <View className="flex-row justify-center gap-section-lg pt-2xl">
            {PROVIDERS.map((provider) => {
              const isRecent = provider === recentProvider;
              return (
                <View key={provider} className="relative">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${getLoginProviderLabel(provider)}로 계속하기${isRecent ? ', 최근 사용' : ''}`}
                    className="rounded-pill"
                    onPress={() => onSelectProvider(provider)}
                  >
                    <LoginProviderMark provider={provider} />
                  </Pressable>
                  {isRecent ? <RecentProviderBubble /> : null}
                </View>
              );
            })}
          </View>
          {onFindAccount ? (
            <Button label="가입한 계정 찾기" variant="text" onPress={onFindAccount} />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
