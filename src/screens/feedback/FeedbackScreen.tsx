import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type CompositeNavigationProp,
  type RouteProp,
} from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView, { type WebViewMessageEvent } from "react-native-webview";

import { Text } from "@/components/ui/Text";
import { parseReanswerRequest } from "@/features/exam/reanswer-message";
import type { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { FeedbackWebViewSkeleton } from "@/screens/feedback/components/FeedbackWebViewSkeleton";

const WEB_BASE_URL = (process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "").replace(
  /\/+$/,
  "",
);

/** 탭 안에서 파라미터를 지우고, 탭 위로 재답변 화면을 띄우기 위해 두 내비게이터를 함께 쓴다. */
type FeedbackNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "Feedback">,
  NativeStackNavigationProp<RootStackParamList>
>;

function buildOverviewUrl(examId: string): string | null {
  if (!WEB_BASE_URL) return null;
  return `${WEB_BASE_URL}/app-exam-screen?examId=${encodeURIComponent(examId)}`;
}

function buildQuestionUrl(
  examId: string,
  questionNumber: number,
  retryCount?: number,
): string | null {
  if (!WEB_BASE_URL) return null;
  const url = `${WEB_BASE_URL}/app-question-feedback?examId=${encodeURIComponent(
    examId,
  )}&questionNumber=${questionNumber}`;
  return retryCount !== undefined && retryCount > 0
    ? `${url}&retryCount=${retryCount}`
    : url;
}

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
  const navigation = useNavigation<FeedbackNavigationProp>();
  const examId = route.params?.examId;
  const questionNumber = route.params?.questionNumber;
  const retryCount = route.params?.retryCount;
  // 같은 요청이 연달아 와도 녹음 화면을 두 번 열지 않는다.
  const hasOpenedReanswerRef = useRef(false);
  const webViewRef = useRef<WebView>(null);
  const questionNumberRef = useRef(questionNumber);
  useEffect(() => {
    questionNumberRef.current = questionNumber;
  }, [questionNumber]);
  // 문제별 주소로 처음 마운트되는 경우에는 이미 올바른 source를 쓰므로 추가 reload가 필요 없다.
  const initialQuestionRequestRef = useRef(
    examId && questionNumber !== undefined
      ? buildQuestionUrl(examId, questionNumber, retryCount)
      : null,
  );

  useFocusEffect(
    useCallback(() => {
      hasOpenedReanswerRef.current = false;
    }, []),
  );

  /**
   * 지금 웹뷰가 열고 있는 주소.
   *
   * 라우트 파라미터에서 매번 계산하지 않고 상태로 들고 있다. 재답변 복귀 파라미터를
   * 쓰자마자 지우기 때문에(아래 참고), 파라미터가 사라진 순간 주소가 종합 피드백으로
   * 되돌아가면 안 된다.
   */
  const [feedbackUrl, setFeedbackUrl] = useState<string | null>(() =>
    examId
      ? questionNumber !== undefined
        ? buildQuestionUrl(examId, questionNumber, retryCount)
        : buildOverviewUrl(examId)
      : null,
  );

  // 문제 지정 없이 시험만 바뀐 경우에는 종합 피드백을 연다.
  useEffect(() => {
    if (!examId) {
      setFeedbackUrl(null);
      return;
    }
    if (questionNumberRef.current === undefined) {
      setFeedbackUrl(buildOverviewUrl(examId));
    }
    // questionNumber가 있으면 아래 effect가 문제별 주소를 적용한다.
  }, [examId]);

  /**
   * 재답변을 마치고 돌아온 경우: 새 회차의 문제별 피드백을 연다.
   *
   * 복귀 파라미터는 1회용이라 적용 직후 지운다. 남겨 두면 나중에 홈이나 마이페이지에서
   * 피드백 탭을 열 때도(그쪽은 파라미터 없이 이동한다) 이 문제의 회차 화면이 열린다.
   *
   * 최초 답변은 회차 파라미터 없이 열고, 재답변 완료 뒤에는 새 `retryCount`를 붙인다.
   * 이미 같은 주소를 보고 있다면 WebView를 reload해 캐시된 화면에 머무르지 않게 한다.
   */
  useEffect(() => {
    if (!examId || questionNumber === undefined) return;

    const nextUrl = buildQuestionUrl(examId, questionNumber, retryCount);
    const isInitialRequest = initialQuestionRequestRef.current === nextUrl;
    initialQuestionRequestRef.current = null;

    if (!isInitialRequest && nextUrl === feedbackUrl) webViewRef.current?.reload();
    else setFeedbackUrl(nextUrl);

    navigation.setParams({ questionNumber: undefined, retryCount: undefined });
  }, [examId, feedbackUrl, navigation, questionNumber, retryCount]);

  const handleWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      if (!examId) return;

      const request = parseReanswerRequest(event.nativeEvent.data, examId);
      // 계약에 맞지 않는 메시지는 조용히 무시하고 지금 화면을 그대로 둔다.
      if (!request) return;
      if (hasOpenedReanswerRef.current) return;

      hasOpenedReanswerRef.current = true;
      navigation.navigate("Reanswer", {
        examId: request.examId,
        questionNumber: request.questionNumber,
        nextRetryCount: request.nextRetryCount,
      });
    },
    [examId, navigation],
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
      {/* 웹의 결과 복귀는 페이지 링크가, 기기 뒤로가기는 React Navigation이 각각 담당한다. */}
      <WebView
        ref={webViewRef}
        key={feedbackUrl}
        source={{ uri: feedbackUrl }}
        className="flex-1 bg-surface-subtle"
        onMessage={handleWebViewMessage}
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
