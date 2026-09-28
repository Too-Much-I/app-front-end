import { NavigationContainer } from "@react-navigation/native";
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Alert, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import type { AuthPreviewStackParamList } from "@/navigation/types";
import {
  AUTH_PREVIEW_FIXTURE,
  requestPreviewPhoneCode,
  validatePreviewNickname,
  verifyPreviewPhoneCode,
} from "@/screens/auth/auth-preview-fixtures";
import { LoginScreen } from "@/screens/auth/LoginScreen";
import {
  PhoneVerificationScreen,
  type PhoneVerificationViewState,
} from "@/screens/auth/PhoneVerificationScreen";
import { SignupProfileScreen } from "@/screens/auth/SignupProfileScreen";
import { useAppFonts } from "@/theme/use-app-fonts";
import { useRemScale } from "@/theme/rem-scale";

const Stack = createNativeStackNavigator<AuthPreviewStackParamList>();

function explainPreviewOnly() {
  Alert.alert(
    "화면 미리보기",
    "현재는 로그인·가입 화면만 확인할 수 있어요. 실제 로그인과 둘러보기는 연결하지 않았어요.",
  );
}

function LoginPreviewRoute({
  navigation,
}: NativeStackScreenProps<AuthPreviewStackParamList, "LoginPreview">) {
  return (
    <LoginScreen
      onSelectProvider={() => navigation.navigate("SignupProfilePreview")}
      onBrowse={explainPreviewOnly}
      onClose={explainPreviewOnly}
    />
  );
}

function SignupProfilePreviewRoute({
  navigation,
}: NativeStackScreenProps<AuthPreviewStackParamList, "SignupProfilePreview">) {
  return (
    <SignupProfileScreen
      initialNickname={AUTH_PREVIEW_FIXTURE.nickname}
      validateNickname={validatePreviewNickname}
      onBack={navigation.goBack}
      onContinue={() => navigation.navigate("PhoneVerificationPreview")}
      onOpenPolicy={(policy) =>
        Alert.alert(
          policy === "terms" ? "서비스 이용약관" : "개인정보 수집·이용",
          "화면 미리보기입니다. 실제 약관 전문과 버전은 연동 시 연결합니다. 이 화면의 동의는 저장하거나 전송하지 않습니다.",
        )
      }
    />
  );
}

function PhoneVerificationPreviewRoute({
  navigation,
}: NativeStackScreenProps<
  AuthPreviewStackParamList,
  "PhoneVerificationPreview"
>) {
  const [state, setState] = useState<PhoneVerificationViewState>({
    step: "number",
    phone: AUTH_PREVIEW_FIXTURE.phone,
    error: null,
  });
  const editPhone = () =>
    setState((current) => ({
      step: "number",
      phone: current.phone,
      error: null,
    }));

  return (
    <View className="flex-1">
      {state.step !== "complete" ? (
        <View className="flex-row items-center justify-center gap-content bg-sky-surface px-screen">
          <Text className="text-xs text-sky-text">
            {state.step === "number"
              ? "목 번호: 010 1234 5678"
              : "목 인증번호: 123456"}
          </Text>
          <Button
            label="목데이터 채우기"
            variant="text"
            size="sm"
            onPress={() =>
              setState((current) => {
                switch (current.step) {
                  case "number":
                    return {
                      ...current,
                      phone: AUTH_PREVIEW_FIXTURE.phone,
                      error: null,
                    };
                  case "code":
                    return {
                      ...current,
                      code: AUTH_PREVIEW_FIXTURE.code,
                      error: null,
                    };
                  case "complete":
                    return current;
                }
              })
            }
          />
        </View>
      ) : null}
      <PhoneVerificationScreen
        state={state}
        onBack={state.step === "number" ? navigation.goBack : editPhone}
        onChangePhone={(phone) =>
          setState({ step: "number", phone, error: null })
        }
        onRequestCode={() => setState(requestPreviewPhoneCode)}
        onEditPhone={editPhone}
        onChangeCode={(code) =>
          setState((current) =>
            current.step === "code"
              ? { ...current, code, error: null }
              : current,
          )
        }
        onResendCode={() => {
          setState((current) =>
            current.step === "code"
              ? { ...current, code: "", error: null }
              : current,
          );
          Alert.alert(
            "화면 미리보기",
            "인증번호 입력란을 초기화했어요. 실제 문자는 발송하지 않습니다.",
          );
        }}
        onVerify={() => setState(verifyPreviewPhoneCode)}
      />
    </View>
  );
}

/** AuthProvider를 마운트하지 않아 Guest 생성, 토큰 교체, API 호출 없이 UI만 확인한다. */
export function AuthPreviewNavigator() {
  useRemScale();
  const { ready, onLayoutRootView } = useAppFonts();
  if (!ready) return null;

  return (
    <SafeAreaView
      className="flex-1 bg-surface-subtle"
      onLayout={onLayoutRootView}
    >
      <Text className="bg-sky-surface px-screen py-xs text-center text-xs text-sky-text">
        목 UI · 닉네임: 토스마스터 · 실제 인증 없음
      </Text>
      <View className="mx-auto w-full max-w-lg flex-1">
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="LoginPreview" component={LoginPreviewRoute} />
            <Stack.Screen
              name="SignupProfilePreview"
              component={SignupProfilePreviewRoute}
            />
            <Stack.Screen
              name="PhoneVerificationPreview"
              component={PhoneVerificationPreviewRoute}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </View>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}
