import { FontAwesome } from '@expo/vector-icons';
import { Image, View } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import type { FirebaseLoginProvider } from '@/features/auth/firebase-auth-types';
import { RecentProviderBubble } from '@/screens/auth/components/RecentProviderBubble';
import { PROVIDER_APPEARANCE } from '@/screens/auth/login-provider-appearance';
import { getLoginProviderLabel } from '@/screens/auth/login-provider-label';
import { size } from '@/theme';

/**
 * 로그인 화면의 "○○로 계속하기" 긴 버튼. 색은 `LoginProviderMark`와 같은 브랜드 규격이다.
 * 최근 사용 수단이면 말풍선을 버튼 오른쪽 위 모서리에 걸쳐 띄운다.
 */
export function LoginProviderButton({
  provider,
  isRecent,
  onPress,
}: {
  provider: FirebaseLoginProvider;
  isRecent: boolean;
  onPress: () => void;
}) {
  const appearance = PROVIDER_APPEARANCE[provider];
  const label = `${getLoginProviderLabel(provider)}로 계속하기`;
  return (
    <View className="relative">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}${isRecent ? ', 최근 사용' : ''}`}
        className={`min-h-control-lg flex-row items-center justify-center gap-element rounded-control ${provider === 'google' ? 'border border-line' : ''}`}
        style={{ backgroundColor: appearance.background }}
        onPress={onPress}
      >
        {provider === 'google' ? (
          <Image
            source={require('../../../../public/auth/google-logo.png')}
            className="h-5 w-5"
            resizeMode="contain"
            accessible={false}
          />
        ) : (
          <FontAwesome name={appearance.icon} size={size.icon.md} color={appearance.color} />
        )}
        <Text
          className="text-lg"
          // 구글 글자색은 로고 파랑이 아니라 본문색이다. 파랑은 아이콘에만 쓴다.
          style={{ color: provider === 'google' ? undefined : appearance.color }}
        >
          {label}
        </Text>
      </Pressable>
      {isRecent ? (
        // 말풍선은 감싸는 쪽 위에 뜬다. 버튼 위쪽 안에 너비만 가진 기준점을 두어
        // 꼬리가 버튼 윗변에 걸치게 한다.
        <View pointerEvents="none" className="absolute right-lg top-lg w-20">
          <RecentProviderBubble />
        </View>
      ) : null}
    </View>
  );
}
