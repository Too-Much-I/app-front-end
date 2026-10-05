import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, BackHandler, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Text } from '@/components/ui/Text';
import type { createAuthRuntime } from '@/features/auth/auth-runtime';
import type { GuestMergeFlowState } from '@/features/auth/guest-merge-flow';
import type { IdentityEnrollment } from '@/features/auth/identity-login-types';
import type { AuthSession } from '@/features/auth/types';
import type { RootStackParamList } from '@/navigation/types';
import { GuestMergeConfirmScreen } from '@/screens/auth/GuestMergeConfirmScreen';
import { SignupFailureScreen } from '@/screens/auth/SignupFailureScreen';
import { SupportInquiryScreen } from '@/screens/support/SupportInquiryScreen';
import { colors } from '@/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

type StartMerge = ReturnType<typeof createAuthRuntime>['startMerge'];
type MergeFlow = ReturnType<StartMerge>;

interface GuestMergeNavigatorProps {
  uid: string;
  startMerge: StartMerge;
  onComplete: (session: AuthSession) => Promise<void>;
  onEnrollmentRequired: (enrollment: IdentityEnrollment) => void;
  onCancel: () => void;
}

/** Guest 병합 한 흐름. 소유자는 flowId를 key로 넘겨 새 로그인마다 새 흐름을 만든다. */
export function GuestMergeNavigator({
  uid,
  startMerge,
  onComplete,
  onEnrollmentRequired,
  onCancel,
}: GuestMergeNavigatorProps): ReactElement | null {
  // 부모가 렌더마다 새 콜백을 넘겨도 흐름을 다시 만들지 않는다.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onEnrollmentRequiredRef = useRef(onEnrollmentRequired);
  onEnrollmentRequiredRef.current = onEnrollmentRequired;
  const [flow, setFlow] = useState<MergeFlow | null>(null);

  useEffect(() => {
    const created = startMerge({
      uid,
      onComplete: (session) => onCompleteRef.current(session),
      onEnrollmentRequired: (enrollment) => onEnrollmentRequiredRef.current(enrollment),
    });
    setFlow(created);
    return () => created.dispose();
  }, [startMerge, uid]);

  if (!flow) return null;

  return (
    <Stack.Navigator
      key="guest-merge"
      screenOptions={{ headerShown: false, gestureEnabled: false }}
    >
      <Stack.Screen name="GuestMerge">
        {(props) => <GuestMergeRoute {...props} flow={flow} onCancel={onCancel} />}
      </Stack.Screen>
      <Stack.Screen
        name="SupportInquiry"
        component={SupportInquiryRoute}
        options={{ gestureEnabled: true }}
      />
    </Stack.Navigator>
  );
}

function GuestMergeRoute({
  navigation,
  flow,
  onCancel,
}: NativeStackScreenProps<RootStackParamList, 'GuestMerge'> & {
  flow: MergeFlow;
  onCancel: () => void;
}) {
  const state = useStore(flow, (snapshot) => snapshot.state);
  const [isCancelConfirmationVisible, setCancelConfirmationVisible] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    // Android 하드웨어 뒤로 가기는 확인 화면에서만 취소 확인을 띄운다. 제출 중·실패 화면은 버튼으로만 나간다.
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!navigation.isFocused()) return false;
      if (stateRef.current.status === 'confirming') setCancelConfirmationVisible(true);
      return true;
    });
    return () => subscription.remove();
  }, [navigation]);

  return (
    <SafeAreaView className="flex-1 bg-surface-subtle" edges={['top', 'bottom']}>
      <GuestMergeContent
        state={state}
        flow={flow}
        onRequestCancel={() => setCancelConfirmationVisible(true)}
        onCancel={onCancel}
        onHelp={() => navigation.navigate('SupportInquiry')}
      />
      <ConfirmModal
        visible={isCancelConfirmationVisible}
        message="다른 SNS 계정으로 로그인하시겠어요?"
        cancelLabel="취소"
        confirmLabel="확인"
        confirmHint="학습 기록을 합치지 않고 로그인 화면으로 이동합니다"
        onCancel={() => setCancelConfirmationVisible(false)}
        onConfirm={() => {
          setCancelConfirmationVisible(false);
          onCancel();
        }}
      />
    </SafeAreaView>
  );
}

function GuestMergeContent({
  state,
  flow,
  onRequestCancel,
  onCancel,
  onHelp,
}: {
  state: GuestMergeFlowState;
  flow: MergeFlow;
  onRequestCancel: () => void;
  onCancel: () => void;
  onHelp: () => void;
}): ReactElement {
  switch (state.status) {
    case 'confirming':
      return <GuestMergeConfirmScreen onConfirm={flow.confirm} onCancel={onRequestCancel} />;
    case 'submitting':
      return (
        <View className="flex-1 items-center justify-center gap-content">
          <ActivityIndicator color={colors.brand.text} />
          <Text accessibilityLiveRegion="polite">학습 기록을 합치고 있어요.</Text>
        </View>
      );
    case 'failed': {
      const toLogin = { label: '로그인 화면으로', onPress: onCancel };
      switch (state.nextAction) {
        case 'retry':
          return (
            <SignupFailureScreen
              title={state.title}
              message={state.message}
              primary={{ label: '다시 시도', onPress: flow.retry }}
              secondary={toLogin}
            />
          );
        case 'retry-or-help':
          return (
            <SignupFailureScreen
              title={state.title}
              message={state.message}
              primary={{ label: '다시 시도', onPress: flow.retry }}
              secondary={{ label: '도움 요청하기', onPress: onHelp }}
            />
          );
        case 'continue-signup':
          return (
            <SignupFailureScreen
              title={state.title}
              message={state.message}
              primary={{ label: '가입 이어가기', onPress: flow.retry }}
              secondary={toLogin}
            />
          );
        case 'get-help':
          return (
            <SignupFailureScreen
              title={state.title}
              message={state.message}
              primary={{ label: '도움 요청하기', onPress: onHelp }}
              secondary={toLogin}
            />
          );
        case 'sign-in-again':
          return (
            <SignupFailureScreen
              title={state.title}
              message={state.message}
              primary={{ label: '다시 로그인', onPress: onCancel }}
            />
          );
        case 'exit':
          return (
            <SignupFailureScreen title={state.title} message={state.message} primary={toLogin} />
          );
      }
    }
  }
}

function SupportInquiryRoute({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'SupportInquiry'>) {
  // TODO: 비로그인 문의 API 계약 확정 후 sendInquiry 어댑터 연결.
  return <SupportInquiryScreen onBack={navigation.goBack} />;
}
