import { NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { SignupDraftContext, useSignupDraftStore } from '@/features/auth/signup-draft-context';
import { createSignupDraftStore } from '@/features/auth/signup-draft-store';
import type { AuthPreviewStackParamList } from '@/navigation/types';
import {
  AUTH_PREVIEW_FIXTURE,
  requestPreviewPhoneCode,
  validatePreviewNickname,
  verifyPreviewPhoneCode,
} from '@/screens/auth/auth-preview-fixtures';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import {
  PhoneVerificationScreen,
  type PhoneVerificationViewState,
} from '@/screens/auth/PhoneVerificationScreen';
import { SupportInquiryScreen } from '@/screens/support/SupportInquiryScreen';
import { SignupProfileScreen } from '@/screens/auth/SignupProfileScreen';
import { useAppFonts } from '@/theme/use-app-fonts';
import { useRemScale } from '@/theme/rem-scale';

const Stack = createNativeStackNavigator<AuthPreviewStackParamList>();

function explainPreviewOnly() {
  Alert.alert(
    '화면 미리보기',
    '현재는 로그인·가입 화면만 확인할 수 있어요. 실제 로그인과 둘러보기는 연결하지 않았어요.',
  );
}

function LoginPreviewRoute({
  navigation,
}: NativeStackScreenProps<AuthPreviewStackParamList, 'LoginPreview'>) {
  const draftStore = useSignupDraftStore();
  const startSignupPreview = () => {
    draftStore.reset();
    draftStore.setPolicyVersions(AUTH_PREVIEW_FIXTURE.policyVersions);
    draftStore.setNickname(AUTH_PREVIEW_FIXTURE.nickname);
    draftStore.setPhone(AUTH_PREVIEW_FIXTURE.phone);
    navigation.navigate('SignupProfilePreview');
  };
  return (
    <View className="flex-1">
      <LoginScreen
        onSelectProvider={startSignupPreview}
        onBrowse={explainPreviewOnly}
        onClose={explainPreviewOnly}
      />
      <Button
        label="문의 화면 미리보기"
        variant="text"
        onPress={() => navigation.navigate('SupportInquiryPreview')}
      />
    </View>
  );
}

function SignupProfilePreviewRoute({
  navigation,
}: NativeStackScreenProps<AuthPreviewStackParamList, 'SignupProfilePreview'>) {
  const draftStore = useSignupDraftStore();
  return (
    <SignupProfileScreen
      draftStore={draftStore}
      validateNickname={validatePreviewNickname}
      onBack={navigation.goBack}
      onContinue={() => navigation.navigate('PhoneVerificationPreview')}
      onOpenPolicy={(policy) =>
        Alert.alert(
          policy === 'terms' ? '서비스 이용약관' : '개인정보 수집·이용',
          '화면 미리보기입니다. 실제 약관 전문과 버전은 연동 시 연결합니다. 입력은 가입 화면을 나갈 때까지 메모리에만 보관하며 서버에 전송하지 않습니다.',
        )
      }
    />
  );
}

function PhoneVerificationPreviewRoute({
  navigation,
}: NativeStackScreenProps<AuthPreviewStackParamList, 'PhoneVerificationPreview'>) {
  const draftStore = useSignupDraftStore();
  const phone = useStore(draftStore, (draft) => draft.phone);
  const phoneRevision = useStore(draftStore, (draft) => draft.phoneRevision);
  const [verification, setVerification] = useState<{
    revision: number;
    state: PhoneVerificationViewState;
  }>(() => ({
    revision: phoneRevision,
    state: { step: 'number', phone, error: null },
  }));
  // 인증번호와 인증 결과는 초안에 저장하지 않는다. 번호 변경·reset은 기존 시도를 무효화한다.
  const state: PhoneVerificationViewState =
    verification.revision === phoneRevision
      ? verification.state
      : { step: 'number', phone, error: null };
  const setState = (next: PhoneVerificationViewState) =>
    setVerification({
      revision: draftStore.getState().phoneRevision,
      state: next,
    });
  const editPhone = () => setState({ step: 'number', phone, error: null });
  const changePhone = (value: string) => {
    draftStore.setPhone(value);
    setState({ step: 'number', phone: value, error: null });
  };

  return (
    <View className="flex-1">
      {state.step !== 'complete' ? (
        <View className="flex-row items-center justify-center gap-content bg-sky-surface px-screen">
          <Text className="text-xs text-sky-text">
            {state.step === 'number' ? '목 번호: 010 1234 5678' : '목 인증번호: 123456'}
          </Text>
          <Button
            label="목데이터 채우기"
            variant="text"
            size="sm"
            onPress={() => {
              switch (state.step) {
                case 'number':
                  changePhone(AUTH_PREVIEW_FIXTURE.phone);
                  return;
                case 'code':
                  setState({
                    ...state,
                    code: AUTH_PREVIEW_FIXTURE.code,
                    error: null,
                  });
                  return;
              }
            }}
          />
        </View>
      ) : null}
      <PhoneVerificationScreen
        state={state}
        onBack={state.step === 'number' ? navigation.goBack : editPhone}
        onChangePhone={changePhone}
        onRequestCode={() => setState(requestPreviewPhoneCode(state))}
        onEditPhone={editPhone}
        onChangeCode={(code) => {
          if (state.step === 'code') setState({ ...state, code, error: null });
        }}
        onResendCode={() => {
          if (state.step === 'code') setState({ ...state, code: '', error: null });
          Alert.alert(
            '화면 미리보기',
            '인증번호 입력란을 초기화했어요. 실제 문자는 발송하지 않습니다.',
          );
        }}
        onVerify={() => setState(verifyPreviewPhoneCode(state))}
      />
    </View>
  );
}

/** AuthProvider를 마운트하지 않아 Guest 생성, 토큰 교체, API 호출 없이 UI만 확인한다. */
export function AuthPreviewNavigator() {
  const [draftStore] = useState(createSignupDraftStore);
  useRemScale();
  const { ready, onLayoutRootView } = useAppFonts();
  if (!ready) return null;

  return (
    <SafeAreaView className="flex-1 bg-surface-subtle" onLayout={onLayoutRootView}>
      <Text className="bg-sky-surface px-screen py-xs text-center text-xs text-sky-text">
        목 UI · 닉네임: 토스마스터 · 실제 인증 없음
      </Text>
      <View className="mx-auto w-full max-w-lg flex-1">
        <SignupDraftContext.Provider value={draftStore}>
          <NavigationContainer
            onStateChange={(state) => {
              // 버튼·하드웨어 뒤로 가기·스와이프 모두 가입 스택을 벗어나면 취소다.
              if (state && !state.routes.some((route) => route.name === 'SignupProfilePreview'))
                draftStore.reset();
            }}
          >
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="LoginPreview" component={LoginPreviewRoute} />
              <Stack.Screen name="SupportInquiryPreview">
                {({ navigation }) => <SupportInquiryScreen onBack={navigation.goBack} />}
              </Stack.Screen>
              <Stack.Screen name="SignupProfilePreview" component={SignupProfilePreviewRoute} />
              <Stack.Screen
                name="PhoneVerificationPreview"
                component={PhoneVerificationPreviewRoute}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </SignupDraftContext.Provider>
      </View>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}
