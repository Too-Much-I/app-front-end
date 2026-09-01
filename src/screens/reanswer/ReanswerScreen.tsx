import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ShardHeader } from "@/components/ui/ShardHeader";
import { AudioRecordingError } from "@/features/audio/use-timed-audio-recorder";
import { useAnswerRecorder } from "@/features/exam/use-answer-recorder";
import { useReanswerQuestion } from "@/features/exam/use-reanswer-question";
import { useReanswerSubmission } from "@/features/exam/use-reanswer-submission";
import type { RootStackParamList } from "@/navigation/types";
import { trackEvent } from "@/lib/amplitude";
import { reportOperationalError } from "@/lib/operational-error-reporting";
import { ReanswerQuestionCard } from "@/screens/reanswer/components/ReanswerQuestionCard";
import { ReanswerRecordPanel } from "@/screens/reanswer/components/ReanswerRecordPanel";
import { ReanswerStatusPanel } from "@/screens/reanswer/components/ReanswerStatusPanel";
import {
  formatRetryLabel,
  hasUnsavedReanswerRecording,
  isReanswerStatusOnly,
  isReanswerSubmissionLocked,
  type ReanswerUiStatus,
} from "@/screens/reanswer/reanswer-status";

type ReanswerScreenProps = NativeStackScreenProps<RootStackParamList, "Reanswer">;

/** 녹음 진행에 따라 화면이 직접 관리하는 단계. 조회·제출 상태는 각 훅이 따로 들고 있다. */
type RecordingPhase =
  | "idle"
  | "recording"
  | "reviewing"
  | "record-failed"
  | "permission-denied";

/**
 * 웹 문제별 피드백의 "다시 답변하기"가 여는 네이티브 녹음 화면.
 *
 * 대상은 웹이 보낸 세 값(examId, questionNumber, nextRetryCount)이 전부이고 회차를
 * 다시 계산하지 않는다. 채점이 끝나면 같은 세 값으로 피드백 웹뷰를 새 회차로 돌려보낸다.
 */
