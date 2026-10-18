import './global.css';

import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CrashBoundary } from '@/components/ui/CrashBoundary';
import { PortraitOnlyNotice } from '@/components/ui/PortraitOnlyNotice';
import { AppUpdateNotice } from '@/features/app-version/components/AppUpdateNotice';
import { appAuthRuntime } from '@/features/auth/app-auth-runtime';
import { OrientationProvider } from '@/features/orientation/OrientationProvider';
import { loadPaidTransitionNoticeStatus } from '@/features/paid-transition/paid-transition-notice-storage';
import { useOrientation } from '@/features/orientation/orientation-context';
import { AccountRecoveryNavigator } from '@/navigation/AccountRecoveryNavigator';
import { AuthPreviewNavigator } from '@/navigation/AuthPreviewNavigator';
import { RootNavigator } from '@/navigation/RootNavigator';
import { GuestMergeNavigator } from '@/navigation/GuestMergeNavigator';
import { SignupNavigator } from '@/navigation/SignupNavigator';
import type { RootStackParamList } from '@/navigation/types';
import { IS_AUTH_UI_PREVIEW } from '@/lib/auth-ui-preview';
import { trackScreenView } from '@/lib/amplitude';
import { queryClient } from '@/lib/query-client';
import { registerNavigationContainer, setScreenTag } from '@/lib/sentry';
import { IS_SENTRY_VALIDATION_MODE } from '@/lib/sentry-validation-mode';
import { SentryValidationScreen } from '@/screens/diagnostics/SentryValidationScreen';
import { useRemScale } from '@/theme/rem-scale';
import { useAppFonts } from '@/theme/use-app-fonts';

function AppContent() {
  const { isLandscapeTableRequested } = useOrientation();
  // early return보다 위에서 호출해야 훅 순서가 안정된다.
  useRemScale(isLandscapeTableRequested);

  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const previousRouteNameRef = useRef<string | undefined>(undefined);

  const { ready: fontsReady, onLayoutRootView } = useAppFonts();

  // 3.0.0 신규 설치자는 동의 화면에서 동의 기록이 생기므로, 그 전에 기존 사용자인지 정해 둔다.
  useEffect(() => {
    void loadPaidTransitionNoticeStatus();
  }, []);

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
          registerNavigationContainer(navigationRef);
          if (routeName) trackScreenView(routeName);
          setScreenTag(routeName);
        }}
        onStateChange={() => {
          const routeName = navigationRef.getCurrentRoute()?.name;
          // 같은 화면에서 파라미터만 바뀐 경우까지 조회로 세지 않는다.
          if (routeName && routeName !== previousRouteNameRef.current) {
            trackScreenView(routeName);
          }
          // 로그인 진행·계정 안내처럼 navigator 없이 그리는 화면에서도 이전 화면 이름이 남지 않게 한다.
          setScreenTag(routeName);
          previousRouteNameRef.current = routeName;
        }}
      >
        <RootNavigator
          coordinator={appAuthRuntime.coordinator}
          renderEnrollment={(
            state,
            {
              draftStore,
              onComplete,
              onMergeRequired,
              onEnrollmentRequired,
              onFindAccount,
              onCancel,
            },
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
                onFindAccount={onFindAccount}
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
          renderAccountRecovery={(state, { onFinish }) => (
            <AccountRecoveryNavigator
              key={state.flowId}
              entry={state.entry}
              startAccountRecovery={appAuthRuntime.startAccountRecovery}
              onFinish={onFinish}
            />
          )}
          lastLoginProvider={appAuthRuntime.lastLoginProvider}
        />
      </NavigationContainer>
      <StatusBar style="auto" />
      {/* NavigationContainer 바깥이라 웹뷰를 포함한 모든 화면 위에 뜬다. */}
      <PortraitOnlyNotice />
      {/* 앱은 평소처럼 시작하고 그 위에 덮는다. 로그인 전에도 확인한다(2026-10-08 결정). */}
      <AppUpdateNotice />
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
        // 화면 경계(navigator의 screenLayout)가 못 잡는 화면 밖 크래시(provider·오버레이)를 받는다.
        // 다시 그리면 NavigationContainer부터 새로 올라와 현재 인증 상태의 첫 화면으로 간다.
        <CrashBoundary scope="app">
          <QueryClientProvider client={queryClient}>
            <OrientationProvider>
              <AppContent />
            </OrientationProvider>
          </QueryClientProvider>
        </CrashBoundary>
      )}
    </SafeAreaProvider>
  );
}
