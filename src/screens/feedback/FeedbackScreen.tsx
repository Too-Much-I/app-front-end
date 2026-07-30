import { useFocusEffect, useRoute, type RouteProp } from "@react-navigation/native";
import { useCallback, useMemo, useRef } from "react";
import { BackHandler, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView, { type WebViewNavigation } from "react-native-webview";

import { Text } from "@/components/ui/Text";
import type { MainTabParamList } from "@/navigation/types";
import { FeedbackWebViewSkeleton } from "@/screens/feedback/components/FeedbackWebViewSkeleton";

const WEB_BASE_URL = (process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "").replace(
  /\/+$/,
  "",
);

function FeedbackNotice({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <SafeAreaView
      edges={["top"]}
      className="flex-1 items-center justify-center bg-surface-subtle px-6"
    >
      <Text accessibilityRole="header" className="text-center text-2xl">
        {title}
      </Text>
      <Text className="mt-3 text-center text-sm leading-6 text-ink-muted">
        {description}
      </Text>
    </SafeAreaView>
  );
}

export function FeedbackScreen() {
  const route = useRoute<RouteProp<MainTabParamList, "Feedback">>();
  const examId = route.params?.examId;
  const webViewRef = useRef<WebView>(null);
  const canGoBackRef = useRef(false);

  const feedbackUrl = useMemo(() => {
    if (!WEB_BASE_URL || !examId) return null;
    return `${WEB_BASE_URL}/app-exam-screen?examId=${encodeURIComponent(examId)}`;
  }, [examId]);

  const handleNavigationStateChange = useCallback(
    (navigationState: WebViewNavigation) => {
      canGoBackRef.current = navigationState.canGoBack;
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (!canGoBackRef.current) return false;
          webViewRef.current?.goBack();
          return true;
        },
      );

      return () => subscription.remove();
    }, []),
  );

  if (!examId) {
    return (
      <FeedbackNotice
        title="아직 확인할 피드백이 없어요"
        description="모의고사를 완료하면 채점 결과를 이곳에서 확인할 수 있어요."
      />
    );
  }

  if (!feedbackUrl) {
    return (
      <FeedbackNotice
        title="웹 피드백 주소가 필요해요"
        description="앱 환경변수 EXPO_PUBLIC_WEB_BASE_URL을 설정해 주세요."
      />
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface-subtle">
      <WebView
        ref={webViewRef}
        source={{ uri: feedbackUrl }}
        className="flex-1 bg-surface-subtle"
        allowsBackForwardNavigationGestures
        onNavigationStateChange={handleNavigationStateChange}
        setSupportMultipleWindows={false}
        startInLoadingState
        renderLoading={() => <FeedbackWebViewSkeleton />}
        renderError={(_errorDomain, _errorCode, errorDescription) => (
          <View className="flex-1 items-center justify-center bg-surface-subtle px-6">
            <Text accessibilityRole="header" className="text-center text-2xl">
              피드백 페이지를 열지 못했어요
            </Text>
            <Text className="mt-3 text-center text-sm leading-6 text-ink-muted">
              {errorDescription}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
