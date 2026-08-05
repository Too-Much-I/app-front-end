import "./global.css";

import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/auth-context";
import { AuthProvider } from "@/features/auth/auth-provider";
import { RootNavigator } from "@/navigation/RootNavigator";
import { useAppFonts } from "@/theme/use-app-fonts";

function AppContent() {
  const { ready: fontsReady, onLayoutRootView } = useAppFonts();
  const { state } = useAuth();
  const authHasRenderableState =
    state.status === "AUTHENTICATED" ||
    state.status === "CONSENT_REQUIRED" ||
    state.status === "CONSENT_UPDATING" ||
    state.status === "RETRYABLE_ERROR" ||
    (state.status === "GUEST_RECOVERING" && state.source === "consent-submit");

  if (!fontsReady || !authHasRenderableState) {
    return null;
  }

  return (
    <View className="flex-1" onLayout={onLayoutRootView}>
      <NavigationContainer>
        <RootNavigator state={state} />
      </NavigationContainer>
      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