export function ReanswerScreen({ navigation, route }: ReanswerScreenProps) {
  const { examId, questionNumber, nextRetryCount } = route.params;
  const answerKey = useMemo(
    () => ({ examId, questionNumber, retryCount: nextRetryCount }),
    [examId, nextRetryCount, questionNumber],
  );

  const { status: questionStatus, question } = useReanswerQuestion(examId, questionNumber);
  const recorder = useAnswerRecorder();
  const [phase, setPhase] = useState<RecordingPhase>("idle");
  const [finalizedAudioUri, setFinalizedAudioUri] = useState<string | null>(null);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const [isDiscardVisible, setIsDiscardVisible] = useState(false);
  const finishingRef = useRef(false);
  /**
   * 녹음이 끝나면 generation이 정리되면서 `recorder.elapsedMs`가 0으로 돌아간다.
   * 검토 화면에 길이를 남기려면 녹음 중 마지막으로 본 값을 따로 들고 있어야 한다.
   */
  const lastElapsedSecondsRef = useRef(0);
  // 화면을 떠나기로 결정한 순간부터는 `beforeRemove` 확인을 건너뛴다.
  const leavingRef = useRef(false);
  const recordingAttemptRef = useRef(0);
  const hasSubmittedRef = useRef(false);

  const goToQuestionFeedback = useCallback(() => {
    leavingRef.current = true;
    // 재답변 결과이므로 새 회차까지 넘겨 해당 피드백을 정확히 연다.
    navigation.navigate("MainTabs", {
      screen: "Feedback",
      params: { examId, questionNumber, retryCount: nextRetryCount },
    });
  }, [examId, navigation, nextRetryCount, questionNumber]);

  const submission = useReanswerSubmission({
    key: answerKey,
    onGraded: goToQuestionFeedback,
  });

  const uiStatus = resolveUiStatus({
    phase,
    questionStatus,
    submissionStatus: submission.status,
    submissionFailureStage: submission.failureStage,
  });

  const startRecording = useCallback(async () => {
    if (!question) return;

    recorder.resetForRetry();
    recordingAttemptRef.current += 1;
    const recordingAttempt = recordingAttemptRef.current;
    setFinalizedAudioUri(null);
    const result = await recorder.start({
      key: answerKey,
      maxDurationMs: question.speakTimeSec * 1_000,
    });

    if (result.started) {
      setPhase("recording");
      return;
    }
    if (result.reason === "interrupted") return;
    if (result.reason === "error") {
      reportOperationalError({
        code: "ANSWER_RECORDING_FAILED",
        surface: "reanswer",
        stage:
          result.error?.stage === "stop" || result.error?.stage === "file-validation"
            ? result.error.stage
            : "prepare",
        ...(result.error?.operation ? { operation: result.error.operation } : {}),
        ...(typeof result.error?.permissionGranted === "boolean"
          ? { permissionGranted: result.error.permissionGranted }
          : {}),
        questionNumber,
        retryCount: nextRetryCount,
        attempt: recordingAttempt,
      });
    }
    setPhase(result.reason === "permission-denied" ? "permission-denied" : "record-failed");
  }, [answerKey, nextRetryCount, question, questionNumber, recorder]);

  // 녹음 중 마지막으로 관찰한 경과 시간. 확정 직후에는 recorder가 0으로 되돌린다.
  useEffect(() => {
    if (recorder.status !== "recording") return;
    lastElapsedSecondsRef.current = recorder.elapsedMs / 1_000;
  }, [recorder.elapsedMs, recorder.status]);

  const finishRecording = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;

    try {
      const answer = await recorder.finish("user");
      setFinalizedAudioUri(answer.audioFileUri);
      setRecordedSeconds(
        question
          ? Math.min(lastElapsedSecondsRef.current, question.speakTimeSec)
          : lastElapsedSecondsRef.current,
      );
      setPhase("reviewing");
    } catch (error) {
      console.error("[Reanswer] 답변 확정 실패", error);
      if (
        !(error instanceof AudioRecordingError) ||
        (error.stage !== "interruption" && error.stage !== "permission")
      ) {
        reportOperationalError({
          code: "ANSWER_RECORDING_FAILED",
          surface: "reanswer",
          stage:
            error instanceof AudioRecordingError &&
            error.stage !== "permission" &&
            error.stage !== "interruption"
              ? error.stage
              : "stop",
          questionNumber,
          retryCount: nextRetryCount,
          attempt: recordingAttemptRef.current,
        });
      }
      setFinalizedAudioUri(null);
      setPhase("record-failed");
    } finally {
      finishingRef.current = false;
    }
  }, [nextRetryCount, question, questionNumber, recorder]);

  // 제한 시간에 닿으면 녹음을 자동으로 끝낸다. 제출은 여전히 사용자가 누른다 —
  // 시간이 끝나는 것과 답변을 확정하는 것은 다른 결정이다.
  useEffect(() => {
    if (phase !== "recording") return;
    if (recorder.status !== "recording" || recorder.remainingMs > 0) return;
    void finishRecording();
  }, [finishRecording, phase, recorder.remainingMs, recorder.status]);

  // 백그라운드 전환이나 마이크 선점처럼 화면 밖 사정으로 녹음이 취소된 경우.
  useEffect(() => {
    if (phase !== "recording") return;
    if (recorder.status !== "interrupted") return;
    setPhase("record-failed");
  }, [phase, recorder.status]);

  const retakeRecording = useCallback(() => {
    recorder.resetForRetry();
    submission.reset();
    setFinalizedAudioUri(null);
    setPhase("idle");
  }, [recorder, submission]);

  const submitAnswer = useCallback(() => {
    if (!finalizedAudioUri) return;
    hasSubmittedRef.current = true;
    trackEvent({
      name: "reanswer_submitted",
      properties: { retryCount: nextRetryCount },
    });
    submission.submit(finalizedAudioUri);
  }, [finalizedAudioUri, nextRetryCount, submission]);

  /**
   * 재답변은 핵심 학습 루프인데 완주율을 볼 방법이 없었다. 화면 진입을 시도로 보고,
   * 제출 없이 나가면 이탈로 센다.
   */
  useEffect(() => {
    trackEvent({
      name: "reanswer_started",
      properties: { retryCount: nextRetryCount },
    });

    return () => {
      if (hasSubmittedRef.current) return;
      trackEvent({
        name: "reanswer_abandoned",
        properties: { retryCount: nextRetryCount },
      });
    };
  }, [nextRetryCount]);

  const leaveScreen = useCallback(() => {
    leavingRef.current = true;
    setIsDiscardVisible(false);
    navigation.goBack();
  }, [navigation]);

  const requestClose = useCallback(() => {
    if (hasUnsavedReanswerRecording(uiStatus)) {
      setIsDiscardVisible(true);
      return;
    }
    leaveScreen();
  }, [leaveScreen, uiStatus]);

  // 안드로이드 하드웨어 뒤로가기와 스택 제스처도 같은 확인을 거치게 한다.
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (leavingRef.current) return;
      if (isReanswerSubmissionLocked(uiStatus)) {
        event.preventDefault();
        return;
      }
      if (!hasUnsavedReanswerRecording(uiStatus)) return;

      event.preventDefault();
      setIsDiscardVisible(true);
    });

    return unsubscribe;
  }, [navigation, uiStatus]);

  return (
    <View className="flex-1 bg-surface-subtle">
      <StatusBar style="light" />
      <ShardHeader
        title={formatRetryLabel(nextRetryCount)}
        leftAction={
          // 제출과 채점 중에는 화면을 벗어날 수 없다.
          isReanswerSubmissionLocked(uiStatus)
            ? undefined
            : {
                icon: "x",
                accessibilityLabel: "다시 답변하기 닫기",
                accessibilityHint: "재답변을 그만두고 문제별 피드백으로 돌아갑니다",
                onPress: requestClose,
              }
        }
      />

      <SafeAreaView className="flex-1" edges={["bottom"]}>
        {isReanswerStatusOnly(uiStatus) || !question ? (
          <ReanswerStatusPanel
            errorMessage={submission.errorMessage}
            onLeave={leaveScreen}
            onOpenSettings={() => void Linking.openSettings()}
            onRetryRecording={retakeRecording}
            status={isReanswerStatusOnly(uiStatus) ? uiStatus : "loading"}
          />
        ) : (
          <>
            <ScrollView
              className="flex-1"
              contentContainerClassName="flex-grow px-5 pb-4 pt-4"
              showsVerticalScrollIndicator={false}
            >
              <ReanswerQuestionCard
                isAudioLocked={uiStatus === "recording"}
                question={question}
              />
            </ScrollView>

            <View className="px-5 pb-3">
              <ReanswerRecordPanel
                meteringDb={recorder.meteringDb}
                onRetake={retakeRecording}
                onStart={() => void startRecording()}
                onStop={() => void finishRecording()}
                onSubmit={submitAnswer}
                recordedSeconds={recordedSeconds}
                remainingSeconds={recorder.remainingMs / 1_000}
                speakTimeSec={question.speakTimeSec}
                status={uiStatus}
              />
            </View>
          </>
        )}
      </SafeAreaView>

      {/* 폐기되는 것(지금 녹음)과 남는 것(이미 받은 피드백과 이전 회차)을 함께 말한다 —
          재답변은 기존 답변을 덮어쓰지 않으므로 여기서 잃는 건 방금 녹음뿐이다. */}
      <ConfirmModal
        cancelLabel="계속 녹음하기"
        confirmHint="지금 녹음을 버리고 문제별 피드백으로 돌아갑니다"
        confirmLabel="나가기"
        message="지금 녹음한 답변은 저장되지 않아요. 이미 받은 피드백과 이전 회차는 그대로 남아요."
        onCancel={() => setIsDiscardVisible(false)}
        onConfirm={leaveScreen}
        title="녹음을 그만둘까요?"
        visible={isDiscardVisible}
      />
    </View>
  );
}

/**
 * 조회·녹음·제출 세 갈래를 화면 상태 하나로 합친다.
 *
 * 제출이 시작되면 그쪽이 화면을 독점한다 — 업로드 중에 문제 카드나 녹음 버튼을 다시
 * 보여줄 이유가 없고, 그 사이 들어온 조회 실패로 진행 중인 제출을 가릴 수도 없다.
 */
function resolveUiStatus({
  phase,
  questionStatus,
  submissionStatus,
  submissionFailureStage,
}: {
  phase: RecordingPhase;
  questionStatus: "loading" | "ready" | "failed";
  submissionStatus: "idle" | "submitting" | "grading" | "failed";
  submissionFailureStage: "submit" | "grading" | null;
}): ReanswerUiStatus {
  if (submissionStatus === "submitting") return "submitting";
  if (submissionStatus === "grading") return "grading";
  if (submissionStatus === "failed") {
    return submissionFailureStage === "grading" ? "grading-failed" : "submit-failed";
  }
  if (questionStatus === "loading") return "loading";
  if (questionStatus === "failed") return "question-failed";
  return phase;
}
