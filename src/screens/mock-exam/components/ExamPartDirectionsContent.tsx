import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { ExamAudioErrorNotice } from "@/screens/mock-exam/components/ExamAudioErrorNotice";
import { PLAYBACK_AUDIO_MODE } from "@/features/audio/audio-session";
import {
  getExamPartDirectionAudioSource,
  type ExamPartDirections,
} from "@/features/exam/part-directions";
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
  const player = useAudioPlayer(audioSource ?? null, {
    updateInterval: 100,
    keepAudioSessionActive: true,
  });
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
        <ExamAudioErrorNotice
          className="bg-surface-subtle"
          exitLabel="문제로 이동하기"
          message="안내 음성을 재생하지 못했어요"
          placement="footer"
          retryLabel="다시 재생하기"
          onExit={completeDirections}
          // 재생할 음원 자체가 없으면 재시도가 성립하지 않는다.
          onRetry={
            audioSource === undefined
              ? undefined
              : () => {
                  void playDirections(true);
                }
          }
        />
      ) : null}
    </View>
  );
}
