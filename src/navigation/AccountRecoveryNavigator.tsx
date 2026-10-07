import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, BackHandler, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { Text } from '@/components/ui/Text';
import type { AccountRecoveryEntry } from '@/features/auth/account-recovery-flow';
import type { createAuthRuntime } from '@/features/auth/auth-runtime';
import type { FirebaseLoginProvider } from '@/features/auth/firebase-auth-types';
import { submitSupportInquiry } from '@/features/support/api/submit-support-inquiry';
import type { RootStackParamList } from '@/navigation/types';
import { AccountFoundScreen } from '@/screens/auth/AccountFoundScreen';
import { PhoneVerificationScreen } from '@/screens/auth/PhoneVerificationScreen';
import { SignupFailureScreen } from '@/screens/auth/SignupFailureScreen';
import { useRemainingSeconds, withRemainingTime } from '@/screens/auth/use-remaining-seconds';
import { SupportInquiryScreen } from '@/screens/support/SupportInquiryScreen';
import { colors } from '@/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

type StartAccountRecovery = ReturnType<typeof createAuthRuntime>['startAccountRecovery'];
type AccountRecoveryFlow = ReturnType<StartAccountRecovery>;

interface AccountRecoveryNavigatorProps {
  entry: AccountRecoveryEntry;
  startAccountRecovery: StartAccountRecovery;
  /** provider가 있으면 그 SNS 로그인을 시작한다. null이면 로그인 화면으로 돌아간다. */
  onFinish: (provider: FirebaseLoginProvider | null) => void;
}

/** 계정 찾기 한 번. 소유자는 flowId를 key로 넘겨 진입마다 새 흐름을 만든다. */
export function AccountRecoveryNavigator({
  entry,
  startAccountRecovery,
  onFinish,
}: AccountRecoveryNavigatorProps): ReactElement | null {
  const [flow, setFlow] = useState<AccountRecoveryFlow | null>(null);

  useEffect(() => {
    const created = startAccountRecovery(entry);
    setFlow(created);
    return () => created.dispose();
  }, [startAccountRecovery, entry]);

  if (!flow) return null;

  return (
    <Stack.Navigator
      key="account-recovery"
      screenOptions={{ headerShown: false, gestureEnabled: false }}
    >
      <Stack.Screen name="AccountRecovery">
        {(props) => <AccountRecoveryRoute {...props} flow={flow} onFinish={onFinish} />}
      </Stack.Screen>
      <Stack.Screen
        name="SupportInquiry"
        component={SupportInquiryRoute}
        options={{ gestureEnabled: true }}
      />
    </Stack.Navigator>
  );
}

function AccountRecoveryRoute({
  navigation,
  flow,
  onFinish,
}: NativeStackScreenProps<RootStackParamList, 'AccountRecovery'> & {
  flow: AccountRecoveryFlow;
  onFinish: (provider: FirebaseLoginProvider | null) => void;
}) {
  const state = useStore(flow, (snapshot) => snapshot);
  const { view } = state;
  const blockedSeconds = useRemainingSeconds(state.blockedUntil);
  const lookupRetrySeconds = useRemainingSeconds(
    view.step === 'lookup-failed' ? view.retryAt : null,
  );

  const goBack = () => {
    if (view.step === 'code' && !view.verifying) flow.editPhone();
    else onFinish(null);
  };
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;

  useEffect(() => {
    // Android 하드웨어 뒤로 가기도 화면의 뒤로 가기와 같은 규칙을 따른다. 문의 화면은 스택이 닫는다.
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!navigation.isFocused()) return false;
      goBackRef.current();
      return true;
    });
    return () => subscription.remove();
  }, [navigation]);

  const content = (() => {
    switch (view.step) {
      case 'checking':
      case 'looking-up':
        return (
          <View className="flex-1 items-center justify-center gap-content">
            <ActivityIndicator color={colors.brand.text} />
            <Text accessibilityLiveRegion="polite">가입한 계정을 확인하고 있어요.</Text>
          </View>
        );
      case 'phone':
      case 'code':
        return (
          <PhoneVerificationScreen
            title="가입한 계정 찾기"
            state={
              view.step === 'phone'
                ? { step: 'number', phone: state.phone, error: state.error }
                : { step: 'code', phone: state.phone, code: state.code, error: state.error }
            }
            busy={
              state.preparing ||
              (view.step === 'phone' && view.sending) ||
              (view.step === 'code' && view.verifying)
            }
            blockedSeconds={blockedSeconds}
            numberAction={
              view.step === 'phone' && state.canRetryCredential
                ? {
                    label: withRemainingTime('이전 로그인 수단 확인', blockedSeconds),
                    disabled: blockedSeconds !== null,
                    onPress: flow.retryCredential,
                  }
                : undefined
            }
            onBack={goBack}
            onChangePhone={flow.setPhone}
            onRequestCode={() => void flow.requestCode()}
            onEditPhone={flow.editPhone}
            onChangeCode={flow.setCode}
            onResendCode={() => void flow.requestCode()}
            onVerify={() => void flow.verifyCode()}
          />
        );
      case 'found':
        return (
          <AccountFoundScreen
            provider={view.provider}
            maskedEmail={view.maskedEmail}
            onSignIn={() => onFinish(view.provider)}
            onBack={() => onFinish(null)}
          />
        );
      case 'not-found':
        return (
          <SignupFailureScreen
            title="가입한 계정이 없어요"
            message="이 번호로 가입한 계정을 찾지 못했어요."
            primary={{ label: '로그인 화면으로', onPress: () => onFinish(null) }}
          />
        );
      case 'action-required':
        // 정지만 뜻하지 않는다(탈퇴 처리 중, SNS 연결 상태 문제 등). 문구는 2026-10-07 서버 답.
        return (
          <SignupFailureScreen
            title="계정 상태를 확인해야 해요"
            message="계정 상태 확인이 필요합니다. 고객지원에 문의해주세요."
            primary={{
              label: '문의하기',
              onPress: () =>
                navigation.navigate('SupportInquiry', {
                  screen: 'account-recovery',
                  category: 'AUTH',
                }),
            }}
            secondary={{ label: '로그인 화면으로', onPress: () => onFinish(null) }}
          />
        );
      case 'lookup-failed':
        return (
          <SignupFailureScreen
            title="계정을 확인하지 못했어요"
            message={view.message}
            primary={
              view.action === 'retry'
                ? {
                    label: withRemainingTime('다시 시도하기', lookupRetrySeconds),
                    disabled: lookupRetrySeconds !== null,
                    onPress: flow.retryLookup,
                  }
                : { label: '처음부터 다시 하기', onPress: flow.restart }
            }
            secondary={{ label: '로그인 화면으로', onPress: () => onFinish(null) }}
          />
        );
    }
  })();

  return (
    <SafeAreaView className="flex-1 bg-surface-subtle" edges={['top', 'bottom']}>
      {content}
    </SafeAreaView>
  );
}

function SupportInquiryRoute({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'SupportInquiry'>) {
  return (
    <SupportInquiryScreen
      entry={route.params}
      onBack={navigation.goBack}
      sendInquiry={submitSupportInquiry}
    />
  );
}
