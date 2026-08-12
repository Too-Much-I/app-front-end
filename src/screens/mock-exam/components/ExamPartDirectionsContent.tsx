import { MaterialCommunityIcons } from "@expo/vector-icons";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { PLAYBACK_AUDIO_MODE } from "@/features/exam/answer-audio";
import {
  getExamPartDirectionAudioSource,
  type ExamPartDirections,
} from "@/features/exam/part-directions";
import { colors } from "@/theme";
import { reportOperationalError } from "@/lib/operational-error-reporting";

interface ExamPartDirectionsContentProps {
  directions: ExamPartDirections;
  isActive: boolean;
  partNumber: number;
  onComplete: () => void;
}

export function ExamPartDirectionsContent({
  directions,
  isActive,
  partNumber,
  onComplete,
}: ExamPartDirectionsContentProps) {
  const audioSource = getExamPartDirectionAudioSource(partNumber);
  const player = useAudioPlayer(audioSource ?? null, { updateInterval: 100 });
  const playbackStatus = useAudioPlayerStatus(player);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);
  const hasCompletedRef = useRef(false);
  const hasStartedRef = useRef(false);
  const hasObservedPlayingRef = useRef(false);
  const shouldRestartRef = useRef(false);
  const isActiveRef = useRef(isActive);
  const hasReportedPlaybackFailureRef = useRef(false);
  const hasFinished =
    playbackStatus.didJustFinish ||
    (playbackStatus.duration > 0 && playbackStatus.currentTime >= playbackStatus.duration);
  const cannotPlay = audioSource === undefined || hasPlaybackError || playbackStatus.error !== null;

  const completeDirections = useCallback(() => {
    if (!isActiveRef.current || hasCompletedRef.current) return;

    hasCompletedRef.current = true;
    player.pause();
    onComplete();
  }, [onComplete, player]);

  const markPlaybackFailure = useCallback(
    (reason: "missing" | "playback" | "media-reset") => {
      if (!isActiveRef.current || hasReportedPlaybackFailureRef.current) return;
      hasReportedPlaybackFailureRef.current = true;
      reportOperationalError({
        code: "EXAM_REQUIRED_AUDIO_FAILED",
        cueKind: "part-directions",
        reason,
        partNumber,
      });
    },
    [partNumber],
  );

  const playDirections = useCallback(async (isUserRetry = false) => {
    if (isUserRetry) hasReportedPlaybackFailureRef.current = false;
    if (audioSource === undefined) {
      markPlaybackFailure("missing");
      setHasPlaybackError(true);
      return;
    }
    if (!isActiveRef.current || hasCompletedRef.current) return;

    try {
      setHasPlaybackError(false);
      hasObservedPlayingRef.current = false;
      await setAudioModeAsync(PLAYBACK_AUDIO_MODE);
      if (!isActiveRef.current || hasCompletedRef.current) return;

      player.pause();

      if (player.currentTime > 0) {
        await player.seekTo(0);
      }

      player.play();
      hasStartedRef.current = true;
      shouldRestartRef.current = false;
    } catch (error) {
      console.error(`[ExamPartDirections] Part ${partNumber} 안내 음성 재생 실패`, error);
      markPlaybackFailure("playback");
      setHasPlaybackError(true);
    }
  }, [audioSource, markPlaybackFailure, partNumber, player]);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    if (!isActive) {
      player.pause();
      hasObservedPlayingRef.current = false;
      if (hasStartedRef.current && !hasCompletedRef.current) {
        shouldRestartRef.current = true;
      }
      return;
    }

    if (!hasStartedRef.current || shouldRestartRef.current) {
      void playDirections();
    }
  }, [isActive, playDirections, player]);

  useEffect(() => {
    if (playbackStatus.error === null && !playbackStatus.mediaServicesDidReset) return;
    markPlaybackFailure(playbackStatus.mediaServicesDidReset ? "media-reset" : "playback");
  }, [markPlaybackFailure, playbackStatus.error, playbackStatus.mediaServicesDidReset]);

  useEffect(() => {
    if (playbackStatus.playing && isActive) {
      hasObservedPlayingRef.current = true;
    }
  }, [isActive, playbackStatus.playing]);

  useEffect(() => {
    if (isActive && hasFinished && hasObservedPlayingRef.current && !cannotPlay) {
      completeDirections();
    }
  }, [cannotPlay, completeDirections, hasFinished, isActive]);

  return (
    <View className="flex-1 bg-surface-subtle">
      <ScrollView
        bounces={false}
        className="flex-1"
        contentContainerClassName="flex-grow justify-center px-6 py-8"
        showsVerticalScrollIndicator={false}
      >
        <View className="mx-auto w-full max-w-3xl items-center">
          <Text className="text-center text-2xl leading-8 text-exam-navy">
            {directions.title}
          </Text>

          <Text className="mt-5 w-full max-w-3xl text-center text-base leading-6 text-ink-muted">
            {directions.lines.join(" ")}
          </Text>
        </View>
      </ScrollView>

      {cannotPlay ? (
        <View className="items-center gap-3 border-t border-line bg-surface-subtle px-5 pb-5 pt-3">
          <View accessibilityLiveRegion="polite" className="flex-row items-center gap-2">
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={20}
              color={colors.exam.danger}
            />
            <Text className="text-sm text-exam-danger">안내 음성을 재생하지 못했어요</Text>
          </View>

          <View className="w-full flex-row gap-3">
            {audioSource !== undefined ? (
              <Pressable
                accessibilityRole="button"
                className="flex-1 items-center justify-center rounded-2xl border border-brand-300 bg-surface py-3.5"
                onPress={() => {
                  void playDirections(true);
                }}
              >
                <Text className="text-base text-brand-text">다시 재생하기</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              className="flex-1 items-center justify-center rounded-2xl bg-brand-cta py-3.5"
              onPress={completeDirections}
            >
              <Text className="text-base text-white">문제로 이동하기</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}
