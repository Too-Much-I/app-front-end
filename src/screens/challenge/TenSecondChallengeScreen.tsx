import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Text } from "@/components/ui/Text";
import { AudioWaveform } from "@/features/audio/components/AudioWaveform";
import { deleteRecordingFile } from "@/features/audio/recording-file";
import {
  isAttemptAlreadyTerminal,
  isProgressRefreshRequired,
} from "@/features/challenge/challenge-error-codes";
import { useChallengeAttempt } from "@/features/challenge/use-challenge-attempt";
import { useChallengeQuestion } from "@/features/challenge/use-challenge-question";
import {
  CHALLENGE_RECORDING_DURATION_SEC,
  useChallengeRecorder,
} from "@/features/challenge/use-challenge-recorder";
import { useChallengeSubmission } from "@/features/challenge/use-challenge-submission";
import type { RootStackParamList } from "@/navigation/types";
import {
  getChallengeRemainingSeconds,
  hasUnsavedChallengeRecording,
  isChallengeStatusOnly,
  isChallengeSubmissionLocked,
  resolveChallengeUiStatus,
  resolveRecordingPhase,
} from "@/screens/challenge/challenge-status";
import { ChallengeActionBar } from "@/screens/challenge/components/ChallengeActionBar";
import { ChallengeHeader } from "@/screens/challenge/components/ChallengeHeader";
import { ChallengeNoteCard } from "@/screens/challenge/components/ChallengeNoteCard";
import { ChallengeNoteSkeleton } from "@/screens/challenge/components/ChallengeNoteSkeleton";
import { ChallengeReviewPanel } from "@/screens/challenge/components/ChallengeReviewPanel";
import { ChallengeStatusPanel } from "@/screens/challenge/components/ChallengeStatusPanel";
import { ChallengeTimerHeader } from "@/screens/challenge/components/ChallengeTimerHeader";
import type { ChallengeAnswerAccepted, ChallengeQuestion } from "@/types/challenge";

type TenSecondChallengeScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "TenSecondChallenge"
>;

interface RecordingReviewState {
  finalizedAudioUri: string | null;
  recordedSeconds: number;
}

type RecordingReviewAction =
  | { type: "recording-started" }
  | { type: "recording-finalized"; audioFileUri: string; recordedSeconds: number };

const INITIAL_RECORDING_REVIEW_STATE: RecordingReviewState = {
  finalizedAudioUri: null,
  recordedSeconds: 0,
};

function recordingReviewReducer(
  _state: RecordingReviewState,
  action: RecordingReviewAction,
): RecordingReviewState {
  switch (action.type) {
    case "recording-started":
      return INITIAL_RECORDING_REVIEW_STATE;
    case "recording-finalized":
      return {
        finalizedAudioUri: action.audioFileUri,
        recordedSeconds: action.recordedSeconds,
      };
  }
}

/**
 * 오늘의 문장 하나를 10초 안에 영어로 말해보는 화면.
 *
 * 스테이지 화면이 아직 풀지 않은 문제 번호만 넘겨주고, 날짜는 여기서 만들지 않는다 —
 * "오늘"의 기준은 서버이고 응답의 `challengeDate`가 그 값이다. 녹음 파일도 그 날짜와
 * 문제 번호로 묶여서 확정된다.
 *
 * 시작 버튼이 따로 없다. 문제를 읽는 순간이 곧 10초의 시작이라, 문제가 도착하면
 * 바로 녹음을 켜고 사용자는 끝내는 결정("완료")만 한다.
 */
