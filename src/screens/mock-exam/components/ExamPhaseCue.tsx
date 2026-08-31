import { MaterialCommunityIcons } from "@expo/vector-icons";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { PLAYBACK_AUDIO_MODE } from "@/features/audio/audio-session";
import {
  getExamCueAudioSource,
  getExamCueBeepSource,
  type ExamCueKind,
} from "@/features/exam/exam-cue";
import { colors } from "@/theme";
import { reportOperationalError } from "@/lib/operational-error-reporting";

interface ExamPhaseCueProps {
  cueKind: ExamCueKind;
  isActive: boolean;
  partNumber: number;
  questionNumber: number;
  onComplete: () => void;
  onExit: () => void;
}

type CuePlaybackStage = "idle" | "cue" | "beep" | "completed";

/**
 * 안내 음성이 재생 중이 아닌 채로 이만큼 머무르면 멈춘 것으로 본다.
 *
 * 완료 판정은 `hasObservedPlayingRef`(재생을 봤다)와 status의 종료 신호가 함께
 * 성립해야 하는데, 둘 중 하나를 놓치면 status 갱신이 끊겨 effect가 다시 실행되지
 * 않는다. 그때 화면은 준비 단계로 넘어가지 못하고 타이머가 멈춘 것처럼 보이면서도
 * 예외가 없어 아무것도 보고되지 않는다. 이 워치독이 그 침묵을 깬다.
 */
const CUE_STALL_TIMEOUT_MS = 10_000;

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
  partNumber,
  questionNumber,
  onComplete,
  onExit,
}: ExamPhaseCueProps) {
  const cueSource = useMemo(() => getExamCueAudioSource(cueKind), [cueKind]);
  const beepSource = useMemo(() => getExamCueBeepSource(), []);
  const cuePlayer = useAudioPlayer(cueSource, {
    updateInterval: 50,
    keepAudioSessionActive: true,
  });
  const beepPlayer = useAudioPlayer(beepSource, {
    updateInterval: 50,
    keepAudioSessionActive: true,
  });
  const cueStatus = useAudioPlayerStatus(cuePlayer);
  const beepStatus = useAudioPlayerStatus(beepPlayer);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);
  const stageRef = useRef<CuePlaybackStage>("idle");
  const hasObservedPlayingRef = useRef(false);
  const shouldRestartRef = useRef(false);
  const isActiveRef = useRef(isActive);
  const hasReportedPlaybackFailureRef = useRef(false);
  const hasCompleted = useCallback(() => stageRef.current === "completed", []);

  const markPlaybackFailure = useCallback(
    (reason: "playback" | "timeout" | "media-reset") => {
      if (!isActiveRef.current || hasReportedPlaybackFailureRef.current) return;
      hasReportedPlaybackFailureRef.current = true;
      reportOperationalError({
        code: "EXAM_REQUIRED_AUDIO_FAILED",
        cueKind: "phase",
        reason,
        partNumber,
        questionNumber,
      });
    },
    [partNumber, questionNumber],
  );

  const playFromStart = useCallback(async (reloadSources = false) => {
    if (reloadSources) hasReportedPlaybackFailureRef.current = false;
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
      markPlaybackFailure("playback");
      setHasPlaybackError(true);
    }
  }, [beepPlayer, beepSource, cueKind, cuePlayer, cueSource, hasCompleted, markPlaybackFailure]);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

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

  // 재생 중이 아닌 동안에만 시한을 건다. 재생이 진행되면 status 갱신마다 이 effect가
  // 다시 돌며 시한이 걷힌다. `completed`에 닿지 못한 채 시한이 끝나면 멈춘 것이다.
  useEffect(() => {
    if (!isActive || hasPlaybackError || hasCompleted()) return;
    const isCurrentPlayerPlaying =
      (stageRef.current === "cue" && cueStatus.playing) ||
      (stageRef.current === "beep" && beepStatus.playing);
    if (isCurrentPlayerPlaying) return;

    const timeoutId = setTimeout(() => {
      if (!isActiveRef.current || hasCompleted()) return;
      cuePlayer.pause();
      beepPlayer.pause();
      hasObservedPlayingRef.current = false;
      shouldRestartRef.current = true;
      console.error(`[ExamPhaseCue] ${cueKind} 안내 음성이 시간 안에 끝나지 않음`);
      markPlaybackFailure("timeout");
      setHasPlaybackError(true);
    }, CUE_STALL_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [
    beepPlayer,
    beepStatus.playing,
    cueKind,
    cuePlayer,
    cueStatus.playing,
    hasCompleted,
    hasPlaybackError,
    isActive,
    markPlaybackFailure,
  ]);

  useEffect(() => {
    const currentStatus = stageRef.current === "beep" ? beepStatus : cueStatus;
    if (currentStatus.error === null && !currentStatus.mediaServicesDidReset) return;

    cuePlayer.pause();
    beepPlayer.pause();
    hasObservedPlayingRef.current = false;
    shouldRestartRef.current = true;
    markPlaybackFailure(
      currentStatus.mediaServicesDidReset ? "media-reset" : "playback",
    );
    setHasPlaybackError(true);
  }, [beepPlayer, beepStatus, cuePlayer, cueStatus, markPlaybackFailure]);

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
        markPlaybackFailure("playback");
        setHasPlaybackError(true);
      }
    })();
  }, [beepPlayer, beepStatus, cueKind, cuePlayer, hasPlaybackError, isActive, markPlaybackFailure]);

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
