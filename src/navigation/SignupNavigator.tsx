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
import type { IdentityEnrollment } from '@/features/auth/identity-login-types';
import type { SignupFlowState, SignupStep } from '@/features/auth/signup-flow';
import type { createSignupDraftStore } from '@/features/auth/signup-draft-store';
import type { AuthSession } from '@/features/auth/types';
import type { RootStackParamList } from '@/navigation/types';
import {
  PhoneVerificationScreen,
  type PhoneVerificationViewState,
} from '@/screens/auth/PhoneVerificationScreen';
import { SignupConsentScreen } from '@/screens/auth/SignupConsentScreen';
import { SignupFailureScreen } from '@/screens/auth/SignupFailureScreen';
import { SignupNicknameScreen } from '@/screens/auth/SignupNicknameScreen';
import { SettingsWebViewScreen } from '@/screens/settings/SettingsWebViewScreen';
import { colors } from '@/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

type StartSignup = ReturnType<typeof createAuthRuntime>['startEnrollment'];
type Signup = ReturnType<StartSignup>;
type DraftStore = ReturnType<typeof createSignupDraftStore>;

const POLICY_PAGES = {
  terms: { path: '/app-settings/terms', title: '이용약관' },
  privacy: { path: '/app-settings/privacy', title: '개인정보 처리방침' },
} as const;

interface SignupNavigatorProps {
  enrollment: IdentityEnrollment;
  uid: string;
  draftStore: DraftStore;
  startSignup: StartSignup;
  onComplete: (session: AuthSession) => Promise<void>;
  /** Guest 승격 중 이 SNS 계정이 다른 MEMBER 소유로 확인됐을 때. direct signup은 부르지 않는다. */
  onMergeRequired: () => void;
  onCancel: () => void;
}

/** 가입·Guest 승격 한 흐름. 소유자는 flowId를 key로 넘겨 새 로그인마다 새 흐름을 만든다. */
export function SignupNavigator({
  enrollment,
  uid,
  draftStore,
  startSignup,
  onComplete,
  onMergeRequired,
  onCancel,
}: SignupNavigatorProps): ReactElement | null {
  // 부모가 렌더마다 새 콜백을 넘겨도 흐름을 다시 만들지 않는다.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onMergeRequiredRef = useRef(onMergeRequired);
  onMergeRequiredRef.current = onMergeRequired;
  const [signup, setSignup] = useState<Signup | null>(null);

  useEffect(() => {
    const created = startSignup({
      enrollment,
      uid,
      onComplete: (session) => onCompleteRef.current(session),
      onMergeRequired: () => onMergeRequiredRef.current(),
    });
    setSignup(created);
    return () => created.flow.dispose();
  }, [startSignup, enrollment, uid]);

  if (!signup) return null;

  return (
    <Stack.Navigator key="signup" screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="Signup">
        {(props) => (
          <SignupFlowRoute {...props} signup={signup} draftStore={draftStore} onCancel={onCancel} />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="SettingsWebView"
        component={SettingsWebViewScreen}
        options={{ gestureEnabled: true }}
      />
    </Stack.Navigator>
  );
}

function SignupFlowRoute({
  navigation,
  signup,
  draftStore,
  onCancel,
}: NativeStackScreenProps<RootStackParamList, 'Signup'> & {
  signup: Signup;
  draftStore: DraftStore;
  onCancel: () => void;
}) {
  const { flow } = signup;
  const state = useStore(flow, (snapshot) => snapshot.state);
  const [isExitConfirmationVisible, setExitConfirmationVisible] = useState(false);
  const steps = flow.getSteps();
  const position = (step: SignupStep) => ({
    step: steps.indexOf(step) + 1,
    totalSteps: steps.length,
  });

  const goBack = () => {
    if (flow.goBack() === 'confirm-exit') setExitConfirmationVisible(true);
  };
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;

  useEffect(() => {
    // Android 하드웨어 뒤로 가기도 화면의 뒤로 가기와 같은 규칙을 따른다. 약관 웹뷰는 스택이 닫는다.
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!navigation.isFocused()) return false;
      goBackRef.current();
      return true;
    });
    return () => subscription.remove();
  }, [navigation]);

  return (
    <SafeAreaView className="flex-1 bg-surface-subtle" edges={['top', 'bottom']}>
      <SignupStepContent
        state={state}
        signup={signup}
        draftStore={draftStore}
        position={position}
        isLastStep={(step) => steps[steps.length - 1] === step}
        onBack={goBack}
        onCancel={onCancel}
        onOpenPolicy={(policy) => navigation.navigate('SettingsWebView', POLICY_PAGES[policy])}
      />
      <ConfirmModal
        visible={isExitConfirmationVisible}
        warningBadge
        message="지금 그만두면 입력한 내용이 지워지고, 처음부터 SNS 로그인을 다시 해야 해요."
        cancelLabel="계속 가입하기"
        confirmLabel="가입 그만두기"
        confirmTone="danger"
        confirmHint="가입을 멈추고 로그인 화면으로 이동합니다"
        onCancel={() => setExitConfirmationVisible(false)}
        onConfirm={() => {
          setExitConfirmationVisible(false);
          onCancel();
        }}
      />
    </SafeAreaView>
  );
}

