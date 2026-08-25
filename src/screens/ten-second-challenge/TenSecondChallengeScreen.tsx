import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Text } from "@/components/ui/Text";
import { deleteRecordingFile } from "@/features/audio/recording-file";
import type { AudioRecordingStatus } from "@/features/audio/use-timed-audio-recorder";
import { useChallengeQuestion } from "@/features/challenge/use-challenge-question";
import {
  CHALLENGE_RECORDING_DURATION_MS,
  useChallengeRecorder,
} from "@/features/challenge/use-challenge-recorder";
import { useChallengeSubmission } from "@/features/challenge/use-challenge-submission";
import type { RootStackParamList } from "@/navigation/types";
import { AudioWaveform } from "@/screens/mock-exam/components/AudioWaveform";
import {
  hasUnsavedRecording,
  isStatusOnly,
  isSubmissionLocked,
  type ChallengeUiStatus,
} from "@/screens/ten-second-challenge/challenge-ui";
import { ChallengeActionBar } from "@/screens/ten-second-challenge/components/ChallengeActionBar";
import { ChallengeHeader } from "@/screens/ten-second-challenge/components/ChallengeHeader";
import { ChallengeNoteCard } from "@/screens/ten-second-challenge/components/ChallengeNoteCard";
import { ChallengeNoteSkeleton } from "@/screens/ten-second-challenge/components/ChallengeNoteSkeleton";
import { ChallengeReviewPanel } from "@/screens/ten-second-challenge/components/ChallengeReviewPanel";
import { ChallengeStatusPanel } from "@/screens/ten-second-challenge/components/ChallengeStatusPanel";
import { ChallengeTimerHeader } from "@/screens/ten-second-challenge/components/ChallengeTimerHeader";
import type { ChallengeAnswerAccepted, ChallengeQuestion } from "@/types/challenge";

type TenSecondChallengeScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "TenSecondChallenge"
>;

const CHALLENGE_RECORDING_SECONDS = CHALLENGE_RECORDING_DURATION_MS / 1_000;

