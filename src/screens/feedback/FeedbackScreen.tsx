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
import WebView, {
  type WebViewMessageEvent,
  type WebViewNavigation,
} from "react-native-webview";

import { Text } from "@/components/ui/Text";
import { retryExamGrading } from "@/features/exam/api/exam-grading-retry";
import { isFeedbackDataReadyMessage } from "@/features/exam/feedback-data-ready-message";
import { isFeedbackHistoryRequestedMessage } from "@/features/exam/feedback-history-message";
import { isGoHomeRequestedMessage } from "@/features/exam/go-home-message";
import {
  buildNativeCapabilitiesScript,
  buildNativeDataRefreshScript,
  buildNativeDataScript,
  parseNativeDataRequest,
  resolveNativeDataRequest,
  toNativeDataErrorMessage,
  type NativeDataRequest,
} from "@/features/exam/native-data-bridge";
import { parseReanswerRequest } from "@/features/exam/reanswer-message";
import {
  buildSummaryFeedbackRetryResponseScript,
  parseSummaryFeedbackRetryRequest,
  type SummaryFeedbackRetryRequest,
} from "@/features/exam/summary-feedback-retry-message";
import {
  pollSummaryFeedbackUntilComplete,
  type SummaryFeedbackPollingResult,
} from "@/features/exam/summary-feedback-retry-polling";
import { useFeedbackDataRefresh } from "@/features/exam/use-feedback-data-refresh";
import { reportOperationalError } from "@/lib/operational-error-reporting";
import { WEB_BASE_URL, withRemScale } from "@/lib/web-base-url";
import type { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { FeedbackWebViewSkeleton } from "@/screens/feedback/components/FeedbackWebViewSkeleton";
import { ExamHistoryScreen } from "@/screens/feedback/components/ExamHistoryScreen";
import { useScaleValue } from "@/theme/rem-scale";

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
const NATIVE_CAPABILITIES_SCRIPT = buildNativeCapabilitiesScript();

type SummaryFeedbackRetryOperation = {
  controller: AbortController;
  accepted: Promise<boolean>;
  polling: Promise<SummaryFeedbackPollingResult | null>;
};

function buildOverviewUrl(examId: string, scale: number): string | null {
  if (!WEB_BASE_URL) return null;
  return withRemScale(
    `${WEB_BASE_URL}/app-exam-screen?examId=${encodeURIComponent(examId)}`,
    scale,
  );
}

// `scale`이 `retryCount` 앞에 오는 이유: 선택 인자 뒤에 필수 인자를 둘 수 없다.
function buildQuestionUrl(
  examId: string,
  questionNumber: number,
  scale: number,
  retryCount?: number,
): string | null {
  if (!WEB_BASE_URL) return null;
  const url = `${WEB_BASE_URL}/app-question-feedback?examId=${encodeURIComponent(
    examId,
  )}&questionNumber=${questionNumber}`;
  const withRetry =
    retryCount !== undefined && retryCount > 0
      ? `${url}&retryCount=${retryCount}`
      : url;
  return withRemScale(withRetry, scale);
}

type FeedbackLocation =
  | { page: "overview"; examId: string; url: string }
  | { page: "question"; examId: string; questionNumber: number; url: string };

/** WebView 내부 이동까지 포함해 현재 피드백 페이지를 scale 변경용으로 기억한다. */
function parseFeedbackLocation(url: string | null): FeedbackLocation | null {
  if (!url) return null;

  try {
    const parsedUrl = new URL(url);
    const examId = parsedUrl.searchParams.get("examId");
    if (!examId) return null;

    const pathname = parsedUrl.pathname.replace(/\/+$/, "");
    if (pathname.endsWith("/app-exam-screen")) {
      return { page: "overview", examId, url };
    }
    if (pathname.endsWith("/app-question-feedback")) {
      const questionNumber = Number(parsedUrl.searchParams.get("questionNumber"));
      if (!Number.isInteger(questionNumber) || questionNumber <= 0) return null;
      return { page: "question", examId, questionNumber, url };
    }
  } catch {
    // WebView의 임시 주소(예: about:blank)는 피드백 위치가 아니므로 무시한다.
  }

  return null;
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
  // 웹뷰가 앱과 같은 비율로 커지도록 주소에 실어 보낸다.
  const scale = useScaleValue();
  // 같은 요청이 연달아 와도 녹음 화면을 두 번 열지 않는다.
  const hasOpenedReanswerRef = useRef(false);
  const summaryRetryOperationsRef = useRef(
    new Map<string, SummaryFeedbackRetryOperation>(),
  );
  const pageLoadAttemptRef = useRef(0);
  const reportedPageLoadAttemptRef = useRef(-1);
  const reportedDataRequestIdsRef = useRef(new Set<string>());
  const isMountedRef = useRef(true);
  const webViewRef = useRef<WebView>(null);
  const initialFeedbackUrl = examId
    ? questionNumber !== undefined
      ? buildQuestionUrl(examId, questionNumber, scale, retryCount)
      : buildOverviewUrl(examId, scale)
    : null;
  const feedbackLocationRef = useRef<FeedbackLocation | null>(
    parseFeedbackLocation(initialFeedbackUrl),
  );
  // 문제별 주소로 처음 마운트되는 경우에는 이미 올바른 source를 쓰므로 추가 reload가 필요 없다.
  const initialQuestionRequestRef = useRef(
    questionNumber !== undefined ? initialFeedbackUrl : null,
  );

  useFocusEffect(
    useCallback(() => {
      hasOpenedReanswerRef.current = false;
    }, []),
  );

  useEffect(
    () => () => {
      for (const operation of summaryRetryOperationsRef.current.values()) {
        operation.controller.abort();
      }
      summaryRetryOperationsRef.current.clear();
    },
    [examId],
  );

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  /**
   * 지금 웹뷰가 열고 있는 주소.
   *
   * 라우트 파라미터에서 매번 계산하지 않고 상태로 들고 있다. 재답변 복귀 파라미터를
   * 쓰자마자 지우기 때문에(아래 참고), 파라미터가 사라진 순간 주소가 종합 피드백으로
   * 되돌아가면 안 된다.
   */
  const [feedbackUrl, setFeedbackUrl] = useState<string | null>(initialFeedbackUrl);

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
    pageLoadAttemptRef.current += 1;
    reportedDataRequestIdsRef.current.clear();
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

  const handlePageLoadFailure = useCallback(
    (reason: "network" | "http") => {
      const attempt = pageLoadAttemptRef.current;
      if (reportedPageLoadAttemptRef.current !== attempt) {
        reportedPageLoadAttemptRef.current = attempt;
        reportOperationalError({
          code: "FEEDBACK_PAGE_LOAD_FAILED",
          reason,
          attempt,
        });
      }
      setHasLoadError(true);
    },
    [],
  );

  // 시험이 바뀌면 route가 지정한 페이지를 열고, scale만 바뀌면 현재 WebView 위치를 유지한다.
  useEffect(() => {
    if (!examId) {
      feedbackLocationRef.current = null;
      setFeedbackUrl(null);
      return;
    }

    const currentLocation = feedbackLocationRef.current;
    const nextUrl =
      currentLocation?.examId === examId
        ? withRemScale(currentLocation.url, scale)
        : questionNumber !== undefined
          ? buildQuestionUrl(examId, questionNumber, scale, retryCount)
          : buildOverviewUrl(examId, scale);

    feedbackLocationRef.current = parseFeedbackLocation(nextUrl);
    setFeedbackUrl(nextUrl);
  }, [examId, questionNumber, retryCount, scale]);

  const handleNavigationStateChange = useCallback((state: WebViewNavigation) => {
    const nextLocation = parseFeedbackLocation(state.url);
    if (nextLocation) {
      feedbackLocationRef.current = nextLocation;
    }
  }, []);

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

    const nextUrl = buildQuestionUrl(examId, questionNumber, scale, retryCount);
    feedbackLocationRef.current = parseFeedbackLocation(nextUrl);
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
  }, [examId, feedbackUrl, navigation, questionNumber, retryCount, scale]);

  /**
   * 웹이 요청한 데이터를 네이티브가 인증된 상태로 조회해 돌려준다.
   *
   * 실패도 반드시 응답한다 — 응답하지 않으면 웹의 대기 promise가 타임아웃까지 남고
   * 사용자는 그 시간 동안 로딩만 보게 된다.
   */
  const deliverNativeData = useCallback(
    async (request: NativeDataRequest) => {
      const pageLoadAttempt = pageLoadAttemptRef.current;
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
        const isCurrentRequest =
          isMountedRef.current && pageLoadAttemptRef.current === pageLoadAttempt;
        if (
          isCurrentRequest &&
          !reportedDataRequestIdsRef.current.has(request.requestId)
        ) {
          reportedDataRequestIdsRef.current.add(request.requestId);
          reportOperationalError({
            code: "FEEDBACK_DATA_LOAD_FAILED",
            resource: request.resource,
            cause: error,
          });
        }
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

  /** 같은 시험의 재생성 API와 polling은 requestId가 달라도 하나의 작업을 공유한다. */
  const deliverSummaryFeedbackRetry = useCallback(
    async (request: SummaryFeedbackRetryRequest) => {
      let operation = summaryRetryOperationsRef.current.get(request.examId);

      if (!operation) {
        const controller = new AbortController();
        const accepted = retryExamGrading(request.examId, controller.signal)
          .then(() => true)
          .catch(() => {
            if (!controller.signal.aborted) {
              reportOperationalError({
                code: "SUMMARY_FEEDBACK_RETRY_FAILED",
                stage: "retry-request",
                reason: "request-failed",
              });
            }
            return false;
          });
        const polling = accepted.then(async (wasAccepted) => {
          if (!wasAccepted || controller.signal.aborted) return null;
          const result = await pollSummaryFeedbackUntilComplete(
            request.examId,
            controller.signal,
          );
          if (result.status === "failed" && result.reason !== "cancelled") {
            reportOperationalError({
              code: "SUMMARY_FEEDBACK_RETRY_FAILED",
              stage: "retry-polling",
              reason: result.reason,
            });
          }
          return result;
        });
        operation = { controller, accepted, polling };
        summaryRetryOperationsRef.current.set(request.examId, operation);
      }

      const activeOperation = operation;
      const removeFailedOperation = () => {
        if (summaryRetryOperationsRef.current.get(request.examId) === activeOperation) {
          summaryRetryOperationsRef.current.delete(request.examId);
        }
      };

      const wasAccepted = await activeOperation.accepted;
      if (!wasAccepted) {
        removeFailedOperation();
        webViewRef.current?.injectJavaScript(
          buildSummaryFeedbackRetryResponseScript({
            requestId: request.requestId,
            ok: false,
            status: "failed",
            stage: "retry-request",
            reason: "request-failed",
          }),
        );
        return;
      }

      webViewRef.current?.injectJavaScript(
        buildSummaryFeedbackRetryResponseScript({
          requestId: request.requestId,
          ok: true,
          status: "accepted",
        }),
      );

      const pollingResult = await activeOperation.polling;
      if (!pollingResult) return;

      if (pollingResult.status === "completed") {
        webViewRef.current?.injectJavaScript(
          buildSummaryFeedbackRetryResponseScript({
            requestId: request.requestId,
            ok: true,
            status: "completed",
            result: pollingResult.result,
          }),
        );
        return;
      }

      if (pollingResult.reason === "cancelled") return;
      removeFailedOperation();

      webViewRef.current?.injectJavaScript(
        buildSummaryFeedbackRetryResponseScript({
          requestId: request.requestId,
          ok: false,
          status: "failed",
          stage: "retry-polling",
          reason: pollingResult.reason,
        }),
      );
    },
    [],
  );

  const handleWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      // examId 로딩 실패로 에러 폴백이 뜬 경우에도 동작해야 하므로 examId 가드보다 먼저 검사한다.
      if (isGoHomeRequestedMessage(event.nativeEvent.data)) {
        navigation.navigate("MainTabs", { screen: "Home" });
        return;
      }

      if (isFeedbackHistoryRequestedMessage(event.nativeEvent.data)) {
        navigation.setParams({
          examId: undefined,
          questionNumber: undefined,
          retryCount: undefined,
        });
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

      const summaryRetryRequest = parseSummaryFeedbackRetryRequest(
        event.nativeEvent.data,
        examId,
      );
      if (summaryRetryRequest) {
        void deliverSummaryFeedbackRetry(summaryRetryRequest);
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
    [deliverNativeData, deliverSummaryFeedbackRetry, examId, navigation],
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
          injectedJavaScriptBeforeContentLoaded={NATIVE_CAPABILITIES_SCRIPT}
          onNavigationStateChange={handleNavigationStateChange}
          onMessage={handleWebViewMessage}
          onError={() => handlePageLoadFailure("network")}
          onHttpError={() => handlePageLoadFailure("http")}
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
