import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import type { ReactElement } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { SupportInquiryScreen } from '@/screens/support/SupportInquiryScreen';
import type { AuthCoordinatorState, createAuthCoordinator } from '@/features/auth/auth-coordinator';
import { useAuthBootstrap } from '@/features/auth/use-auth-bootstrap';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { colors } from '@/theme';

import type { AuthSession } from '@/features/auth/types';
import { MainTabNavigator } from '@/navigation/MainTabNavigator';
import type { RootStackParamList } from '@/navigation/types';
import { AuthRecoveryScreen } from '@/screens/auth/AuthRecoveryScreen';
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
      onCancel: () => void;
    },
  ) => ReactElement;
  onBrowse: () => void;
  onClose: () => void;
};

export function RootNavigator({
  coordinator,
  renderEnrollment,
  ...loginActions
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
            {() => (
              <SafeAreaView className="flex-1 bg-surface-subtle">
                <LoginScreen
                  {...loginActions}
                  onSelectProvider={(provider) => void coordinator.signIn(provider)}
                />
              </SafeAreaView>
            )}
          </Stack.Screen>
        </Stack.Navigator>
      );
    case 'signingUp':
    case 'mergeRequired':
      return renderEnrollment(state, {
        draftStore: coordinator.signupDraft,
        onComplete: (session) => coordinator.completeEnrollment(state.flowId, session),
        onCancel: coordinator.cancelLogin,
      });
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

function SupportInquiryRoute({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'SupportInquiry'>) {
  // TODO: 비로그인 문의 API 계약 확정 후 sendInquiry 어댑터 연결.
  return <SupportInquiryScreen onBack={navigation.goBack} />;
}
