import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { MainTabNavigator } from "@/navigation/MainTabNavigator";
import type { RootStackParamList } from "@/navigation/types";
import { ConsentScreen } from "@/screens/consent/ConsentScreen";
import { NotificationsScreen } from "@/screens/notifications/NotificationsScreen";
import { ReanswerScreen } from "@/screens/reanswer/ReanswerScreen";
import { SettingsScreen } from "@/screens/settings/SettingsScreen";
import { SettingsWebViewScreen } from "@/screens/settings/SettingsWebViewScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

type RootNavigatorProps = {
  /** 부팅 시 로컬 동의 기록 유무로 `App.tsx`가 정한다. */
  initialRouteName: "Consent" | "MainTabs";
};

export function RootNavigator({ initialRouteName }: RootNavigatorProps) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      {/* 동의 전에는 스와이프/뒤로 가기로 건너뛸 수 없어야 하므로 제스처를 막는다. */}
      <Stack.Screen
        name="Consent"
        component={ConsentScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      {/* 녹음 중 스와이프로 빠져나가면 확인 없이 녹음이 사라지므로 제스처를 막는다. */}
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