function SignupStepContent({
  state,
  signup,
  draftStore,
  position,
  isLastStep,
  onBack,
  onCancel,
  onOpenPolicy,
}: {
  state: SignupFlowState;
  signup: Signup;
  draftStore: DraftStore;
  position: (step: SignupStep) => { step: number; totalSteps: number };
  isLastStep: (step: SignupStep) => boolean;
  onBack: () => void;
  onCancel: () => void;
  onOpenPolicy: (policy: 'terms' | 'privacy') => void;
}): ReactElement {
  const { flow } = signup;
  switch (state.status) {
    case 'editing':
      switch (state.step) {
        case 'nickname':
          return (
            <SignupNicknameScreen
              draftStore={draftStore}
              {...position('nickname')}
              onBack={onBack}
              onContinue={flow.completeNickname}
            />
          );
        case 'consents':
          return (
            <SignupConsentScreen
              draftStore={draftStore}
              {...position('consents')}
              loading={state.policies === 'loading'}
              continueLabel={
                isLastStep('consents') ? '가입 완료하기' : '휴대전화 인증으로 계속하기'
              }
              onBack={onBack}
              onContinue={flow.completeConsents}
              onOpenPolicy={onOpenPolicy}
            />
          );
        case 'phone':
          return (
            <SignupPhoneStep
              signup={signup}
              draftStore={draftStore}
              {...position('phone')}
              onBack={onBack}
            />
          );
      }
    case 'policyUnavailable':
      return (
        <SignupFailureScreen
          title="약관 정보를 불러오지 못했어요"
          message={state.message}
          primary={{ label: '다시 시도하기', onPress: () => void flow.retryPolicies() }}
          secondary={{ label: '이전 단계로', onPress: onBack }}
        />
      );
    case 'submitting':
      return (
        <View className="flex-1 items-center justify-center gap-content">
          <ActivityIndicator color={colors.brand.text} />
          <Text accessibilityLiveRegion="polite">가입을 마무리하고 있어요.</Text>
        </View>
      );
    case 'failed':
      switch (state.nextAction) {
        case 'retry':
          return (
            <SignupFailureScreen
              title="가입을 완료하지 못했어요"
              message={state.message}
              primary={{ label: '다시 시도하기', onPress: flow.retrySubmit }}
              secondary={{ label: '이전 단계로', onPress: onBack }}
            />
          );
        case 'edit':
          return (
            <SignupFailureScreen
              title="가입을 완료하지 못했어요"
              message={state.message}
              primary={{ label: '정보 수정하기', onPress: flow.retrySubmit }}
            />
          );
        case 'sign-in-again':
        case 'exit':
          return (
            <SignupFailureScreen
              title="가입을 완료하지 못했어요"
              message={state.message}
              primary={{ label: '로그인 화면으로', onPress: onCancel }}
            />
          );
      }
  }
}

function SignupPhoneStep({
  signup,
  draftStore,
  step,
  totalSteps,
  onBack,
}: {
  signup: Signup;
  draftStore: DraftStore;
  step: number;
  totalSteps: number;
  onBack: () => void;
}) {
  const { flow, phone } = signup;
  const draftPhone = useStore(draftStore, (draft) => draft.phone);
  const verification = useStore(phone, (snapshot) => snapshot);
  const { stage, code, error } = verification;

  const view: PhoneVerificationViewState = (() => {
    switch (stage.status) {
      case 'idle':
      case 'sending':
        return { step: 'number', phone: draftPhone, error };
      case 'code':
      case 'verifying':
        return { step: 'code', phone: draftPhone, code, error };
      case 'verified':
        return { step: 'complete', phone: draftPhone };
    }
  })();
  const busy = (stage.status === 'sending' && !stage.delayed) || stage.status === 'verifying';

  return (
    <PhoneVerificationScreen
      state={view}
      step={step}
      totalSteps={totalSteps}
      busy={busy}
      // 인증번호 입력 중에는 번호 입력으로, 그 밖에는 이전 가입 단계로 돌아간다.
      onBack={stage.status === 'code' ? phone.editPhone : onBack}
      onChangePhone={draftStore.setPhone}
      onRequestCode={phone.requestCode}
      onEditPhone={phone.editPhone}
      onChangeCode={phone.setCode}
      onResendCode={phone.requestCode}
      onVerify={() => void phone.verifyCode()}
      onContinue={flow.completePhoneVerification}
    />
  );
}
