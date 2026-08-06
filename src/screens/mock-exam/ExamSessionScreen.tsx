import { useIsFocused } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { AppState, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { getExamResponseCueKind } from "@/features/exam/exam-cue";
import { getExamPartDirections } from "@/features/exam/part-directions";
import { getQuestionAudioPlayCount } from "@/features/exam/question-audio";
import type { MainTabParamList, MockExamStackParamList } from "@/navigation/types";
import { AudioWaveform } from "@/screens/mock-exam/components/AudioWaveform";
import { ExamAnswerStatus } from "@/screens/mock-exam/components/ExamAnswerStatus";
import { ExamExitConfirmationModal } from "@/screens/mock-exam/components/ExamExitConfirmationModal";
import { ExamInformationReading } from "@/screens/mock-exam/components/ExamInformationReading";
import { ExamPartIntroContent } from "@/screens/mock-exam/components/ExamPartIntroContent";
import { ExamPartDirectionsContent } from "@/screens/mock-exam/components/ExamPartDirectionsContent";
import { ExamPhaseCue } from "@/screens/mock-exam/components/ExamPhaseCue";
import { ExamPreludeError } from "@/screens/mock-exam/components/ExamPreludeError";
import { ExamQuestionContent } from "@/screens/mock-exam/components/ExamQuestionContent";
import { ExamQuestionCue } from "@/screens/mock-exam/components/ExamQuestionCue";
import { ExamQuestionProgress } from "@/screens/mock-exam/components/ExamQuestionProgress";
import { ExamSessionHeader } from "@/screens/mock-exam/components/ExamSessionHeader";
import {
  ExamTimerCard,
  type ExamTimerMode,
} from "@/screens/mock-exam/components/ExamTimerCard";
import { useExamSessionController } from "@/screens/mock-exam/hooks/use-exam-session-controller";

type ExamSessionScreenProps = NativeStackScreenProps<MockExamStackParamList, "ExamSession">;

/** 제출 완료 안내를 읽을 시간. 이 뒤에 채점 대기 화면으로 넘어간다. */
const COMPLETED_HANDOFF_MS = 1_600;

export function ExamSessionScreen({ navigation, route }: ExamSessionScreenProps) {
  const session = route.params.session;
  const isFocused = useIsFocused();
  const [isAppActive, setIsAppActive] = useState(AppState.currentState === "active");
  const [isExitConfirmationVisible, setIsExitConfirmationVisible] = useState(false);
  const isExamActive = isFocused && isAppActive;
  const controller = useExamSessionController(session, isExamActive);
  const {
    currentIndex,
    question,
    partPrelude,
    questionAudioUrl,
    phase,
    remainingSeconds,
    recorder,
    submissions,
    completeDirections,
    completePart3Intro,
    completePart4Reading,
    completeQuestionCue,
    completePreparationCue,
    completeResponseCue,
    markPart4ImageLoaded,
    beginResponse,
    finishResponse,
    retryRecording,
    retryRegistration,
  } = controller;
  const timerMode: ExamTimerMode =
    phase === "response-cue" ||
    phase === "response" ||
    phase === "starting-response" ||
    phase === "finalizing"
      ? "response"
      : phase === "part4-reading"
        ? "reading"
        : "preparation";

  const handleExitExam = useCallback(() => {
    submissions.dispose();
    navigation.popToTop();
  }, [navigation, submissions]);

  const handleRequestExitExam = useCallback(() => {
    setIsExitConfirmationVisible(true);
  }, []);

  const handleCancelExitExam = useCallback(() => {
    setIsExitConfirmationVisible(false);
  }, []);

  const handleConfirmExitExam = useCallback(() => {
    setIsExitConfirmationVisible(false);
    handleExitExam();
  }, [handleExitExam]);

  const handleGoHome = useCallback(() => {
    const tabNavigation = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
    submissions.dispose();
    navigation.popToTop();
    tabNavigation?.navigate("Home");
  }, [navigation, submissions]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      setIsAppActive(nextState === "active");
    });
    return () => subscription.remove();
  }, []);

  // 제출이 끝나면 채점 대기 화면으로 넘긴다. "모든 답변을 제출했어요"를 읽을
  // 시간만 잠깐 두고 넘어간다. `replace`인 이유: 응시 화면은 돌아갈 곳이 아니고,
  // 언마운트되면서 녹음·업로드 리소스가 정리되어야 한다.
  useEffect(() => {
    if (phase !== "completed") return;

    const timeoutId = setTimeout(() => {
      navigation.replace("GradingWait", { examId: session.examId });
    }, COMPLETED_HANDOFF_MS);

    return () => clearTimeout(timeoutId);
  }, [navigation, phase, session.examId]);

  if (!question) return null;

  const directions = getExamPartDirections(question.partNumber);
  const part3Prelude = partPrelude?.kind === "part3-intro" ? partPrelude : undefined;
  const part4Prelude = partPrelude?.kind === "part4-reading" ? partPrelude : undefined;
  const invalidPrelude = partPrelude?.kind === "invalid" ? partPrelude : undefined;
  const isSubmissionState = phase === "submission-barrier" || phase === "completed";
  const showTimer = [
    "preparation-cue",
    "preparation",
    "response-cue",
    "starting-response",
    "response",
    "finalizing",
  ].includes(phase);
  const showResponseWaveform = phase === "response" || phase === "finalizing";
  const activeCueKind =
    phase === "preparation-cue"
      ? "preparing"
      : phase === "response-cue"
        ? getExamResponseCueKind(question.partNumber)
        : null;

  return (
    <View className="flex-1 bg-surface">
      <StatusBar style="light" />
      <ExamSessionHeader
        partNumber={question.partNumber}
        onExit={
          phase === "submission-barrier" || phase === "completed"
            ? undefined
            : handleRequestExitExam
        }
      />

      <SafeAreaView
        edges={["bottom"]}
        className={`flex-1 ${phase === "directions" ? "bg-surface-subtle" : "bg-surface"}`}
      >
        {phase === "directions" && directions ? (
          <ExamPartDirectionsContent
            directions={directions}
            isActive={isExamActive}
            partNumber={question.partNumber}
            onComplete={completeDirections}
          />
        ) : phase === "part3-intro" ? (
          part3Prelude ? (
            <ExamPartIntroContent
              isActive={isExamActive}
              prelude={part3Prelude}
              onComplete={completePart3Intro}
              onExit={handleExitExam}
            />
          ) : (
            <ExamPreludeError onExit={handleExitExam} />
          )
        ) : phase === "part4-reading" ? (
          part4Prelude ? (
            <View className="flex-1 bg-surface">
              <ExamInformationReading
                prelude={part4Prelude}
                onImageLoad={markPart4ImageLoaded}
              />
              <View className="items-center gap-3 border-t border-line bg-surface px-5 pb-4 pt-4">
                <ExamTimerCard mode="reading" remainingSeconds={remainingSeconds} />
                <Pressable
                  accessibilityRole="button"
                  className="rounded-full border border-brand-300 px-4 py-2"
                  onPress={completePart4Reading}
                >
                  <Text className="text-sm text-brand-text">
                    준비 완료, 문제로 이동하기
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <ExamPreludeError onExit={handleExitExam} />
          )
        ) : phase === "part-prelude-error" ? (
          <ExamPreludeError prelude={invalidPrelude} onExit={handleExitExam} />
        ) : isSubmissionState ? (
          <ScrollView
            bounces={false}
            className="flex-1 bg-surface"
            contentContainerClassName={`flex-grow px-6 pb-8 pt-6 ${
              phase === "completed" ? "justify-center" : ""
            }`}
            showsVerticalScrollIndicator={false}
          >
            <ExamAnswerStatus
              canAskPermissionAgain={recorder.canAskPermissionAgain}
              jobs={submissions.jobs}
              phase={phase}
              recordingErrorMessage={recorder.lastError?.message}
              recordingStatus={recorder.status}
              summary={submissions.summary}
              onGoHome={handleGoHome}
              onRetryRecording={retryRecording}
              onRetryRegistration={retryRegistration}
              onRetrySubmission={submissions.retry}
            />
          </ScrollView>
        ) : (
          <>
            <View className="bg-surface px-4 py-3">
              <ExamQuestionProgress currentIndex={currentIndex} total={session.questions.length} />
            </View>

            <ScrollView
              bounces={false}
              className="flex-1"
              contentContainerClassName="flex-grow px-6 pb-5 pt-6"
              showsVerticalScrollIndicator={false}
            >
              <ExamQuestionContent question={question} />
            </ScrollView>

            <View className="items-center gap-3 bg-surface px-5 pb-3 pt-4">
              {showResponseWaveform ? (
                <AudioWaveform
                  active={phase === "response" && recorder.status === "recording"}
                  meteringDb={recorder.meteringDb}
                  variant="answer"
                />
              ) : null}

              {showTimer ? (
                <ExamTimerCard mode={timerMode} remainingSeconds={remainingSeconds} />
              ) : null}

              {phase === "question-cue" && questionAudioUrl ? (
                <ExamQuestionCue
                  audioUrl={questionAudioUrl}
                  isActive={isExamActive}
                  playCount={getQuestionAudioPlayCount(
                    question.partNumber,
                    question.isLastInPart,
                  )}
                  onComplete={completeQuestionCue}
                  onExit={handleExitExam}
                />
              ) : null}

              {activeCueKind ? (
                <ExamPhaseCue
                  cueKind={activeCueKind}
                  isActive={isExamActive}
                  onComplete={
                    phase === "preparation-cue"
                      ? completePreparationCue
                      : completeResponseCue
                  }
                  onExit={handleExitExam}
                />
              ) : null}

              <ExamAnswerStatus
                canAskPermissionAgain={recorder.canAskPermissionAgain}
                jobs={submissions.jobs}
                phase={phase}
                recordingErrorMessage={recorder.lastError?.message}
                recordingStatus={recorder.status}
                summary={submissions.summary}
                onGoHome={handleGoHome}
                onRetryRecording={retryRecording}
                onRetryRegistration={retryRegistration}
                onRetrySubmission={submissions.retry}
              />

              {phase === "preparation" || phase === "response" ? (
                <Pressable
                  accessibilityRole="button"
                  className="rounded-full border border-brand-300 px-4 py-2"
                  onPress={() => {
                    if (phase === "preparation") void beginResponse();
                    else void finishResponse("user");
                  }}
                >
                  <Text className="text-sm text-brand-text">
                    {phase === "preparation"
                      ? "준비 완료, 바로 답변 시작하기"
                      : currentIndex < session.questions.length - 1
                        ? "답변 완료, 다음 문제 보기"
                        : "마지막 답변 제출하기"}
                  </Text>
                </Pressable>
              ) : null}

              {phase !== "interrupted" &&
              phase !== "recording-recovery" &&
              phase !== "registration-recovery" ? (
                <Text className="text-center text-xs leading-4 text-ink-disabled">
                  답변 파일이 준비되면 다음 문제로 자동 전환되며 뒤로 갈 수 없어요.
                </Text>
              ) : null}
            </View>
          </>
        )}
      </SafeAreaView>

      <ExamExitConfirmationModal
        visible={isExitConfirmationVisible}
        onCancel={handleCancelExitExam}
        onConfirm={handleConfirmExitExam}
      />
    </View>
  );
}
