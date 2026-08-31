import "./global.css";

import {
  NavigationContainer,
  useNavigationContainerRef,
} from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useRef } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { PortraitOnlyNotice } from "@/components/ui/PortraitOnlyNotice";
import { useAuth } from "@/features/auth/auth-context";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { OrientationProvider } from "@/features/orientation/OrientationProvider";
import { useOrientation } from "@/features/orientation/orientation-context";
import { RootNavigator } from "@/navigation/RootNavigator";
import type { RootStackParamList } from "@/navigation/types";
import { trackScreenView } from "@/lib/amplitude";
import { queryClient } from "@/lib/query-client";
import { IS_SENTRY_VALIDATION_MODE } from "@/lib/sentry-validation-mode";
import { SentryValidationScreen } from "@/screens/diagnostics/SentryValidationScreen";
import { useRemScale } from "@/theme/rem-scale";
import { useAppFonts } from "@/theme/use-app-fonts";

function AppContent() {
  const { isLandscapeTableRequested } = useOrientation();
  // early return보다 위에서 호출해야 훅 순서가 안정된다.
  useRemScale(isLandscapeTableRequested);

  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const previousRouteNameRef = useRef<string | undefined>(undefined);

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
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          const routeName = navigationRef.getCurrentRoute()?.name;
          previousRouteNameRef.current = routeName;
          if (routeName) trackScreenView(routeName);
        }}
        onStateChange={() => {
          const routeName = navigationRef.getCurrentRoute()?.name;
          // 같은 화면에서 파라미터만 바뀐 경우까지 조회로 세지 않는다.
          if (routeName && routeName !== previousRouteNameRef.current) {
            trackScreenView(routeName);
          }
          previousRouteNameRef.current = routeName;
        }}
      >
        <RootNavigator state={state} />
      </NavigationContainer>
      <StatusBar style="auto" />
      {/* NavigationContainer 바깥이라 웹뷰를 포함한 모든 화면 위에 뜬다. */}
      <PortraitOnlyNotice />
    </View>
  );
}

function SentryValidationAppContent() {
  useRemScale();
  const { ready: fontsReady, onLayoutRootView } = useAppFonts();

  if (!fontsReady) return null;

  return (
    <View className="flex-1" onLayout={onLayoutRootView}>
      <SentryValidationScreen />
      <StatusBar style="dark" />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      {IS_SENTRY_VALIDATION_MODE ? (
        <SentryValidationAppContent />
      ) : (
        // 검증 모드는 화면 하나만 띄우고 서버 조회를 하지 않으므로 캐시도 필요 없다.
        <QueryClientProvider client={queryClient}>
          <OrientationProvider>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </OrientationProvider>
        </QueryClientProvider>
      )}
    </SafeAreaProvider>
  );
}
