import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Linking, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import type { RootStackParamList } from '@/navigation/types';
import { SettingsRow } from '@/screens/settings/components/SettingsRow';
import { SettingsSection } from '@/screens/settings/components/SettingsSection';
import { useMarketingPushConsent } from '@/screens/settings/use-marketing-push-consent';
import { colors } from '@/theme';

type NotificationSettingsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'NotificationSettings'
>;

/**
 * 알림 설정. 설정 첫 화면의 "알림" 줄로 들어온다(2026-10-27 결정 — 학습 알림과 함께 한 단계 안에 둔다).
 *
 * 학습 알림은 지금처럼 기기 설정에서 켜고 끈다. 이벤트·혜택 알림은 광고성 정보라 따로 받은 동의라서 앱 안에서
 * 끈다 — 수신을 거부할 방법을 알려야 하므로 서버가 이 항목을 주면 항상 보인다.
 */
export function NotificationSettingsScreen({ navigation }: NotificationSettingsScreenProps) {
  const marketingPush = useMarketingPushConsent();

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface-subtle">
      <View className="h-16 flex-row items-center px-screen">
        <Pressable
          accessibilityLabel="뒤로 가기"
          className="h-10 w-10 items-center justify-center rounded-full"
          hitSlop={8}
          onPress={navigation.goBack}
        >
          <Feather name="arrow-left" size={24} color={colors.ink.DEFAULT} />
        </Pressable>
        <Text className="ml-2 text-2xl">알림</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-screen pb-10 pt-2">
          <SettingsSection title="알림">
            {/* 켜고 끄기는 OS 설정에서 한다. 앱은 다음 활성화 때 바뀐 상태를 서버에 보고한다(2026-10-08 결정). */}
            <SettingsRow
              description="기기 설정에서 학습 알림을 켜고 끌 수 있어요"
              icon="bell"
              onPress={() => void Linking.openSettings().catch(() => undefined)}
              showDivider={marketingPush.available}
              title="학습 알림"
            />
            {marketingPush.available ? (
              <SettingsRow
                description={
                  marketingPush.hasError
                    ? '설정을 바꾸지 못했어요. 잠시 후 다시 시도해주세요.'
                    : '기프티콘 이벤트, 할인 같은 광고성 소식을 푸시 알림으로 받아요.'
                }
                icon="gift"
                showDivider={false}
                title="이벤트·혜택 알림"
                trailing={
                  <Switch
                    accessibilityLabel="이벤트·혜택 푸시 알림 수신 동의"
                    disabled={!marketingPush.isLoaded}
                    ios_backgroundColor={colors.line.DEFAULT}
                    onValueChange={() => void marketingPush.toggle()}
                    thumbColor={colors.surface.DEFAULT}
                    trackColor={{ false: colors.line.DEFAULT, true: colors.brand.DEFAULT }}
                    value={marketingPush.enabled}
                  />
                }
              />
            ) : null}
          </SettingsSection>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
