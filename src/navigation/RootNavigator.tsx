import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { MainTabNavigator } from "@/navigation/MainTabNavigator";
import type { RootStackParamList } from "@/navigation/types";
import { ReanswerScreen } from "@/screens/reanswer/ReanswerScreen";
import { SettingsScreen } from "@/screens/settings/SettingsScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      {/* 녹음 중 스와이프로 빠져나가면 확인 없이 녹음이 사라지므로 제스처를 막는다. */}
      <Stack.Screen
        name="Reanswer"
        component={ReanswerScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}
