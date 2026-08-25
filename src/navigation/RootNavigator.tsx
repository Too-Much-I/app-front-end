import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { AuthBootstrapState } from "@/features/auth/types";
import { MainTabNavigator } from "@/navigation/MainTabNavigator";
import type { RootStackParamList } from "@/navigation/types";
import { AuthRecoveryScreen } from "@/screens/auth/AuthRecoveryScreen";
import { ConsentScreen } from "@/screens/consent/ConsentScreen";
import { NotificationsScreen } from "@/screens/notifications/NotificationsScreen";
import { ReanswerScreen } from "@/screens/reanswer/ReanswerScreen";
import { SettingsScreen } from "@/screens/settings/SettingsScreen";
import { SettingsWebViewScreen } from "@/screens/settings/SettingsWebViewScreen";
import { ChallengeResultScreen } from "@/screens/ten-second-challenge/ChallengeResultScreen";
import { TenSecondChallengeScreen } from "@/screens/ten-second-challenge/TenSecondChallengeScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

function isConsentFlow(state: AuthBootstrapState): boolean {
  return (
    state.status === "CONSENT_REQUIRED" ||
    state.status === "CONSENT_UPDATING" ||
    (state.status === "GUEST_RECOVERING" && state.source === "consent-submit") ||
    (state.status === "RETRYABLE_ERROR" && state.source === "consent-submit")
  );
}

export function RootNavigator({ state }: { state: AuthBootstrapState }) {
  if (isConsentFlow(state)) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Consent" component={ConsentScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="SettingsWebView" component={SettingsWebViewScreen} />
      </Stack.Navigator>
    );
  }

  if (state.status === "RETRYABLE_ERROR") {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="AuthRecovery"
          component={AuthRecoveryScreen}
          options={{ gestureEnabled: false }}
        />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen
        name="Reanswer"
        component={ReanswerScreen}
        options={{ gestureEnabled: false }}
      />
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
