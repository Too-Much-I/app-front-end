import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';

type EnrollmentStatus = 'signingUp' | 'mergeRequired';

// mergeRequired는 방금 로그인한 SNS 계정이 이미 회원이라는 뜻이라 다시 로그인하라고 안내하지 않는다.
const ENROLLMENT_COPY = {
  // 신규 가입은 가입 흐름으로 연결됐다. 이 화면의 signingUp은 기존 Guest의 회원 전환이다.
  signingUp: {
    title: '회원 전환을 준비하고 있어요',
    body: '기존 학습 기록을 유지한 채 회원으로 전환하는 기능은 준비 중이에요.',
  },
  mergeRequired: {
    title: '기록 통합을 준비하고 있어요',
    body: '이 계정은 이미 가입돼 있어요. 기존 학습 기록을 이 계정으로 옮기는 기능은 준비 중이에요.',
  },
} satisfies Record<EnrollmentStatus, { title: string; body: string }>;

interface EnrollmentUnavailableScreenProps {
  status: EnrollmentStatus;
  onCancel: () => void;
}

/** Guest 승격·병합 흐름을 구현하기 전까지 대상자에게 보여주는 임시 화면. */
export function EnrollmentUnavailableScreen({
  status,
  onCancel,
}: EnrollmentUnavailableScreenProps) {
  const copy = ENROLLMENT_COPY[status];
  return (
    <SafeAreaView className="flex-1 bg-surface-subtle" edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center px-screen">
        <View className="w-full max-w-xl items-center rounded-card border border-line bg-surface p-xl">
          <Text className="text-center text-2xl">{copy.title}</Text>
          <Text className="mt-md text-center text-sm leading-6 text-ink-muted">{copy.body}</Text>
          <Button
            className="mt-section w-full"
            label="로그인 화면으로"
            size="lg"
            onPress={onCancel}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
