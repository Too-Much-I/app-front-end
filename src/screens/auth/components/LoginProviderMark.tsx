import { FontAwesome } from '@expo/vector-icons';
import { Image, View } from 'react-native';

import type { FirebaseLoginProvider } from '@/features/auth/firebase-auth-types';
import { colors, size } from '@/theme';

// Provider 고유 로고 색은 앱의 의미 색이 아니라 외부 브랜드 규격이다.
const PROVIDER_APPEARANCE = {
  kakao: { background: '#FEE500', color: '#191919', icon: 'comment' },
  google: { background: colors.surface.DEFAULT, color: '#4285F4', icon: 'google' },
  apple: { background: '#000000', color: '#FFFFFF', icon: 'apple' },
} as const satisfies Record<FirebaseLoginProvider, object>;

/**
 * SNS 원형 로고. 로그인 화면 버튼과 계정 찾기 결과가 같은 모양을 써서, 결과에서 본 원을
 * 로그인 화면에서 다시 알아보게 한다. 누르는 동작은 감싸는 쪽이 맡는다.
 */
export function LoginProviderMark({
  provider,
  large = false,
}: {
  provider: FirebaseLoginProvider;
  large?: boolean;
}) {
  const appearance = PROVIDER_APPEARANCE[provider];
  return (
    <View
      className={`items-center justify-center rounded-pill border border-line ${large ? 'h-20 w-20' : 'h-16 w-16'}`}
      style={{ backgroundColor: appearance.background }}
    >
      {provider === 'google' ? (
        <Image
          source={require('../../../../public/auth/google-logo.png')}
          className={large ? 'h-9 w-9' : 'h-7 w-7'}
          resizeMode="contain"
          accessible={false}
        />
      ) : (
        <FontAwesome name={appearance.icon} size={size.icon.xl} color={appearance.color} />
      )}
    </View>
  );
}
