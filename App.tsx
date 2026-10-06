import './global.css';

import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useRef } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PortraitOnlyNotice } from '@/components/ui/PortraitOnlyNotice';
import { appAuthRuntime } from '@/features/auth/app-auth-runtime';
import { OrientationProvider } from '@/features/orientation/OrientationProvider';
import { useOrientation } from '@/features/orientation/orientation-context';
import { AuthPreviewNavigator } from '@/navigation/AuthPreviewNavigator';
import { RootNavigator } from '@/navigation/RootNavigator';
import { GuestMergeNavigator } from '@/navigation/GuestMergeNavigator';
import { SignupNavigator } from '@/navigation/SignupNavigator';
import type { RootStackParamList } from '@/navigation/types';
import { IS_AUTH_UI_PREVIEW } from '@/lib/auth-ui-preview';
import { trackScreenView } from '@/lib/amplitude';
import { queryClient } from '@/lib/query-client';
import { IS_SENTRY_VALIDATION_MODE } from '@/lib/sentry-validation-mode';
import { SentryValidationScreen } from '@/screens/diagnostics/SentryValidationScreen';
import { useRemScale } from '@/theme/rem-scale';
import { useAppFonts } from '@/theme/use-app-fonts';

// 둘러보기·닫기의 목적지는 아직 정하지 않았다. 신규 Guest 생성으로 연결하지 않는다.
function ignoreLoginExit() {}

function AppContent() {
  const { isLandscapeTableRequested } = useOrientation();
  // early return보다 위에서 호출해야 훅 순서가 안정된다.
  useRemScale(isLandscapeTableRequested);

  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const previousRouteNameRef = useRef<string | undefined>(undefined);

  const { ready: fontsReady, onLayoutRootView } = useAppFonts();

  // 인증 복원 중 로딩은 RootNavigator가 코디네이터 상태에 따라 직접 그린다.
  if (!fontsReady) {
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
        <RootNavigator
          coordinator={appAuthRuntime.coordinator}
          renderEnrollment={(
            state,
            { draftStore, onComplete, onMergeRequired, onEnrollmentRequired, onCancel },
          ) =>
            state.status === 'signingUp' ? (
              <SignupNavigator
                key={state.flowId}
                enrollment={state.enrollment}
                uid={state.uid}
                draftStore={draftStore}
                startSignup={appAuthRuntime.startEnrollment}
                onComplete={onComplete}
                onMergeRequired={onMergeRequired}
                onCancel={onCancel}
              />
            ) : (
              <GuestMergeNavigator
                key={state.flowId}
                uid={state.uid}
                startMerge={appAuthRuntime.startMerge}
                onComplete={onComplete}
                onEnrollmentRequired={onEnrollmentRequired}
                onCancel={onCancel}
              />
            )
          }
          onBrowse={ignoreLoginExit}
          onClose={ignoreLoginExit}
        />
      </NavigationContainer>
      <StatusBar style="auto" />
      {/* NavigationContainer 바깥이라 웹뷰를 포함한 모든 화면 위에 뜬다. */}
      <PortraitOnlyNotice />
    </View>
  );
}

function FirebaseValidationAppContent() {
  useRemScale();
  const { ready, onLayoutRootView } = useAppFonts();
  if (!ready) return null;
  // 검증 모드에서만 모듈을 로드해 기존 앱 경로에 native 초기화가 섞이지 않게 한다.
  const {
    FirebaseValidationNavigator,
  }: typeof import('./src/navigation/FirebaseValidationNavigator') = require('./src/navigation/FirebaseValidationNavigator');
  return (
    <View className="flex-1" onLayout={onLayoutRootView}>
      <FirebaseValidationNavigator />
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
      ) : __DEV__ && process.env.EXPO_PUBLIC_FIREBASE_AUTH_VALIDATION === 'true' ? (
        <FirebaseValidationAppContent />
      ) : IS_AUTH_UI_PREVIEW ? (
        <AuthPreviewNavigator />
      ) : (
        // 검증 모드는 화면 하나만 띄우고 서버 조회를 하지 않으므로 캐시도 필요 없다.
        <QueryClientProvider client={queryClient}>
          <OrientationProvider>
            <AppContent />
          </OrientationProvider>
        </QueryClientProvider>
      )}
    </SafeAreaProvider>
  );
}
