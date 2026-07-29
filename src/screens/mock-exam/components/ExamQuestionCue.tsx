import { MaterialCommunityIcons } from "@expo/vector-icons";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { PLAYBACK_AUDIO_MODE } from "@/features/exam/answer-audio";
import { getQuestionAudioSource } from "@/features/exam/question-audio";
import { colors } from "@/theme";

interface ExamQuestionCueProps {
  audioUrl: string;
  isActive: boolean;
  /** 재생 횟수. Part 4 마지막 문항만 2회다. */
  playCount: number;
  onComplete: () => void;
  onExit: () => void;
}

export function ExamQuestionCue({
  audioUrl,
  isActive,
  playCount,
  onComplete,
  onExit,
}: ExamQuestionCueProps) {
  const audioSource = useMemo(() => getQuestionAudioSource(audioUrl), [audioUrl]);
  const player = useAudioPlayer(audioSource ?? null, { updateInterval: 100 });
  const playbackStatus = useAudioPlayerStatus(player);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);
  const [playedCount, setPlayedCount] = useState(0);
  const hasCompletedRef = useRef(false);
  const hasStartedRef = useRef(false);
  const shouldRestartRef = useRef(false);
  const hasObservedPlayingRef = useRef(false);
  const isActiveRef = useRef(isActive);

  const playFromStart = useCallback(
    async (reloadSource = false) => {
      if (!audioSource || !isActiveRef.current || hasCompletedRef.current) {
        if (!audioSource) setHasPlaybackError(true);
        return;
      }

      try {
        hasObservedPlayingRef.current = false;
        await setAudioModeAsync(PLAYBACK_AUDIO_MODE);
        if (!isActiveRef.current || hasCompletedRef.current) return;
        player.pause();
        if (reloadSource) {
          player.replace(audioSource);
        } else if (player.currentTime > 0) {
          await player.seekTo(0);
        }
        setPlayedCount(0);
        player.play();
        setHasPlaybackError(false);
        hasStartedRef.current = true;
        shouldRestartRef.current = false;
      } catch (error) {
        console.error("[ExamQuestionCue] 문제 음성 재생 실패", error);
        setHasPlaybackError(true);
      }
    },
    [audioSource, player],
  );

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
      void playFromStart();
    }
  }, [isActive, playFromStart, player]);

  useEffect(() => {
    if (playbackStatus.playing && isActive) {
      hasObservedPlayingRef.current = true;
    }
  }, [isActive, playbackStatus.playing]);

  useEffect(() => {
    if (playbackStatus.error === null && !playbackStatus.mediaServicesDidReset) return;
    player.pause();
    hasObservedPlayingRef.current = false;
    shouldRestartRef.current = true;
    setHasPlaybackError(true);
  }, [playbackStatus.error, playbackStatus.mediaServicesDidReset, player]);

  const hasFinished =
    playbackStatus.didJustFinish ||
    (playbackStatus.duration > 0 && playbackStatus.currentTime >= playbackStatus.duration);

  useEffect(() => {
    if (
      !isActive ||
      !hasFinished ||
      !hasObservedPlayingRef.current ||
      hasPlaybackError ||
      hasCompletedRef.current
    ) {
      return;
    }

    // 재생이 관측된 뒤에만 한 회차로 센다. 여기서 내려두면 다음 회차가 실제로
    // 재생되기 전까지 이 effect가 다시 진입하지 못해 중복 집계가 막힌다.
    hasObservedPlayingRef.current = false;
    const nextPlayedCount = playedCount + 1;
    setPlayedCount(nextPlayedCount);

    if (nextPlayedCount >= playCount) {
      hasCompletedRef.current = true;
      player.pause();
      onComplete();
      return;
    }

    void (async () => {
      try {
        await player.seekTo(0);
        if (!isActiveRef.current || hasCompletedRef.current) return;
        player.play();
      } catch (error) {
        console.error("[ExamQuestionCue] 문제 음성 반복 재생 실패", error);
        setHasPlaybackError(true);
      }
    })();
  }, [
    hasFinished,
    hasPlaybackError,
    isActive,
    onComplete,
    playCount,
    playedCount,
    player,
  ]);

  if (hasPlaybackError) {
    return (
      <View className="w-full gap-3 rounded-2xl border border-exam-dangerLine bg-surface p-4">
        <View
          accessibilityLiveRegion="assertive"
          className="flex-row items-center justify-center gap-2"
        >
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={20}
            color={colors.exam.danger}
          />
          <Text className="text-sm text-exam-danger">문제 음성을 재생하지 못했어요</Text>
        </View>
        <View className="flex-row gap-3">
          <Pressable
            accessibilityRole="button"
            className="flex-1 items-center rounded-2xl border border-brand-300 bg-surface py-3"
            onPress={() => {
              void playFromStart(true);
            }}
          >
            <Text className="text-sm text-brand-text">처음부터 다시 듣기</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            className="flex-1 items-center rounded-2xl bg-brand-cta py-3"
            onPress={onExit}
          >
            <Text className="text-sm text-white">시험 나가기</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View accessibilityLiveRegion="polite" className="flex-row items-center gap-2 py-1">
      <MaterialCommunityIcons name="volume-high" size={20} color={colors.brand.text} />
      <Text className="text-sm text-brand-text">
        {playCount > 1
          ? `문제 음성을 듣고 있어요 (${Math.min(playedCount + 1, playCount)}/${playCount})`
          : "문제 음성을 듣고 있어요"}
      </Text>
    </View>
  );
}
