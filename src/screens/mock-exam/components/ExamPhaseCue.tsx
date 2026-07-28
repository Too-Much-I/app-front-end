import { MaterialCommunityIcons } from "@expo/vector-icons";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { PLAYBACK_AUDIO_MODE } from "@/features/exam/answer-audio";
import {
  getExamCueAudioSource,
  getExamCueBeepSource,
  type ExamCueKind,
} from "@/features/exam/exam-cue";
import { colors } from "@/theme";

interface ExamPhaseCueProps {
  cueKind: ExamCueKind;
  isActive: boolean;
  onComplete: () => void;
  onExit: () => void;
}

type CuePlaybackStage = "idle" | "cue" | "beep" | "completed";

const CUE_LABELS: Record<ExamCueKind, string> = {
  preparing: "준비 시작 안내를 재생하고 있어요",
  "reading-aloud": "읽기 시작 안내를 재생하고 있어요",
  responding: "응답 시작 안내를 재생하고 있어요",
  speaking: "말하기 시작 안내를 재생하고 있어요",
};

function hasFinished(status: ReturnType<typeof useAudioPlayerStatus>): boolean {
  return (
    status.didJustFinish ||
    (status.duration > 0 && status.currentTime >= status.duration)
  );
}

export function ExamPhaseCue({
  cueKind,
  isActive,
  onComplete,
  onExit,
}: ExamPhaseCueProps) {
  const cueSource = useMemo(() => getExamCueAudioSource(cueKind), [cueKind]);
  const beepSource = useMemo(() => getExamCueBeepSource(), []);
  const cuePlayer = useAudioPlayer(cueSource, { updateInterval: 50 });
  const beepPlayer = useAudioPlayer(beepSource, { updateInterval: 50 });
  const cueStatus = useAudioPlayerStatus(cuePlayer);
  const beepStatus = useAudioPlayerStatus(beepPlayer);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);
  const stageRef = useRef<CuePlaybackStage>("idle");
  const hasObservedPlayingRef = useRef(false);
  const shouldRestartRef = useRef(false);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  const hasCompleted = useCallback(() => stageRef.current === "completed", []);

  const playFromStart = useCallback(async (reloadSources = false) => {
    if (!isActiveRef.current || hasCompleted()) return;

    try {
      cuePlayer.pause();
      beepPlayer.pause();
      await setAudioModeAsync(PLAYBACK_AUDIO_MODE);
      if (!isActiveRef.current || hasCompleted()) return;

      if (reloadSources) {
        cuePlayer.replace(cueSource);
        beepPlayer.replace(beepSource);
      } else {
        if (cuePlayer.currentTime > 0) await cuePlayer.seekTo(0);
        if (beepPlayer.currentTime > 0) await beepPlayer.seekTo(0);
      }
      stageRef.current = "beep";
      hasObservedPlayingRef.current = false;
      shouldRestartRef.current = false;
      setHasPlaybackError(false);
      beepPlayer.play();
    } catch (error) {
      console.error(`[ExamPhaseCue] ${cueKind} 안내 음성 재생 실패`, error);
      setHasPlaybackError(true);
    }
  }, [beepPlayer, beepSource, cueKind, cuePlayer, cueSource, hasCompleted]);

  useEffect(() => {
    if (!isActive) {
      cuePlayer.pause();
      beepPlayer.pause();
      hasObservedPlayingRef.current = false;
      if (stageRef.current === "cue" || stageRef.current === "beep") {
        shouldRestartRef.current = true;
      }
      return;
    }

    if (stageRef.current === "idle" || shouldRestartRef.current) {
      void playFromStart();
    }
  }, [beepPlayer, cuePlayer, isActive, playFromStart]);

  useEffect(() => {
    const isCurrentPlayerPlaying =
      (stageRef.current === "cue" && cueStatus.playing) ||
      (stageRef.current === "beep" && beepStatus.playing);
    if (isCurrentPlayerPlaying && isActive) hasObservedPlayingRef.current = true;
  }, [beepStatus.playing, cueStatus.playing, isActive]);

  useEffect(() => {
    const currentStatus = stageRef.current === "beep" ? beepStatus : cueStatus;
    if (currentStatus.error === null && !currentStatus.mediaServicesDidReset) return;

    cuePlayer.pause();
    beepPlayer.pause();
    hasObservedPlayingRef.current = false;
    shouldRestartRef.current = true;
    setHasPlaybackError(true);
  }, [beepPlayer, beepStatus, cuePlayer, cueStatus]);

  useEffect(() => {
    if (
      stageRef.current !== "beep" ||
      !isActive ||
      hasPlaybackError ||
      !hasObservedPlayingRef.current ||
      !hasFinished(beepStatus)
    ) {
      return;
    }

    stageRef.current = "cue";
    hasObservedPlayingRef.current = false;
    beepPlayer.pause();
    void (async () => {
      try {
        if (cuePlayer.currentTime > 0) await cuePlayer.seekTo(0);
        if (!isActiveRef.current || stageRef.current !== "cue") return;
        cuePlayer.play();
      } catch (error) {
        console.error(`[ExamPhaseCue] ${cueKind} 안내 음성 재생 실패`, error);
        setHasPlaybackError(true);
      }
    })();
  }, [beepPlayer, beepStatus, cueKind, cuePlayer, hasPlaybackError, isActive]);

  useEffect(() => {
    if (
      stageRef.current !== "cue" ||
      !isActive ||
      hasPlaybackError ||
      !hasObservedPlayingRef.current ||
      !hasFinished(cueStatus)
    ) {
      return;
    }

    stageRef.current = "completed";
    hasObservedPlayingRef.current = false;
    cuePlayer.pause();
    onComplete();
  }, [cuePlayer, cueStatus, hasPlaybackError, isActive, onComplete]);

  if (hasPlaybackError) {
    return (
      <View className="w-full gap-3 rounded-2xl border border-exam-dangerLine bg-surface p-4">
        <View accessibilityLiveRegion="assertive" className="flex-row items-center justify-center gap-2">
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={20}
            color={colors.exam.danger}
          />
          <Text className="text-sm text-exam-danger">시작 안내 음성을 재생하지 못했어요</Text>
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
        {stageRef.current === "beep" ? "시작 알림음을 재생하고 있어요" : CUE_LABELS[cueKind]}
      </Text>
    </View>
  );
}
