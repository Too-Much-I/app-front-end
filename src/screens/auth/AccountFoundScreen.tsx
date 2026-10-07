import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import type { FirebaseLoginProvider } from '@/features/auth/firebase-auth-types';
import { LoginProviderMark } from '@/screens/auth/components/LoginProviderMark';
import { getLoginProviderLabel } from '@/screens/auth/login-provider-label';

interface AccountFoundScreenProps {
  provider: FirebaseLoginProvider;
  maskedEmail: string | null;
  onSignIn: () => void;
  onBack: () => void;
}

/**
 * 계정 찾기 결과(2026-10-07 시안 C). 로그인 화면의 원형 버튼을 크게 보여 줘 다음에 누를 버튼을
 * 알아보게 한다. Safe area는 계정 찾기 흐름의 root가 소유한다.
 */
export function AccountFoundScreen({
  provider,
  maskedEmail,
  onSignIn,
  onBack,
}: AccountFoundScreenProps) {
  const label = getLoginProviderLabel(provider);
  return (
    <View className="flex-1 justify-between bg-surface-subtle px-screen pb-element pt-section">
      <View className="items-center gap-content pt-section" accessibilityLiveRegion="polite">
        <Text accessibilityRole="header" className="text-center text-2xl">
          가입한 계정을 찾았어요
        </Text>
        <View className="my-element h-28 w-28 items-center justify-center rounded-pill bg-brand-100">
          <LoginProviderMark provider={provider} large />
        </View>
        <Text className="text-center text-xl">{label}로 가입했어요</Text>
        {maskedEmail ? (
          <View className="rounded-pill bg-sky-surface px-md py-xs">
            <Text className="text-sm !text-sky-text">{maskedEmail}</Text>
          </View>
        ) : null}
      </View>
      <View className="gap-xs">
        <Button label={`${label}로 로그인하기`} size="lg" onPress={onSignIn} />
        <Button label="로그인 화면으로" variant="text" onPress={onBack} />
      </View>
    </View>
  );
}
