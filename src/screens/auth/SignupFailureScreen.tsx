import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';

interface SignupFailureAction {
  label: string;
  onPress: () => void;
}

interface SignupFailureScreenProps {
  title: string;
  message: string;
  primary: SignupFailureAction;
  secondary?: SignupFailureAction;
}

/** 가입 중 약관 조회·제출 실패 안내. Safe area는 가입 흐름의 root가 소유한다. */
export function SignupFailureScreen({
  title,
  message,
  primary,
  secondary,
}: SignupFailureScreenProps) {
  return (
    <View className="flex-1 items-center justify-center bg-surface-subtle px-screen">
      <View className="w-full max-w-xl items-center rounded-card border border-line bg-surface p-xl">
        <Text accessibilityRole="header" className="text-center text-2xl">
          {title}
        </Text>
        <Text
          accessibilityLiveRegion="polite"
          className="mt-md text-center text-sm leading-6 text-ink-muted"
        >
          {message}
        </Text>
        <Button
          className="mt-section w-full"
          label={primary.label}
          size="lg"
          onPress={primary.onPress}
        />
        {secondary ? (
          <Button
            className="mt-content w-full"
            label={secondary.label}
            variant="text"
            onPress={secondary.onPress}
          />
        ) : null}
      </View>
    </View>
  );
}
