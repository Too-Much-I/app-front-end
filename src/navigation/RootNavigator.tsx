import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { useState, type ReactElement } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useStore } from "zustand";

import { SupportInquiryScreen } from "@/screens/support/SupportInquiryScreen";
import { useAuth } from "@/features/auth/auth-context";
import type { createAuthCoordinator } from "@/features/auth/auth-coordinator";
import { useAuthBootstrap } from "@/features/auth/use-auth-bootstrap";
import {
  LoginScreen,
  type LoginProviderChoice,
} from "@/screens/auth/LoginScreen";
import { Text } from "@/components/ui/Text";
import { colors } from "@/theme";

import type { AuthBootstrapState } from "@/features/auth/types";
import { MainTabNavigator } from "@/navigation/MainTabNavigator";
import type { RootStackParamList } from "@/navigation/types";
import { AuthRecoveryScreen } from "@/screens/auth/AuthRecoveryScreen";
import { ConsentScreen } from "@/screens/consent/ConsentScreen";
import { NotificationsScreen } from "@/screens/notifications/NotificationsScreen";
import { ReanswerScreen } from "@/screens/reanswer/ReanswerScreen";
import { SettingsScreen } from "@/screens/settings/SettingsScreen";
import { SettingsWebViewScreen } from "@/screens/settings/SettingsWebViewScreen";
import { ChallengeResultScreen } from "@/screens/challenge/ChallengeResultScreen";
import { ChallengeStageScreen } from "@/screens/challenge/ChallengeStageScreen";
import { TenSecondChallengeScreen } from "@/screens/challenge/TenSecondChallengeScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

function isConsentFlow(state: AuthBootstrapState): boolean {
  return (
    state.status === "CONSENT_REQUIRED" ||
    state.status === "CONSENT_UPDATING" ||
    (state.status === "GUEST_RECOVERING" &&
      state.source === "consent-submit") ||
    (state.status === "RETRYABLE_ERROR" && state.source === "consent-submit")
  );
}

function LegacyRootNavigator({ state }: { state: AuthBootstrapState }) {
  if (isConsentFlow(state)) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="Consent"
          component={LegacyConsentRoute}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen
          name="SettingsWebView"
          component={SettingsWebViewScreen}
        />
      </Stack.Navigator>
    );
  }

  if (state.status === "RETRYABLE_ERROR") {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="AuthRecovery"
          component={LegacyAuthRecoveryRoute}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen name="SupportInquiry" component={SupportInquiryRoute} />
      </Stack.Navigator>
    );
  }

  return <MemberRootNavigator />;
}

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

function LegacyConsentRoute(
  props: NativeStackScreenProps<RootStackParamList, "Consent">,
) {
  const { state, acceptConsent, retry, setPendingQualityReviewConsent } =
    useAuth();
  const [requirements] = useState(() =>
    state.status === "CONSENT_REQUIRED"
      ? state.requiredItems
      : { privacy: true, terms: true },
  );
  const [mode] = useState(() =>
    state.status === "CONSENT_REQUIRED" ? state.mode : "new",
  );
  return (
    <ConsentScreen
      {...props}
      mode={mode}
      requiredItems={requirements}
      isSubmitting={
        state.status === "GUEST_RECOVERING" ||
        state.status === "CONSENT_UPDATING" ||
        (state.status === "RETRYABLE_ERROR" &&
          state.source === "consent-submit" &&
          state.isRetrying === true)
      }
      submitError={
        state.status === "RETRYABLE_ERROR" && state.source === "consent-submit"
          ? state.message
          : null
      }
      onAccept={async (quality) => {
        setPendingQualityReviewConsent(quality);
        if (
          state.status === "RETRYABLE_ERROR" &&
          state.source === "consent-submit"
        )
          await retry();
        else await acceptConsent();
      }}
    />
  );
}

function LegacyAuthRecoveryRoute({
  navigation,
}: NativeStackScreenProps<RootStackParamList, "AuthRecovery">) {
  const { state, retry } = useAuth();
  return (
    <AuthRecoveryScreen
      message={
        state.status === "RETRYABLE_ERROR"
          ? state.message
          : "인증 상태를 다시 확인하고 있습니다."
      }
      isRetrying={
        state.status === "RETRYABLE_ERROR" && state.isRetrying === true
      }
      onRetry={retry}
      onHelp={() => navigation.navigate("SupportInquiry")}
    />
  );
}

type CoordinatorNavigationProps = {
  coordinator: ReturnType<typeof createAuthCoordinator>;
  onSelectProvider: (provider: LoginProviderChoice) => void;
  onBrowse: () => void;
  onClose: () => void;
};

function CoordinatorRootNavigator({
  coordinator,
  ...loginActions
}: CoordinatorNavigationProps): ReactElement {
  useAuthBootstrap(coordinator);
  const state = useStore(coordinator, (snapshot) => snapshot.state);

  switch (state.status) {
    case "idle":
    case "restoring":
      return (
        <View className="flex-1 items-center justify-center gap-content bg-surface-subtle">
          <ActivityIndicator color={colors.brand.text} />
          <Text accessibilityLiveRegion="polite">
            로그인 정보를 확인하고 있어요.
          </Text>
        </View>
      );
    case "noSession":
    case "guest":
      return (
        <Stack.Navigator
          key="login"
          screenOptions={{ headerShown: false, gestureEnabled: false }}
        >
          <Stack.Screen name="AuthLogin">
            {() => (
              <SafeAreaView className="flex-1 bg-surface-subtle">
                <LoginScreen {...loginActions} />
              </SafeAreaView>
            )}
          </Stack.Screen>
        </Stack.Navigator>
      );
    case "authenticated":
      return <MemberRootNavigator />;
    case "consent":
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
                isSubmitting={state.submission.status === "submitting"}
                submitError={
                  state.submission.status === "failed"
                    ? state.submission.message
                    : null
                }
                onAccept={coordinator.acceptConsent}
              />
            )}
          </Stack.Screen>
          <Stack.Screen
            name="SettingsWebView"
            component={SettingsWebViewScreen}
          />
        </Stack.Navigator>
      );
    case "error":
      return (
        <Stack.Navigator
          key="recovery"
          screenOptions={{ headerShown: false, gestureEnabled: false }}
        >
          <Stack.Screen name="AuthRecovery">
            {({ navigation }) => (
              <AuthRecoveryScreen
                message={state.message}
                isRetrying={state.isRetrying}
                onRetry={coordinator.retry}
                recoveryAction={
                  state.nextAction === "get-help" ? "get-help" : "retry"
                }
                onHelp={() => navigation.navigate("SupportInquiry")}
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

/** 기존 앱은 state 경로를 사용한다. 실제 복원 구현 준비 후 coordinator 경로로 전환한다. */
export function RootNavigator(
  props: { state: AuthBootstrapState } | CoordinatorNavigationProps,
) {
  if ("coordinator" in props) return <CoordinatorRootNavigator {...props} />;
  return <LegacyRootNavigator state={props.state} />;
}

function SupportInquiryRoute({
  navigation,
}: NativeStackScreenProps<RootStackParamList, "SupportInquiry">) {
  // TODO: 비로그인 문의 API 계약 확정 후 sendInquiry 어댑터 연결.
  return <SupportInquiryScreen onBack={navigation.goBack} />;
}
