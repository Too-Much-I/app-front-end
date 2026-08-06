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
import { isFeedbackDataReadyMessage } from "@/features/exam/feedback-data-ready-message";
import { isGoHomeRequestedMessage } from "@/features/exam/go-home-message";
import {
  buildNativeDataRefreshScript,
  buildNativeDataScript,
  parseNativeDataRequest,
  resolveNativeDataRequest,
  toNativeDataErrorMessage,
  type NativeDataRequest,
} from "@/features/exam/native-data-bridge";
import { parseReanswerRequest } from "@/features/exam/reanswer-message";
import { useFeedbackDataRefresh } from "@/features/exam/use-feedback-data-refresh";
import { WEB_BASE_URL } from "@/lib/web-base-url";
import type { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { FeedbackWebViewSkeleton } from "@/screens/feedback/components/FeedbackWebViewSkeleton";
import { ExamHistoryScreen } from "@/screens/feedback/components/ExamHistoryScreen";

/** 탭 안에서 파라미터를 지우고, 탭 위로 재답변 화면을 띄우기 위해 두 내비게이터를 함께 쓴다. */
type FeedbackNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "Feedback">,
  NativeStackNavigationProp<RootStackParamList>
>;

/**
 * FEEDBACK_DATA_READY가 이 시간 안에 안 오면 스켈레톤을 강제로 걷어낸다.
 *
 * 웹 배포 불일치나 메시지 유실 등으로 신호 자체가 안 오는 경우의 안전장치다 —
 * 이게 없으면 스켈레톤이 영원히 안 사라져 화면이 아예 안 뜨는 것처럼 보인다.
 */
const FEEDBACK_READY_TIMEOUT_MS = 10_000;

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

  /**
   * 웹뷰의 문서 로드 완료(renderLoading이 사라지는 시점)와 웹 페이지 내부 데이터 로드
   * 완료 시점이 어긋나서, 스켈레톤 이후 "불러오는 중" 텍스트가 잠깐 끼어 보이는 문제가
   * 있었다. 이제 스켈레톤은 WebView가 아니라 이 state로 직접 통제하고,
   * FEEDBACK_DATA_READY 메시지(웹의 데이터 로드 완료 신호)를 받을 때까지 유지한다.
   */
  const [isContentReady, setIsContentReady] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  // feedbackUrl이 그대로인 채 webViewRef.current?.reload()만 호출되는 경우(아래 참고)에도
  // 리셋 effect를 다시 돌리기 위한 트리거. 값 자체엔 의미가 없다.
  const [reloadNonce, setReloadNonce] = useState(0);

  /** 웹이 지금 보고 있는 회차 그대로 데이터를 다시 요청하게 한다. */
  const requestWebDataRefresh = useCallback(() => {
    webViewRef.current?.injectJavaScript(buildNativeDataRefreshScript());
  }, []);

  const { markDataDelivered, reset: resetDataRefresh } = useFeedbackDataRefresh({
    onRefresh: requestWebDataRefresh,
  });

  useEffect(() => {
    setIsContentReady(false);
    setHasLoadError(false);
    // 주소가 바뀌거나 리로드되면 웹이 들고 있던 데이터도 함께 사라진다.
    resetDataRefresh();

    const timeout = setTimeout(
      () => setIsContentReady(true),
      FEEDBACK_READY_TIMEOUT_MS,
    );
    return () => clearTimeout(timeout);
  }, [feedbackUrl, reloadNonce, resetDataRefresh]);

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

    if (!isInitialRequest && nextUrl === feedbackUrl) {
      // 주소가 그대로라 feedbackUrl이 안 바뀌므로, nonce를 올려 위 리셋 effect를 다시 돌린다.
      setReloadNonce((nonce) => nonce + 1);
      webViewRef.current?.reload();
    } else {
      setFeedbackUrl(nextUrl);
    }

    navigation.setParams({ questionNumber: undefined, retryCount: undefined });
  }, [examId, feedbackUrl, navigation, questionNumber, retryCount]);

  /**
   * 웹이 요청한 데이터를 네이티브가 인증된 상태로 조회해 돌려준다.
   *
   * 실패도 반드시 응답한다 — 응답하지 않으면 웹의 대기 promise가 타임아웃까지 남고
   * 사용자는 그 시간 동안 로딩만 보게 된다.
   */
  const deliverNativeData = useCallback(
    async (request: NativeDataRequest) => {
      try {
        const result = await resolveNativeDataRequest(request);
        webViewRef.current?.injectJavaScript(
          buildNativeDataScript({
            requestId: request.requestId,
            ok: true,
            result,
          }),
        );
        // 만료되는 presigned 오디오 URL이 들어 있는 응답은 문제별 피드백뿐이다.
        if (request.resource === "QUESTION_FEEDBACK") {
          markDataDelivered();
        }
      } catch (error) {
        webViewRef.current?.injectJavaScript(
          buildNativeDataScript({
            requestId: request.requestId,
            ok: false,
            message: toNativeDataErrorMessage(error),
          }),
        );
      }
    },
    [markDataDelivered],
  );

  const handleWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      // examId 로딩 실패로 에러 폴백이 뜬 경우에도 동작해야 하므로 examId 가드보다 먼저 검사한다.
      if (isGoHomeRequestedMessage(event.nativeEvent.data)) {
        navigation.navigate("MainTabs", { screen: "Home" });
        return;
      }

      if (isFeedbackDataReadyMessage(event.nativeEvent.data)) {
        setIsContentReady(true);
        return;
      }

      if (!examId) return;

      const dataRequest = parseNativeDataRequest(event.nativeEvent.data, examId);
      if (dataRequest) {
        void deliverNativeData(dataRequest);
        return;
      }

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
    [deliverNativeData, examId, navigation],
  );

  if (!examId) {
    return (
      <ExamHistoryScreen
        onOpenExam={(nextExamId) => navigation.setParams({ examId: nextExamId })}
        onStartExam={() => navigation.navigate("MockExam")}
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
      <View className="flex-1">
        <WebView
          ref={webViewRef}
          key={feedbackUrl}
          source={{ uri: feedbackUrl }}
          className="flex-1 bg-surface-subtle"
          onMessage={handleWebViewMessage}
          onError={() => setHasLoadError(true)}
          onHttpError={() => setHasLoadError(true)}
          setSupportMultipleWindows={false}
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
        {/* 문서 로드 완료가 아니라 FEEDBACK_DATA_READY 수신까지 스켈레톤을 유지한다. */}
        {!isContentReady && !hasLoadError && <FeedbackWebViewSkeleton />}
      </View>
    </SafeAreaView>
  );
}
