import { MaterialCommunityIcons } from "@expo/vector-icons";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { PLAYBACK_AUDIO_MODE } from "@/features/exam/answer-audio";
import { getExamPartIntroAudioSource } from "@/features/exam/part-prelude";
import { colors } from "@/theme";
import type { ExamPartIntroPrelude } from "@/types/exam";

interface ExamPartIntroContentProps {
  isActive: boolean;
  prelude: ExamPartIntroPrelude;
  onComplete: () => void;
  onExit: () => void;
}

export function ExamPartIntroContent({
  isActive,
  prelude,
  onComplete,
  onExit,
}: ExamPartIntroContentProps) {
  const audioSource = useMemo(
    () => getExamPartIntroAudioSource(prelude.guideAudioUrl),
    [prelude.guideAudioUrl],
  );
  const player = useAudioPlayer(audioSource ?? null, { updateInterval: 100 });
  const playbackStatus = useAudioPlayerStatus(player);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);
  const hasCompletedRef = useRef(false);
  const hasStartedRef = useRef(false);
  const shouldRestartRef = useRef(false);
  const hasObservedPlayingRef = useRef(false);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

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
        player.play();
        setHasPlaybackError(false);
        hasStartedRef.current = true;
        shouldRestartRef.current = false;
      } catch (error) {
        console.error("[ExamPartIntro] 안내 음성 재생 실패", error);
        setHasPlaybackError(true);
      }
    },
    [audioSource, player],
  );

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

    hasCompletedRef.current = true;
    player.pause();
    onComplete();
  }, [hasFinished, hasPlaybackError, isActive, onComplete, player]);

  return (
    <View className="flex-1 bg-surface">
      <ScrollView
        bounces={false}
        className="flex-1"
        contentContainerClassName="flex-grow justify-center px-6 py-8"
        showsVerticalScrollIndicator={false}
      >
        <View className="mx-auto w-full max-w-3xl rounded-2xl border border-line bg-surface p-6">
          <Text className="text-center text-xl leading-8 text-exam-navy">
            {prelude.text}
          </Text>
          {!hasPlaybackError ? (
            <View
              accessibilityLiveRegion="polite"
              className="mt-6 flex-row items-center justify-center gap-2"
            >
              <MaterialCommunityIcons name="volume-high" size={20} color={colors.brand.text} />
              <Text className="text-sm text-brand-text">안내 음성을 듣고 있어요</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {hasPlaybackError ? (
        <View className="gap-3 border-t border-line bg-surface px-5 pb-5 pt-4">
          <View
            accessibilityLiveRegion="assertive"
            className="flex-row items-center justify-center gap-2"
          >
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={20}
              color={colors.exam.danger}
            />
            <Text className="text-sm text-exam-danger">안내 음성을 재생하지 못했어요</Text>
          </View>
          <View className="flex-row gap-3">
            <Pressable
              accessibilityRole="button"
              className="flex-1 items-center rounded-2xl border border-brand-300 bg-surface py-3.5"
              onPress={() => {
                void playFromStart(true);
              }}
            >
              <Text className="text-base text-brand-text">처음부터 다시 듣기</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              className="flex-1 items-center rounded-2xl bg-brand-cta py-3.5"
              onPress={onExit}
            >
              <Text className="text-base text-white">시험 나가기</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}
