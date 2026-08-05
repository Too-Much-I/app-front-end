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
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="SettingsWebView" component={SettingsWebViewScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
