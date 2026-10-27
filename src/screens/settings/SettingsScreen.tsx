import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { formatInstalledAppVersion } from '@/features/app-version/installed-app-version';
import { useSignOutConfirmation } from '@/features/auth/use-sign-out-confirmation';
import { getStoredConsent } from '@/features/consent/consent-storage';
import type { RootStackParamList } from '@/navigation/types';
import { SettingsRow } from '@/screens/settings/components/SettingsRow';
import { SettingsSection } from '@/screens/settings/components/SettingsSection';
import { useAccountWithdrawal } from '@/screens/settings/use-account-withdrawal';
import { useQualityReviewConsent } from '@/screens/settings/use-quality-review-consent';
import { colors } from '@/theme';

type SettingsScreenProps = NativeStackScreenProps<RootStackParamList, 'Settings'>;

function formatConsentDate(iso: string): string {
  const date = new Date(iso);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

export function SettingsScreen({ navigation }: SettingsScreenProps) {
  const [consentAgreedAt, setConsentAgreedAt] = useState<string | null>(null);
  const qualityReview = useQualityReviewConsent();
  const confirmSignOut = useSignOutConfirmation();
  const withdrawal = useAccountWithdrawal();

  useEffect(() => {
    getStoredConsent()
      .then((record) => setConsentAgreedAt(record?.privacy.agreedAt ?? null))
      .catch(() => setConsentAgreedAt(null));
  }, []);

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
        <Text className="ml-2 text-2xl">설정</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-screen pb-10 pt-2">
          <SettingsSection title="서비스">
            {/* 학습 알림(기기 설정)과 이벤트·혜택 알림(광고성 동의)을 한 단계 안에 둔다(2026-10-27 결정). */}
            <SettingsRow
              icon="bell"
              onPress={() => navigation.navigate('NotificationSettings')}
              title="알림"
              description="학습 알림과 이벤트·혜택 알림을 설정해요"
            />
            <SettingsRow
              icon="file-text"
              onPress={() =>
                navigation.navigate('SettingsWebView', {
                  path: '/app-settings/privacy',
                  title: '개인정보 처리방침',
                })
              }
              title="개인정보 처리방침"
            />
            <SettingsRow
              icon="clipboard"
              onPress={() =>
                navigation.navigate('SettingsWebView', {
                  path: '/app-settings/terms',
                  title: '이용약관',
                })
              }
              title="이용약관"
            />
            {consentAgreedAt ? (
              <SettingsRow
                icon="check-circle"
                title="동의 일시"
                trailing={
                  <Text className="text-sm text-ink-muted">
                    {formatConsentDate(consentAgreedAt)}
                  </Text>
                }
              />
            ) : null}
            <SettingsRow
              description="버그 제보 및 기능 제안을 할 수 있어요."
              icon="message-circle"
              onPress={() => navigation.navigate('SupportInquiry', { screen: 'settings' })}
              title="문의하기"
            />
            <SettingsRow
              icon="info"
              showDivider={false}
              title="버전 정보"
              trailing={
                <Text className="text-sm text-ink-muted">{formatInstalledAppVersion()}</Text>
              }
            />
          </SettingsSection>

          <SettingsSection title="개인정보">
            <SettingsRow
              description={
                qualityReview.hasError
                  ? '설정을 바꾸지 못했어요. 잠시 후 다시 시도해주세요.'
                  : '채점이 잘못됐을 때 담당자가 답변 음성을 확인해 원인을 찾아요. 꺼도 응시와 채점에는 영향이 없어요.'
              }
              icon="shield"
              showDivider={false}
              title="채점 품질 개선을 위한 답변 검토"
              trailing={
                <Switch
                  accessibilityLabel="채점 품질 개선을 위한 답변 검토 동의"
                  disabled={!qualityReview.isLoaded}
                  ios_backgroundColor={colors.line.DEFAULT}
                  onValueChange={qualityReview.toggle}
                  thumbColor={colors.surface.DEFAULT}
                  trackColor={{
                    false: colors.line.DEFAULT,
                    true: colors.brand.DEFAULT,
                  }}
                  value={qualityReview.enabled}
                />
              }
            />
          </SettingsSection>

          <SettingsSection title="데이터 관리">
            <SettingsRow
              description="학습 기록 삭제 기능을 준비하고 있어요."
              icon="trash-2"
              // TODO: 회원의 기록 전용 삭제 API 확정 후 연결. 탈퇴 API를 재사용하지 않는다.
              trailing={null}
              showDivider={false}
              title="모든 학습 기록 삭제"
            />
          </SettingsSection>

          <SettingsSection title="계정">
            <SettingsRow icon="log-out" onPress={confirmSignOut} title="로그아웃" />
            {/* 탈퇴를 눈에 띄게 권하지 않도록 다른 행과 같은 모양으로 둔다(2026-10-07 사용자 결정). */}
            <SettingsRow
              icon="user-x"
              onPress={withdrawal.open}
              showDivider={false}
              title="회원 탈퇴"
            />
          </SettingsSection>
        </View>
      </ScrollView>
      {/* 진행 중에는 모달이 화면을 덮어 로그아웃 등 다른 행동을 막는다. */}
      <ConfirmModal
        {...withdrawal.modal}
        title="탈퇴할까요?"
        message="지금까지의 학습 기록이 모두 삭제되고, 되돌릴 수 없어요. 다시 가입하면 새 계정으로 시작해요."
        warningBadge
        cancelLabel="취소"
        confirmLabel="탈퇴하기"
        confirmTone="danger"
      />
    </SafeAreaView>
  );
}