export function TenSecondChallengeScreen({
  navigation,
  route,
}: TenSecondChallengeScreenProps) {
  const { challengeDate, questionNumber } = route.params;
  const {
    status: questionStatus,
    question,
    retry: retryQuestion,
  } = useChallengeQuestion(challengeDate, questionNumber);
  /**
   * 문제가 오면 곧바로 attempt를 발급받는다. 녹음은 이게 끝난 뒤에 시작한다(명세 6.3).
   * 업로드 URL은 여기 없다 — 제출을 누른 뒤 제출 훅이 따로 받아 온다.
   */
  const {
    status: attemptStatus,
    attempt,
    errorCode: attemptErrorCode,
    retry: retryAttempt,
  } = useChallengeAttempt(question);
  const {
    snapshot: {
      status: recordingStatus,
      elapsedMs,
      remainingMs,
      meteringDb,
    },
    actions: {
      start: startRecorder,
      finish: finishRecorder,
      resetForRetry: resetRecorderForRetry,
      transferOwnership: transferRecordingOwnership,
    },
  } = useChallengeRecorder();
  /**
   * 서버가 확인해 준 날짜가 언제나 우선이다. route로 받은 값은 첫 조회의 힌트일 뿐이고,
   * 그마저 없으면 문제 조회가 오늘 진행도에서 날짜를 알아 온다.
   */
  const resolvedDate = attempt?.date ?? question?.date ?? challengeDate ?? "";

  const [{ finalizedAudioUri, recordedSeconds }, dispatchRecordingReview] = useReducer(
    recordingReviewReducer,
    INITIAL_RECORDING_REVIEW_STATE,
  );
  const [isDiscardVisible, setIsDiscardVisible] = useState(false);
  const finishingRef = useRef(false);
  /**
   * 녹음이 끝나면 generation이 정리되면서 `recorder.elapsedMs`가 0으로 돌아간다.
   * 검토 화면에 길이를 남기려면 녹음 중 마지막으로 본 값을 따로 들고 있어야 한다.
   */
  const lastElapsedSecondsRef = useRef(0);
  // 화면을 떠나기로 결정한 순간부터는 `beforeRemove` 확인을 건너뛴다.
  const leavingRef = useRef(false);

  const goToResult = useCallback(
    (accepted: ChallengeAnswerAccepted | null) => {
      // 서버가 접수했으니 로컬 사본은 더 쓸모가 없다. 녹음기에서 소유권을 넘겨받아 지우고,
      // 결과 화면으로 replace한다 — 뒤로가기가 이미 끝난 녹음 화면으로 돌아가면 안 된다.
      if (finalizedAudioUri) {
        transferRecordingOwnership(finalizedAudioUri);
        try {
          deleteRecordingFile(finalizedAudioUri);
        } catch (error) {
          console.error("[Challenge] 제출한 녹음 파일 삭제 실패", error);
        }
      }
      /*
       * "한 문장 더"의 목적지. 순서대로만 진행하므로 방금 푼 다음 번호이고, 마지막
       * 문장이면 없다. 결과 화면은 이 값을 계산할 근거가 없어서 여기서 실어 보낸다.
       */
      const nextQuestionNumber =
        question !== null && questionNumber < question.totalQuestionCount
          ? questionNumber + 1
          : null;

      leavingRef.current = true;
      navigation.replace("ChallengeResult", {
        challengeDate: accepted?.date ?? resolvedDate,
        questionNumber,
        ...(nextQuestionNumber === null ? {} : { nextQuestionNumber }),
        // 접수 응답이 참고 답안까지 줬다면 결과 화면이 스피너부터 보여줄 이유가 없다.
        ...(accepted && question
          ? {
              initialResult: {
                questionNumber: accepted.questionNumber,
                promptKo: question.promptKo,
                gradingStatus: accepted.gradingStatus,
                referenceAnswer: accepted.referenceAnswer,
              },
            }
          : {}),
      });
    },
    [
      finalizedAudioUri,
      navigation,
      question,
      questionNumber,
      resolvedDate,
      transferRecordingOwnership,
    ],
  );

  /**
   * 서버가 이 화면의 전제(오늘 날짜, 이 문제가 다음 차례)를 부정했다. 명세대로 사용자에게
   * 오류를 띄우지 않고 오늘 진행도를 다시 읽을 수 있는 스테이지로 조용히 돌려보낸다.
   */
  const goToStage = useCallback(() => {
    leavingRef.current = true;
    navigation.goBack();
  }, [navigation]);

  const {
    status: submissionStatus,
    errorMessage: submissionErrorMessage,
    submit: submitChallengeRecording,
    reset: resetSubmission,
  } = useChallengeSubmission({
    attempt,
    onSubmitted: goToResult,
    onProgressStale: goToStage,
  });

  /**
   * 녹음 단계는 저장하지 않고 매번 리코더에서 읽는다. 같은 사실을 화면이 한 벌 더
   * 들고 있으면 둘을 맞추는 동기화 코드가 생기고, 어느 쪽이 진실인지 매번 확인해야 한다.
   * 화면이 실제로 소유하는 사실은 "확정된 녹음을 받았는가" 하나뿐이다.
   */
  const phase = resolveRecordingPhase(recordingStatus, finalizedAudioUri !== null);

  const uiStatus = resolveChallengeUiStatus({
    phase,
    questionStatus,
    attemptStatus,
    submissionStatus,
  });
  const remainingSeconds = getChallengeRemainingSeconds(uiStatus, remainingMs);

  const startRecording = useCallback(
    async (target: ChallengeQuestion) => {
      resetRecorderForRetry();
      dispatchRecordingReview({ type: "recording-started" });
      lastElapsedSecondsRef.current = 0;

      // 실패는 리코더의 status가 이미 말해준다(permission-denied / error / interrupted).
      // 화면은 로그만 남기고 그 status에서 단계를 읽는다.
      const result = await startRecorder({
        date: target.date,
        questionNumber: target.questionNumber,
      });
      if (result.reason === "error") {
        console.error("[Challenge] 녹음 시작 실패", result.error);
      }
    },
    [resetRecorderForRetry, startRecorder],
  );

  // 문제가 도착하면 곧바로 한 번 녹음을 켠다. 재녹음은 사용자가 버튼으로 다시 부른다.
  const autoStartedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!question) return;

    /*
     * 이미 응시가 끝난 문제로 들어왔다. 스테이지의 캐시가 오래됐거나 다른 기기에서 푼
     * 경우다 — 명세대로 `attemptStatus`만 보고 결과 화면으로 보낸다. 문제마다 응시는
     * 한 번뿐이라 여기서 녹음을 켜면 사용자가 올릴 수 없는 답을 만들게 된다.
     */
    if (question.attemptStatus === "submitted") {
      leavingRef.current = true;
      navigation.replace("ChallengeResult", {
        challengeDate: question.date,
        questionNumber: question.questionNumber,
      });
      return;
    }

    // 명세 6.3 — attempt 발급이 성공한 뒤에만 녹음을 시작한다. 발급 전에 켜면 사용자가
    // 올릴 곳 없는 답을 만들게 되고, 자정을 넘긴 경우가 정확히 그 상황이다.
    if (attemptStatus !== "ready") return;

    const questionKey = `${question.date}#${question.questionNumber}`;
    if (autoStartedKeyRef.current === questionKey) return;
    autoStartedKeyRef.current = questionKey;
    void startRecording(question);
  }, [attemptStatus, navigation, question, startRecording]);

  /**
   * attempt를 못 만든 이유가 이 화면의 전제를 부정하는 경우다.
   *
   * 이미 끝난 응시면 결과로, 순서가 어긋났거나 날짜가 바뀐 경우면 스테이지로 보낸다.
   * 그 밖의 실패는 화면에 남아 다시 시도할 수 있게 둔다 — 여기서 떠나보내면 하루 한 번의
   * 짧은 루프에 왕복이 붙는다.
   */
  useEffect(() => {
    if (attemptStatus !== "failed" || attemptErrorCode === null) return;

    if (isAttemptAlreadyTerminal(attemptErrorCode)) {
      leavingRef.current = true;
      navigation.replace("ChallengeResult", {
        challengeDate: resolvedDate,
        questionNumber,
      });
      return;
    }
    if (isProgressRefreshRequired(attemptErrorCode)) goToStage();
  }, [
    attemptErrorCode,
    attemptStatus,
    goToStage,
    navigation,
    questionNumber,
    resolvedDate,
  ]);

  // 녹음 중 마지막으로 관찰한 경과 시간. 확정 직후에는 recorder가 0으로 되돌린다.
  useEffect(() => {
    if (recordingStatus !== "recording") return;
    lastElapsedSecondsRef.current = elapsedMs / 1_000;
  }, [elapsedMs, recordingStatus]);

  const finishRecording = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;

    try {
      const recording = await finishRecorder("user");
      dispatchRecordingReview({
        type: "recording-finalized",
        audioFileUri: recording.audioFileUri,
        recordedSeconds: Math.min(
          lastElapsedSecondsRef.current,
          CHALLENGE_RECORDING_DURATION_SEC,
        ),
      });
    } catch (error) {
      // 확정에 실패하면 리코더가 error나 interrupted로 넘어가 있다. 단계는 거기서 읽힌다.
      console.error("[Challenge] 녹음 확정 실패", error);
    } finally {
      finishingRef.current = false;
    }
  }, [finishRecorder]);

  /**
   * 10초를 다 쓰면 네이티브가 먼저 멈추고 훅이 스스로 확정을 시작한다.
   *
   * 보통은 남은 시간이 0이 된 렌더에서 화면이 먼저 확정을 부르지만, 미터 폴링이 정지
   * 직전에 걸리면 남은 시간이 몇 ms 남은 채로 훅의 확정이 앞선다. 그때는 `finalizing`을
   * 신호로 삼아 같은 종료 약속을 이어받는다 — 두 경로 모두 같은 녹음본 하나로 끝난다.
   */
  useEffect(() => {
    if (phase !== "recording") return;
    const hasRunOut = recordingStatus === "recording" && remainingMs <= 0;
    if (!hasRunOut && recordingStatus !== "finalizing") return;
    void finishRecording();
  }, [finishRecording, phase, recordingStatus, remainingMs]);

  const retakeRecording = useCallback(() => {
    if (!question) return;
    resetSubmission();
    void startRecording(question);
  }, [question, resetSubmission, startRecording]);

  /**
   * `question-failed` 화면의 "다시 시도". 조회와 attempt 발급 둘 다 이 상태로 모이므로
   * 실패한 쪽을 다시 부른다. 조회가 실패했다면 attempt는 아직 시작도 안 했다.
   */
  const retryPreparation = useCallback(() => {
    if (questionStatus === "failed") {
      retryQuestion();
      return;
    }
    retryAttempt();
  }, [questionStatus, retryAttempt, retryQuestion]);

  const submitRecording = useCallback(() => {
    if (!finalizedAudioUri) return;
    submitChallengeRecording(finalizedAudioUri);
  }, [finalizedAudioUri, submitChallengeRecording]);

  const leaveScreen = useCallback(() => {
    leavingRef.current = true;
    setIsDiscardVisible(false);
    navigation.goBack();
  }, [navigation]);

  const requestClose = useCallback(() => {
    if (isChallengeSubmissionLocked(uiStatus)) return;
    if (hasUnsavedChallengeRecording(uiStatus)) {
      setIsDiscardVisible(true);
      return;
    }
    leaveScreen();
  }, [leaveScreen, uiStatus]);

  // 안드로이드 하드웨어 뒤로가기와 스택 제스처도 같은 확인을 거치게 한다.
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (leavingRef.current) return;
      if (isChallengeSubmissionLocked(uiStatus)) {
        event.preventDefault();
        return;
      }
      if (!hasUnsavedChallengeRecording(uiStatus)) return;

      event.preventDefault();
      setIsDiscardVisible(true);
    });

    return unsubscribe;
  }, [navigation, uiStatus]);

  return (
    <View className="flex-1 bg-surface-subtle">
      <StatusBar style="dark" />
      <ChallengeHeader
        onClose={isChallengeSubmissionLocked(uiStatus) ? undefined : requestClose}
      />

      <SafeAreaView className="flex-1" edges={["bottom"]}>
        {uiStatus === "loading" || !question ? (
          <ChallengeNoteSkeleton />
        ) : isChallengeStatusOnly(uiStatus) ? (
          <ChallengeStatusPanel
            errorMessage={submissionErrorMessage}
            onLeave={leaveScreen}
            onOpenSettings={() => void Linking.openSettings()}
            onRetryQuestion={retryPreparation}
            onRetryRecording={retakeRecording}
            onRetrySubmit={submitRecording}
            status={uiStatus}
          />
        ) : (
          <>
            <ScrollView
              className="flex-1"
              contentContainerClassName="flex-grow gap-5 px-5 pb-4 pt-4"
              showsVerticalScrollIndicator={false}
            >
              <ChallengeTimerHeader
                questionNumber={question.questionNumber}
                remainingSeconds={remainingSeconds}
                totalQuestionCount={question.totalQuestionCount}
              />

              <ChallengeNoteCard
                promptKo={question.promptKo}
                remainingSeconds={remainingSeconds}
                totalSeconds={CHALLENGE_RECORDING_DURATION_SEC}
              >
                {uiStatus === "preparing" ? (
                  <Text className="text-center text-sm text-ink-muted">
                    마이크를 준비하고 있어요...
                  </Text>
                ) : null}

                {uiStatus === "recording" ? (
                  <View className="items-center">
                    <AudioWaveform active meteringDb={meteringDb} variant="answer" />
                  </View>
                ) : null}

                {uiStatus === "reviewing" && finalizedAudioUri ? (
                  <ChallengeReviewPanel
                    audioFileUri={finalizedAudioUri}
                    key={finalizedAudioUri}
                    recordedSeconds={recordedSeconds}
                  />
                ) : null}
              </ChallengeNoteCard>
            </ScrollView>

            <View className="px-5 pb-3">
              <ChallengeActionBar
                onFinish={() => void finishRecording()}
                onRetake={retakeRecording}
                onSubmit={submitRecording}
                status={uiStatus}
              />
            </View>
          </>
        )}
      </SafeAreaView>

      {/* 사라지는 건 방금 녹음뿐이다 — 오늘의 다른 문장과 이미 푼 기록은 그대로 남는다. */}
      <ConfirmModal
        cancelLabel="계속 하기"
        confirmHint="지금 녹음을 버리고 이전 화면으로 돌아갑니다"
        confirmLabel="나가기"
        message="지금 녹음한 답변은 저장되지 않아요. 오늘의 다른 문장은 그대로 남아 있어요."
        onCancel={() => setIsDiscardVisible(false)}
        onConfirm={leaveScreen}
        title="10초 챌린지를 그만둘까요?"
        visible={isDiscardVisible}
      />
    </View>
  );
}
