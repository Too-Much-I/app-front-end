import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useEffect, useState, type ReactElement } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { SupportInquiryScreen } from '@/screens/support/SupportInquiryScreen';
import type { AuthCoordinatorState, createAuthCoordinator } from '@/features/auth/auth-coordinator';
import type { PhoneCollisionCredential } from '@/features/auth/firebase-auth-errors';
import type { FirebaseLoginProvider } from '@/features/auth/firebase-auth-types';
import type { createLastLoginProviderStore } from '@/features/auth/last-login-provider';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useAuthBootstrap } from '@/features/auth/use-auth-bootstrap';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { getLoginProviderLabel } from '@/screens/auth/login-provider-label';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { colors } from '@/theme';

import type { IdentityEnrollment } from '@/features/auth/identity-login-types';
import type { AuthSession } from '@/features/auth/types';
import { MainTabNavigator } from '@/navigation/MainTabNavigator';
import type { RootStackParamList } from '@/navigation/types';
import { AuthRecoveryScreen } from '@/screens/auth/AuthRecoveryScreen';
import { SignupFailureScreen } from '@/screens/auth/SignupFailureScreen';
import { ConsentScreen } from '@/screens/consent/ConsentScreen';
import { NotificationsScreen } from '@/screens/notifications/NotificationsScreen';
import { ReanswerScreen } from '@/screens/reanswer/ReanswerScreen';
import { SettingsScreen } from '@/screens/settings/SettingsScreen';
import { SettingsWebViewScreen } from '@/screens/settings/SettingsWebViewScreen';
import { ChallengeResultScreen } from '@/screens/challenge/ChallengeResultScreen';
import { ChallengeStageScreen } from '@/screens/challenge/ChallengeStageScreen';
import { TenSecondChallengeScreen } from '@/screens/challenge/TenSecondChallengeScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

function MemberRootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen
        name="Reanswer"
        component={ReanswerScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="ChallengeStage" component={ChallengeStageScreen} />
      {/* 녹음 중 스와이프로 빠져나가면 확인 없이 파일이 사라지므로 제스처를 막는다. */}
      <Stack.Screen
        name="TenSecondChallenge"
        component={TenSecondChallengeScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="ChallengeResult" component={ChallengeResultScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="SettingsWebView" component={SettingsWebViewScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}

type CoordinatorNavigationProps = {
  coordinator: ReturnType<typeof createAuthCoordinator>;
  renderEnrollment: (
    state: Extract<AuthCoordinatorState, { status: 'signingUp' | 'mergeRequired' }>,
    actions: {
      draftStore: ReturnType<typeof createAuthCoordinator>['signupDraft'];
      onComplete: (session: AuthSession) => Promise<void>;
      onMergeRequired: () => void;
      onEnrollmentRequired: (enrollment: IdentityEnrollment) => void;
      onFindAccount: (credential: PhoneCollisionCredential | null) => void;
      onCancel: () => void;
    },
  ) => ReactElement;
  renderAccountRecovery: (
    state: Extract<AuthCoordinatorState, { status: 'findingAccount' }>,
    actions: { onFinish: (provider: FirebaseLoginProvider | null) => void },
  ) => ReactElement;
  lastLoginProvider: ReturnType<typeof createLastLoginProviderStore>;
};

export function RootNavigator({
  coordinator,
  renderEnrollment,
  renderAccountRecovery,
  lastLoginProvider,
}: CoordinatorNavigationProps): ReactElement {
  useAuthBootstrap(coordinator);
  const state = useStore(coordinator, (snapshot) => snapshot.state);

  switch (state.status) {
    case 'idle':
    case 'restoring':
    case 'signingIn':
    case 'submittingProof':
    case 'activatingSession':
      return (
        <View className="flex-1 items-center justify-center gap-content bg-surface-subtle">
          <ActivityIndicator color={colors.brand.text} />
          <Text accessibilityLiveRegion="polite">
            {state.status === 'signingIn'
              ? '소셜 인증을 진행하고 있어요.'
              : state.status === 'submittingProof'
                ? '로그인을 확인하고 있어요.'
                : state.status === 'activatingSession'
                  ? '로그인을 마무리하고 있어요.'
                  : '로그인 정보를 확인하고 있어요.'}
          </Text>
          {state.status === 'signingIn' || state.status === 'submittingProof' ? (
            <Button label="취소" variant="secondary" onPress={coordinator.cancelLogin} />
          ) : null}
        </View>
      );
    case 'noSession':
    case 'guest':
      return (
        <Stack.Navigator key="login" screenOptions={{ headerShown: false, gestureEnabled: false }}>
          <Stack.Screen name="AuthLogin">
            {() => <LoginRoute coordinator={coordinator} lastLoginProvider={lastLoginProvider} />}
          </Stack.Screen>
        </Stack.Navigator>
      );
    case 'signingUp':
    case 'mergeRequired':
      return renderEnrollment(state, {
        draftStore: coordinator.signupDraft,
        onComplete: (session) => coordinator.completeEnrollment(state.flowId, session),
        onMergeRequired: () => coordinator.requireMerge(state.flowId),
        onEnrollmentRequired: (enrollment) =>
          coordinator.continueWithEnrollment(state.flowId, enrollment),
        onFindAccount: (credential) => coordinator.findAccountFromSignup(state.flowId, credential),
        onCancel: coordinator.cancelLogin,
      });
    case 'findingAccount':
      return renderAccountRecovery(state, {
        onFinish: (provider) => void coordinator.finishAccountRecovery(state.flowId, provider),
      });
    case 'accountInactive':
      // 문구는 2026-10-05 사용자 결정. 로그인됐다고 생각한 사용자가 갑자기 로그인 화면을 보지 않게 먼저 알린다.
      return (
        <SafeAreaView className="flex-1 bg-surface-subtle" edges={['top', 'bottom']}>
          <SignupFailureScreen
            title="계정이 활성화되지 않았어요"
            message="계정을 계속 사용하려면 다시 로그인해 주세요."
            primary={{ label: '다시 로그인하기', onPress: coordinator.acknowledgeAccountInactive }}
          />
        </SafeAreaView>
      );
    case 'accountWithdrawn':
      // 이 기기에서 탈퇴했든 다른 기기에서 탈퇴했든 같은 안내다(2026-10-07 결정). 축하하지 않고 사실만 알린다.
      return (
        <SafeAreaView className="flex-1 bg-surface-subtle" edges={['top', 'bottom']}>
          <SignupFailureScreen
            title="계정이 탈퇴됐어요"
            message="다시 가입하면 새 계정으로 시작해요."
            primary={{ label: '확인', onPress: coordinator.acknowledgeAccountWithdrawn }}
          />
        </SafeAreaView>
      );
    case 'authenticated':
      return <MemberRootNavigator />;
    case 'consent':
      return (
        <Stack.Navigator
          key="consent"
          screenOptions={{ headerShown: false, gestureEnabled: false }}
        >
          <Stack.Screen name="Consent">
            {(props) => (
              <ConsentScreen
                {...props}
                mode="existing"
                requiredItems={state.requiredItems}
                qualityReviewConsented={state.qualityReviewConsented}
                isSubmitting={state.submission.status === 'submitting'}
                submitError={state.submission.status === 'failed' ? state.submission.message : null}
                onAccept={coordinator.acceptConsent}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="SettingsWebView" component={SettingsWebViewScreen} />
        </Stack.Navigator>
      );
    case 'loginError':
    case 'error':
      return (
        <Stack.Navigator
          key="recovery"
          screenOptions={{ headerShown: false, gestureEnabled: false }}
        >
          <Stack.Screen name="AuthRecovery">
            {({ navigation }) => (
              <AuthRecoveryScreen
                message={state.message}
                isRetrying={state.status === 'error' && state.isRetrying}
                onRetry={coordinator.retry}
                onCancel={state.status === 'loginError' ? coordinator.cancelLogin : undefined}
                recoveryAction={state.nextAction === 'get-help' ? 'get-help' : 'retry'}
                onHelp={() => navigation.navigate('SupportInquiry')}
              />
            )}
          </Stack.Screen>
          <Stack.Screen
            name="SupportInquiry"
            component={SupportInquiryRoute}
            options={{ gestureEnabled: true }}
          />
        </Stack.Navigator>
      );
  }
}

function LoginRoute({
  coordinator,
  lastLoginProvider,
}: {
  coordinator: ReturnType<typeof createAuthCoordinator>;
  lastLoginProvider: ReturnType<typeof createLastLoginProviderStore>;
}) {
  const recentProvider = useStore(lastLoginProvider, (snapshot) =>
    snapshot.status === 'loaded' ? snapshot.provider : null,
  );
  // 저장된 수단과 다른 SNS를 눌렀을 때 한 번 확인한다. 그 SNS로는 새 가입이 될 수 있다.
  const [differentProvider, setDifferentProvider] = useState<FirebaseLoginProvider | null>(null);

  useEffect(() => {
    void lastLoginProvider.load();
  }, [lastLoginProvider]);

  const selectProvider = (provider: FirebaseLoginProvider) => {
    if (recentProvider && recentProvider !== provider) setDifferentProvider(provider);
    else void coordinator.signIn(provider);
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-subtle">
      <LoginScreen
        recentProvider={recentProvider}
        onSelectProvider={selectProvider}
        onFindAccount={coordinator.findAccount}
      />
      {recentProvider && differentProvider ? (
        <ConfirmModal
          visible
          title={`최근에 ${getLoginProviderLabel(recentProvider)}로 로그인했어요`}
          // 그 SNS가 이미 회원이면 번호가 필요 없어 "새로 가입하려면"으로 조건을 단다. 전화번호당 계정 하나다.
          message={`${getLoginProviderLabel(differentProvider)}로 새로 가입하려면 이전 계정과 다른 휴대전화 번호가 필요해요.`}
          cancelLabel="돌아가기"
          confirmLabel={`${getLoginProviderLabel(differentProvider)}로 계속하기`}
          onCancel={() => setDifferentProvider(null)}
          onConfirm={() => {
            setDifferentProvider(null);
            void coordinator.signIn(differentProvider);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function SupportInquiryRoute({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'SupportInquiry'>) {
  // TODO: 비로그인 문의 API 계약 확정 후 sendInquiry 어댑터 연결.
  return <SupportInquiryScreen onBack={navigation.goBack} />;
}
