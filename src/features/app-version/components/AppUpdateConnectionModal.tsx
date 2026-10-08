import { Feather } from '@expo/vector-icons';
import { Modal, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { colors, shadows, size } from '@/theme';

/**
 * 버전 확인이 연결 실패로 끝났을 때의 안내(2026-10-08 시안 2). 닫으면 앱을 그대로 쓴다.
 *
 * 문구는 인증 복구 화면의 연결 실패 문구와 맞춘다. 오프라인으로 시작하면 둘이 함께 보인다.
 */
export function AppUpdateConnectionModal({
  visible,
  retrying,
  onRetry,
  onDismiss,
}: {
  visible: boolean;
  retrying: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View className="flex-1 items-center justify-center bg-ink/50 px-screen">
        <View
          accessibilityViewIsModal
          className="w-full max-w-md items-center rounded-card bg-surface p-2xl"
          style={shadows.card}
        >
          <View className="h-14 w-14 items-center justify-center rounded-pill bg-sky-surface">
            <Feather color={colors.sky.text} name="wifi-off" size={size.icon.lg} />
          </View>
          <Text accessibilityRole="header" className="mt-lg text-center text-xl">
            네트워크 연결이 원활하지 않아요
          </Text>
          <Text className="mt-sm text-center text-sm leading-6 text-ink-muted">
            인터넷 연결을 확인한 뒤 다시 시도해 주세요.
          </Text>
          <View className="mt-section w-full flex-row gap-content">
            <Button
              className="flex-1"
              disabled={retrying}
              label="닫기"
              variant="neutral"
              onPress={onDismiss}
            />
            <Button className="flex-1" label="다시 시도" loading={retrying} onPress={onRetry} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
