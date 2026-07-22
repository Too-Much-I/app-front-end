import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { MainTabNavigator } from "@/navigation/MainTabNavigator";
import type { RootStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
    </Stack.Navigator>
  );
}