/** 녹음 진행에 따라 화면이 직접 관리하는 단계. 문제 조회 상태는 훅이 따로 들고 있다. */
type RecordingPhase =
  | "preparing"
  | "recording"
  | "reviewing"
  | "record-failed"
  | "permission-denied";

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
  const { status: questionStatus, question, retry: retryQuestion } =
    useChallengeQuestion(challengeDate, questionNumber);
  const recorder = useChallengeRecorder();
  /**
   * 서버가 확인해 준 날짜가 언제나 우선이다. route로 받은 값은 첫 조회의 힌트일 뿐이고,
   * 그마저 없으면 문제 조회가 오늘 진행도에서 날짜를 알아 온다.
   */
  const resolvedDate = question?.date ?? challengeDate ?? "";

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

  const goToResult = useCallback(
    (accepted: ChallengeAnswerAccepted | null) => {
      // 서버가 접수했으니 로컬 사본은 더 쓸모가 없다. 녹음기에서 소유권을 넘겨받아 지우고,
      // 결과 화면으로 replace한다 — 뒤로가기가 이미 끝난 녹음 화면으로 돌아가면 안 된다.
      if (finalizedAudioUri) {
        recorder.transferOwnership(finalizedAudioUri);
        try {
          deleteRecordingFile(finalizedAudioUri);
        } catch (error) {
          console.error("[Challenge] 제출한 녹음 파일 삭제 실패", error);
        }
      }
      leavingRef.current = true;
      navigation.replace("ChallengeResult", {
        challengeDate: accepted?.date ?? resolvedDate,
        questionNumber,
        // 접수 응답이 참고 답안까지 줬다면 결과 화면이 스피너부터 보여줄 이유가 없다.
        ...(accepted && question
          ? {
              seed: {
                questionNumber: accepted.questionNumber,
                promptKo: question.promptKo,
                gradingStatus: accepted.gradingStatus,
                referenceAnswer: accepted.referenceAnswer,
              },
            }
          : {}),
      });
    },
    [finalizedAudioUri, navigation, question, questionNumber, recorder, resolvedDate],
  );

  /**
   * 서버가 이 화면의 전제(오늘 날짜, 이 문제가 다음 차례)를 부정했다. 명세대로 사용자에게
   * 오류를 띄우지 않고 오늘 진행도를 다시 읽을 수 있는 스테이지로 조용히 돌려보낸다.
   */
  const goToStage = useCallback(() => {
    leavingRef.current = true;
    navigation.goBack();
  }, [navigation]);

  const submission = useChallengeSubmission({
    challengeDate: resolvedDate,
    questionNumber,
    onSubmitted: goToResult,
    onProgressStale: goToStage,
  });

  /**
   * 녹음 단계는 저장하지 않고 매번 리코더에서 읽는다. 같은 사실을 화면이 한 벌 더
   * 들고 있으면 둘을 맞추는 동기화 코드가 생기고, 어느 쪽이 진실인지 매번 확인해야 한다.
   * 화면이 실제로 소유하는 사실은 "확정된 녹음을 받았는가" 하나뿐이다.
   */
  const phase = resolveRecordingPhase(recorder.status, finalizedAudioUri !== null);

  const uiStatus = resolveUiStatus({
    phase,
    questionStatus,
    submissionStatus: submission.status,
  });
  const remainingSeconds = getRemainingSeconds(uiStatus, recorder.remainingMs);

  const startRecording = useCallback(
    async (target: ChallengeQuestion) => {
      recorder.resetForRetry();
      setFinalizedAudioUri(null);
      setRecordedSeconds(0);
      lastElapsedSecondsRef.current = 0;

      // 실패는 리코더의 status가 이미 말해준다(permission-denied / error / interrupted).
      // 화면은 로그만 남기고 그 status에서 단계를 읽는다.
      const result = await recorder.start({
        date: target.date,
        questionNumber: target.questionNumber,
      });
      if (result.reason === "error") {
        console.error("[Challenge] 녹음 시작 실패", result.error);
      }
    },
    [recorder],
  );

  /**
   * `recorder`는 미터 폴링 때문에 매 tick 새 객체가 되고 `startRecording`도 함께 바뀐다.
   * 자동 시작 효과가 그 변화에 끌려다니지 않도록 최신 함수만 ref로 들고 본다.
   */
  const startRecordingRef = useRef(startRecording);
  useEffect(() => {
    startRecordingRef.current = startRecording;
  }, [startRecording]);

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

    const questionKey = `${question.date}#${question.questionNumber}`;
    if (autoStartedKeyRef.current === questionKey) return;
    autoStartedKeyRef.current = questionKey;
    void startRecordingRef.current(question);
  }, [navigation, question]);

  // 녹음 중 마지막으로 관찰한 경과 시간. 확정 직후에는 recorder가 0으로 되돌린다.
  useEffect(() => {
    if (recorder.status !== "recording") return;
    lastElapsedSecondsRef.current = recorder.elapsedMs / 1_000;
  }, [recorder.elapsedMs, recorder.status]);

  const finishRecording = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;

    try {
      const recording = await recorder.finish("user");
      setFinalizedAudioUri(recording.audioFileUri);
      setRecordedSeconds(
        Math.min(lastElapsedSecondsRef.current, CHALLENGE_RECORDING_SECONDS),
      );
    } catch (error) {
      // 확정에 실패하면 리코더가 error나 interrupted로 넘어가 있다. 단계는 거기서 읽힌다.
      console.error("[Challenge] 녹음 확정 실패", error);
    } finally {
      finishingRef.current = false;
    }
  }, [recorder]);

  /**
   * 10초를 다 쓰면 네이티브가 먼저 멈추고 훅이 스스로 확정을 시작한다.
   *
   * 보통은 남은 시간이 0이 된 렌더에서 화면이 먼저 확정을 부르지만, 미터 폴링이 정지
   * 직전에 걸리면 남은 시간이 몇 ms 남은 채로 훅의 확정이 앞선다. 그때는 `finalizing`을
   * 신호로 삼아 같은 종료 약속을 이어받는다 — 두 경로 모두 같은 녹음본 하나로 끝난다.
   */
  useEffect(() => {
    if (phase !== "recording") return;
    const hasRunOut = recorder.status === "recording" && recorder.remainingMs <= 0;
    if (!hasRunOut && recorder.status !== "finalizing") return;
    void finishRecording();
  }, [finishRecording, phase, recorder.remainingMs, recorder.status]);

  const retakeRecording = useCallback(() => {
    if (!question) return;
    submission.reset();
    void startRecording(question);
  }, [question, startRecording, submission]);

  const submitRecording = useCallback(() => {
    if (!finalizedAudioUri) return;
    submission.submit(finalizedAudioUri);
  }, [finalizedAudioUri, submission]);

  const leaveScreen = useCallback(() => {
    leavingRef.current = true;
    setIsDiscardVisible(false);
    navigation.goBack();
  }, [navigation]);

  const requestClose = useCallback(() => {
    if (isSubmissionLocked(uiStatus)) return;
    if (hasUnsavedRecording(uiStatus)) {
      setIsDiscardVisible(true);
      return;
    }
    leaveScreen();
  }, [leaveScreen, uiStatus]);

  // 안드로이드 하드웨어 뒤로가기와 스택 제스처도 같은 확인을 거치게 한다.
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (leavingRef.current) return;
      if (isSubmissionLocked(uiStatus)) {
        event.preventDefault();
        return;
      }
      if (!hasUnsavedRecording(uiStatus)) return;

      event.preventDefault();
      setIsDiscardVisible(true);
    });

    return unsubscribe;
  }, [navigation, uiStatus]);

  return (
    <View className="flex-1 bg-surface-subtle">
      <StatusBar style="dark" />
      <ChallengeHeader
        onClose={isSubmissionLocked(uiStatus) ? undefined : requestClose}
      />

      <SafeAreaView className="flex-1" edges={["bottom"]}>
        {uiStatus === "loading" || !question ? (
          <ChallengeNoteSkeleton />
        ) : isStatusOnly(uiStatus) ? (
          <ChallengeStatusPanel
            errorMessage={submission.errorMessage}
            onLeave={leaveScreen}
            onOpenSettings={() => void Linking.openSettings()}
            onRetryQuestion={retryQuestion}
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
                totalSeconds={CHALLENGE_RECORDING_SECONDS}
              >
                {uiStatus === "preparing" ? (
                  <Text className="text-center text-sm text-ink-muted">
                    마이크를 준비하고 있어요...
                  </Text>
                ) : null}

                {uiStatus === "recording" ? (
                  <View className="items-center">
                    <AudioWaveform active meteringDb={recorder.meteringDb} variant="answer" />
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

/**
 * 리코더 상태에서 녹음 단계를 읽는다.
 *
 * `finalizing`을 `recording`으로 두는 이유는 확정이 오가는 찰나에 화면이 깜빡이지 않게
 * 하려는 것이다. 확정이 성공하면 곧바로 `reviewing`으로, 실패하면 리코더가 `error`나
 * `interrupted`로 넘어가 `record-failed`가 된다.
 */
function resolveRecordingPhase(
  status: AudioRecordingStatus,
  hasFinalizedRecording: boolean,
): RecordingPhase {
  if (hasFinalizedRecording) return "reviewing";

  switch (status) {
    case "permission-denied":
      return "permission-denied";
    case "error":
    case "interrupted":
      return "record-failed";
    case "recording":
    case "finalizing":
      return "recording";
    case "idle":
    case "preparing":
      return "preparing";
  }
}

/**
 * 조회·녹음·제출 세 갈래를 화면 상태 하나로 합친다.
 *
 * 제출이 시작되면 그쪽이 화면을 독점한다 — 업로드 중에 노트나 녹음 버튼을 다시 보여줄
 * 이유가 없고, 그 사이 들어온 조회 실패로 진행 중인 제출을 가릴 수도 없다.
 */
function resolveUiStatus({
  phase,
  questionStatus,
  submissionStatus,
}: {
  phase: RecordingPhase;
  questionStatus: "loading" | "ready" | "failed";
  submissionStatus: "idle" | "submitting" | "failed";
}): ChallengeUiStatus {
  if (submissionStatus === "submitting") return "submitting";
  if (submissionStatus === "failed") return "submit-failed";
  if (questionStatus === "loading") return "loading";
  if (questionStatus === "failed") return "question-failed";
  return phase;
}

/**
 * 배지에 띄울 남은 시간.
 *
 * 녹음이 시작되기 전에는 recorder가 아직 0을 들고 있어서 제한 시간을 그대로 보여주고,
 * 확정된 뒤에는 셀 시간이 없으므로 배지 자체를 지운다.
 */
function getRemainingSeconds(
  status: ChallengeUiStatus,
  remainingMs: number,
): number | null {
  if (status === "preparing") return CHALLENGE_RECORDING_SECONDS;
  if (status === "recording") return remainingMs / 1_000;
  return null;
}
