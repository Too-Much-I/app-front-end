import "./global.css";

import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { PortraitOnlyNotice } from "@/components/ui/PortraitOnlyNotice";
import { useAuth } from "@/features/auth/auth-context";
import { AuthProvider } from "@/features/auth/auth-provider";
import { RootNavigator } from "@/navigation/RootNavigator";
import { useRemScale } from "@/theme/rem-scale";
import { useAppFonts } from "@/theme/use-app-fonts";

function AppContent() {
  // early return보다 위에서 호출해야 훅 순서가 안정된다.
  useRemScale();

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
      {/* NavigationContainer 바깥이라 웹뷰를 포함한 모든 화면 위에 뜬다. */}
      <PortraitOnlyNotice />
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
