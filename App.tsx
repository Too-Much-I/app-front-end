import "./global.css";

import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useConsentGate } from "@/features/consent/use-consent-gate";
import { RootNavigator } from "@/navigation/RootNavigator";
import { useAppFonts } from "@/theme/use-app-fonts";

export default function App() {
  const { ready: fontsReady, onLayoutRootView } = useAppFonts();
  const { ready: consentReady, hasConsented } = useConsentGate();
  const ready = fontsReady && consentReady;

  if (!ready) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <View className="flex-1" onLayout={onLayoutRootView}>
        <NavigationContainer>
          <RootNavigator initialRouteName={hasConsented ? "MainTabs" : "Consent"} />
        </NavigationContainer>
        <StatusBar style="auto" />
      </View>
    </SafeAreaProvider>
  );
}
