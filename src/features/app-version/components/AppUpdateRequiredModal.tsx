import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, Modal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import type { AppPlatform } from '@/features/app-version/api/app-version-policy';
import { colors, shadows, size } from '@/theme';

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다. 웹 업데이트 안내와 같은 토끼다.
const sweatingRabbit = require('../../../../public/mascots/hmm_rabbit_tight.png');

const STORE_LABELS = {
  ios: 'App Store에서 업데이트',
  android: 'Google Play에서 업데이트',
} satisfies Record<AppPlatform, string>;

/** 닫을 수 없는 안내다. Android 뒤로 가기도 무시한다. */
const ignoreRequestClose = () => undefined;

/**
 * 최소 버전 미만일 때 앱 전체를 덮는 강제 업데이트 안내(2026-10-08 시안 B).
 *
 * `Modal`로 띄워 웹뷰를 포함한 모든 화면 위에 오고, 아래 앱은 그대로 둔다(세션 복원은 계속 진행된다).
 * 문구는 웹 종합 피드백의 업데이트 안내와 같다.
 */
export function AppUpdateRequiredModal({
  visible,
  platform,
  onOpenStore,
}: {
  visible: boolean;
  platform: AppPlatform;
  onOpenStore: () => void;
}) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={ignoreRequestClose}
      statusBarTranslucent
      visible={visible}
    >
      <SafeAreaView className="flex-1 bg-surface-subtle" edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center px-screen">
          <Image
            accessibilityLabel="땀을 흘리는 토끼 선생님"
            className="h-40 w-24"
            resizeMode="contain"
            source={sweatingRabbit}
          />
          <View
            className="w-full max-w-xl items-center rounded-card border border-line bg-surface p-xl"
            style={shadows.card}
          >
            <Text accessibilityRole="header" className="text-center text-2xl">
              업데이트가 필요해요
            </Text>
            <Text className="mt-md text-center text-sm leading-6 text-ink-muted">
              계속 이용하려면 최신 버전으로 업데이트해 주세요.
            </Text>
            <View className="mt-xl w-full flex-row items-center gap-content rounded-control bg-sky-surface px-lg py-md">
              <MaterialCommunityIcons
                color={colors.sky.text}
                name="shield-check-outline"
                size={size.icon.md}
              />
              <Text className="flex-1 text-sm leading-5 !text-sky-text">
                앱을 삭제하지 않고 스토어에서 업데이트하면 기존 학습 기록이 유지돼요.
              </Text>
            </View>
            <Button
              className="mt-section w-full"
              label={STORE_LABELS[platform]}
              size="lg"
              onPress={onOpenStore}
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
