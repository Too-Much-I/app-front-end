import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Image, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { PLAYBACK_AUDIO_MODE } from "@/features/exam/answer-audio";
import { createExamSession } from "@/features/exam/api/exam-session-create";
import { ExamQuestionAudioError } from "@/features/exam/question-audio";
import { reportOperationalError } from "@/lib/operational-error-reporting";
import type { MockExamStackParamList } from "@/navigation/types";
import { DeviceTestLayout } from "@/screens/mock-exam/components/DeviceTestLayout";
import { colors } from "@/theme";

const headphonesIcon = require("../../../public/icons/device-test/headphones.png");
const soundCheckAudio = require("../../../public/assets/audio/sound_check.wav");

type SoundTestScreenProps = NativeStackScreenProps<MockExamStackParamList, "SoundTest">;

export function SoundTestScreen({ navigation }: SoundTestScreenProps) {
  const [hasPlayed, setHasPlayed] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);
  const [isStartingExam, setIsStartingExam] = useState(false);
  const [startExamError, setStartExamError] = useState<string | null>(null);
  const createRequestRef = useRef<AbortController | null>(null);
  const hasReportedPlaybackFailureRef = useRef(false);
  const isAppActiveRef = useRef(AppState.currentState === "active");
  const isMountedRef = useRef(true);
  const startAttemptRef = useRef(0);
  const soundCheckPlayer = useAudioPlayer(soundCheckAudio, { updateInterval: 100 });
  const playbackStatus = useAudioPlayerStatus(soundCheckPlayer);
  const hasPlaybackFinished =
    playbackStatus.didJustFinish ||
    (playbackStatus.duration > 0 && playbackStatus.currentTime >= playbackStatus.duration);
  const hasSoundPlaybackError = hasPlaybackError || playbackStatus.error !== null;
  const canCompleteSoundTest = hasPlayed && !hasSoundPlaybackError;

  const handlePlayback = useCallback(async () => {
    if (playbackStatus.playing) {
      soundCheckPlayer.pause();
      return;
    }

    hasReportedPlaybackFailureRef.current = false;
    try {
      setHasPlaybackError(false);
      await setAudioModeAsync(PLAYBACK_AUDIO_MODE);

      if (playbackStatus.isLoaded && hasPlaybackFinished) {
        await soundCheckPlayer.seekTo(0);
      }

      soundCheckPlayer.play();
      setHasPlayed(true);
    } catch (error) {
      console.error("[SoundTest] 안내 음성 재생 실패", error);
      if (
        isMountedRef.current &&
        isAppActiveRef.current &&
        !hasReportedPlaybackFailureRef.current
      ) {
        hasReportedPlaybackFailureRef.current = true;
        reportOperationalError({
          code: "EXAM_REQUIRED_AUDIO_FAILED",
          cueKind: "sound-test",
          reason: "playback",
        });
      }
      setHasPlaybackError(true);
    }
  }, [hasPlaybackFinished, playbackStatus, soundCheckPlayer]);

  const handleBack = useCallback(() => {
    createRequestRef.current?.abort();
    soundCheckPlayer.pause();
    navigation.goBack();
  }, [navigation, soundCheckPlayer]);

  const handleStartExam = useCallback(async () => {
    if (createRequestRef.current) return;

    soundCheckPlayer.pause();
    const controller = new AbortController();
    startAttemptRef.current += 1;
    const attempt = startAttemptRef.current === 1 ? "initial" : "retry";
    createRequestRef.current = controller;
    setIsStartingExam(true);
    setStartExamError(null);

    try {
      const session = await createExamSession(controller.signal);
      if (!controller.signal.aborted) navigation.navigate("ExamSession", { session });
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ExamQuestionAudioError) {
        console.error("[SoundTest] 문제 음성이 없어 응시를 차단", {
          examId: error.examId,
          issues: error.issues,
        });
        const firstIssue = error.issues[0];
        reportOperationalError({
          code: "EXAM_REQUIRED_AUDIO_FAILED",
          cueKind: "question",
          reason: firstIssue?.reason ?? "missing",
          ...(firstIssue
            ? {
                partNumber: firstIssue.partNumber,
                questionNumber: firstIssue.questionNumber,
              }
            : {}),
          issueCount: error.issues.length,
        });
        setStartExamError("문제 음성이 준비되지 않은 시험이에요. 다시 시도해주세요.");
        return;
      }
      console.error("[SoundTest] 모의고사 세션 생성 실패", error);
      reportOperationalError({
        code: "EXAM_SESSION_CREATE_FAILED",
        stage: "session-create",
        attempt,
        cause: error,
      });
      setStartExamError("시험 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      if (createRequestRef.current === controller) {
        createRequestRef.current = null;
        if (!controller.signal.aborted) setIsStartingExam(false);
      }
    }
  }, [navigation, soundCheckPlayer]);

  useEffect(() => {
    if (
      playbackStatus.error === null ||
      !isAppActiveRef.current ||
      hasReportedPlaybackFailureRef.current
    ) {
      return;
    }
    hasReportedPlaybackFailureRef.current = true;
    reportOperationalError({
      code: "EXAM_REQUIRED_AUDIO_FAILED",
      cueKind: "sound-test",
      reason: playbackStatus.mediaServicesDidReset ? "media-reset" : "playback",
    });
  }, [playbackStatus.error, playbackStatus.mediaServicesDidReset]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      isAppActiveRef.current = state === "active";
    });

    return () => {
      isMountedRef.current = false;
      subscription.remove();
      createRequestRef.current?.abort();
    };
  }, []);

  return (
    <DeviceTestLayout currentStep={2} onBack={handleBack}>
      <View className="flex-1">
        <View className="items-center">
          <Text className="text-center text-3xl">음향 테스트</Text>
          <Text className="mt-2 text-center text-base leading-6 text-ink-muted">
            {isComplete
              ? startExamError ??
                (isStartingExam
                  ? "시험 문제를 준비하고 있어요"
                  : "잘 들린다면 시험을 시작해주세요")
              : hasSoundPlaybackError
                ? "안내 음성을 재생하지 못했어요. 다시 시도해주세요"
                : "오디오나 헤드폰 환경을 권장해요"}
          </Text>
        </View>

        <View className="my-6 min-h-80 flex-1 items-center justify-center px-5 py-6">
          {isComplete ? (
            <View className="absolute right-5 top-5 h-11 w-11 items-center justify-center rounded-full bg-sky-surface">
              <MaterialCommunityIcons name="check-bold" size={26} color={colors.sky.text} />
            </View>
          ) : null}

          <View className="h-52 w-52 items-center justify-center rounded-3xl bg-brand-50">
            <Image
              accessibilityLabel="헤드폰"
              className="h-40 w-44"
              resizeMode="contain"
              source={headphonesIcon}
            />
          </View>

          {!isComplete ? (
            <Pressable
              accessibilityHint="테스트용 안내 음성을 재생합니다"
              accessibilityRole="button"
              className="mt-8 flex-row items-center gap-2 rounded-full border border-brand-cta bg-surface-subtle px-5 py-3"
              onPress={() => {
                void handlePlayback();
              }}
            >
              <MaterialCommunityIcons
                name={playbackStatus.playing ? "pause" : hasPlaybackFinished ? "replay" : "play"}
                size={22}
                color={colors.brand.text}
              />
              <Text className="text-sm text-brand-text">
                {playbackStatus.playing
                  ? "일시정지"
                  : hasPlaybackFinished
                    ? "다시 재생하기"
                    : hasPlayed
                      ? "이어 듣기"
                      : "안내 음성 재생"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {isComplete ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: isStartingExam, disabled: isStartingExam }}
            className={`items-center justify-center rounded-2xl py-4 ${
              isStartingExam ? "bg-line" : "bg-brand-cta"
            }`}
            disabled={isStartingExam}
            onPress={() => {
              void handleStartExam();
            }}
          >
            {isStartingExam ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator color={colors.ink.disabled} />
                <Text className="text-lg text-ink-disabled">시험 준비 중...</Text>
              </View>
            ) : (
              <Text className="text-lg text-white">
                {startExamError ? "시험 시작 다시 시도" : "모의고사 시작하기"}
              </Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canCompleteSoundTest }}
            className={`items-center justify-center rounded-2xl py-4 ${
              canCompleteSoundTest ? "bg-brand-cta" : "bg-line"
            }`}
            disabled={!canCompleteSoundTest}
            onPress={() => {
              if (!canCompleteSoundTest) return;
              soundCheckPlayer.pause();
              setIsComplete(true);
            }}
          >
            <Text
              className={`text-lg ${
                canCompleteSoundTest ? "text-white" : "text-ink-disabled"
              }`}
            >
              잘 들려요
            </Text>
          </Pressable>
        )}
      </View>
    </DeviceTestLayout>
  );
}
