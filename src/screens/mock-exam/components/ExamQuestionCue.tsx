import { MaterialCommunityIcons } from "@expo/vector-icons";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { PLAYBACK_AUDIO_MODE } from "@/features/exam/answer-audio";
import { getExamListenAgainCueSource } from "@/features/exam/exam-cue";
import { getQuestionAudioSource } from "@/features/exam/question-audio";
import { colors } from "@/theme";
import { reportOperationalError } from "@/lib/operational-error-reporting";

interface ExamQuestionCueProps {
  audioUrl: string;
  isActive: boolean;
  partNumber: number;
  questionNumber: number;
  /** 재생 횟수. Part 4 마지막 문항만 2회다. */
  playCount: number;
  onComplete: () => void;
  onExit: () => void;
}

/**
 * `question`은 문제 음성을, `listen-again`은 회차 사이에 끼는 "Now listen again."
 * 안내를 재생하는 단계다. 안내는 반복이 남아 있을 때만 거치므로 1회 재생 문항은
 * `question` 단계에서 끝난다.
 */
type QuestionCueStage = "question" | "listen-again";

/**
 * 문제 음성이 재생 중이 아닌 채로 이만큼 머무르면 멈춘 것으로 본다.
 * 판단 근거는 `ExamPhaseCue`의 같은 상수에 적어 두었다.
 */
const CUE_STALL_TIMEOUT_MS = 10_000;

function hasFinished(status: ReturnType<typeof useAudioPlayerStatus>): boolean {
  return (
    status.didJustFinish ||
    (status.duration > 0 && status.currentTime >= status.duration)
  );
}

export function ExamQuestionCue({
  audioUrl,
  isActive,
  partNumber,
  playCount,
  questionNumber,
  onComplete,
  onExit,
}: ExamQuestionCueProps) {
  const audioSource = useMemo(() => getQuestionAudioSource(audioUrl), [audioUrl]);
  const listenAgainSource = useMemo(() => getExamListenAgainCueSource(), []);
  const player = useAudioPlayer(audioSource ?? null, {
    updateInterval: 100,
    keepAudioSessionActive: true,
  });
  const listenAgainPlayer = useAudioPlayer(listenAgainSource, {
    updateInterval: 50,
    keepAudioSessionActive: true,
  });
  const playbackStatus = useAudioPlayerStatus(player);
  const listenAgainStatus = useAudioPlayerStatus(listenAgainPlayer);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);
  const [playedCount, setPlayedCount] = useState(0);
  const [stage, setStage] = useState<QuestionCueStage>("question");
  const hasCompletedRef = useRef(false);
  const hasStartedRef = useRef(false);
  const shouldRestartRef = useRef(false);
  const hasObservedPlayingRef = useRef(false);
  const isActiveRef = useRef(isActive);
  // 단계 전환은 effect 안에서 즉시 읽어야 해서 ref로도 들고 있는다. 화면 문구는
  // state를 봐야 갱신되므로 둘을 항상 같이 바꾼다.
  const stageRef = useRef<QuestionCueStage>("question");
  const hasReportedPlaybackFailureRef = useRef(false);
  const enterStage = useCallback((next: QuestionCueStage) => {
    stageRef.current = next;
    setStage(next);
  }, []);

  const markPlaybackFailure = useCallback(
    (reason: "missing" | "playback" | "timeout" | "media-reset") => {
      if (!isActiveRef.current || hasReportedPlaybackFailureRef.current) return;
      hasReportedPlaybackFailureRef.current = true;
      reportOperationalError({
        code: "EXAM_REQUIRED_AUDIO_FAILED",
        cueKind: "question",
        reason,
        partNumber,
        questionNumber,
      });
    },
    [partNumber, questionNumber],
  );

  const playFromStart = useCallback(
    async (reloadSource = false) => {
      if (reloadSource) hasReportedPlaybackFailureRef.current = false;
      if (!audioSource || !isActiveRef.current || hasCompletedRef.current) {
        if (!audioSource) {
          markPlaybackFailure("missing");
          setHasPlaybackError(true);
        }
        return;
      }

      try {
        hasObservedPlayingRef.current = false;
        await setAudioModeAsync(PLAYBACK_AUDIO_MODE);
        if (!isActiveRef.current || hasCompletedRef.current) return;
        player.pause();
        listenAgainPlayer.pause();
        if (reloadSource) {
          player.replace(audioSource);
          listenAgainPlayer.replace(listenAgainSource);
        } else {
          if (player.currentTime > 0) await player.seekTo(0);
          if (listenAgainPlayer.currentTime > 0) await listenAgainPlayer.seekTo(0);
        }
        // 재시작은 항상 1회차 문제 음성부터다. 안내만 다시 듣는 진입점은 없다.
        setPlayedCount(0);
        enterStage("question");
        player.play();
        setHasPlaybackError(false);
        hasStartedRef.current = true;
        shouldRestartRef.current = false;
      } catch (error) {
        console.error("[ExamQuestionCue] 문제 음성 재생 실패", error);
        markPlaybackFailure("playback");
        setHasPlaybackError(true);
      }
    },
    [audioSource, enterStage, listenAgainPlayer, listenAgainSource, markPlaybackFailure, player],
  );

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    if (!isActive) {
      player.pause();
      listenAgainPlayer.pause();
      hasObservedPlayingRef.current = false;
      if (hasStartedRef.current && !hasCompletedRef.current) {
        shouldRestartRef.current = true;
      }
      return;
    }

    if (!hasStartedRef.current || shouldRestartRef.current) {
      void playFromStart();
    }
  }, [isActive, listenAgainPlayer, playFromStart, player]);

  useEffect(() => {
    const isCurrentPlayerPlaying =
      stageRef.current === "listen-again" ? listenAgainStatus.playing : playbackStatus.playing;
    if (isCurrentPlayerPlaying && isActive) {
      hasObservedPlayingRef.current = true;
    }
  }, [isActive, listenAgainStatus.playing, playbackStatus.playing]);

  // 재생 중이 아닌 동안에만 시한을 건다. 재생이 진행되면 status 갱신마다 이 effect가
  // 다시 돌며 시한이 걷힌다. 완료에 닿지 못한 채 시한이 끝나면 멈춘 것이다.
  useEffect(() => {
    if (!isActive || hasPlaybackError || hasCompletedRef.current) return;
    const isCurrentPlayerPlaying =
      stageRef.current === "listen-again" ? listenAgainStatus.playing : playbackStatus.playing;
    if (isCurrentPlayerPlaying) return;

    const timeoutId = setTimeout(() => {
      if (!isActiveRef.current || hasCompletedRef.current) return;
      player.pause();
      listenAgainPlayer.pause();
      hasObservedPlayingRef.current = false;
      shouldRestartRef.current = true;
      console.error("[ExamQuestionCue] 문제 음성이 시간 안에 끝나지 않음");
      markPlaybackFailure("timeout");
      setHasPlaybackError(true);
    }, CUE_STALL_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [
    hasPlaybackError,
    isActive,
    listenAgainPlayer,
    listenAgainStatus.playing,
    markPlaybackFailure,
    playbackStatus.playing,
    player,
  ]);

  // 두 플레이어를 단계와 무관하게 함께 본다. 안내 오디오가 문제 음성 재생 중에
  // 깨지면 그 시점엔 `listen-again` 단계가 아니라, 단계로 필터링하면 오류를 놓친
  // 채 안내 차례에 재생이 멈춰버린다.
  useEffect(() => {
    const hasFailed = (status: ReturnType<typeof useAudioPlayerStatus>) =>
      status.error !== null || status.mediaServicesDidReset;
    if (!hasFailed(playbackStatus) && !hasFailed(listenAgainStatus)) return;
    player.pause();
    listenAgainPlayer.pause();
    hasObservedPlayingRef.current = false;
    shouldRestartRef.current = true;
    markPlaybackFailure(
      playbackStatus.mediaServicesDidReset || listenAgainStatus.mediaServicesDidReset
        ? "media-reset"
        : "playback",
    );
    setHasPlaybackError(true);
  }, [listenAgainPlayer, listenAgainStatus, markPlaybackFailure, playbackStatus, player]);

  // 문제 음성 한 회차가 끝났다. 남은 회차가 있으면 "Now listen again." 안내를 거친다.
  useEffect(() => {
    if (
      stageRef.current !== "question" ||
      !isActive ||
      !hasFinished(playbackStatus) ||
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

    enterStage("listen-again");
    player.pause();
    void (async () => {
      try {
        if (listenAgainPlayer.currentTime > 0) await listenAgainPlayer.seekTo(0);
        if (!isActiveRef.current || stageRef.current !== "listen-again") return;
        listenAgainPlayer.play();
      } catch (error) {
        console.error("[ExamQuestionCue] 다시 듣기 안내 재생 실패", error);
        markPlaybackFailure("playback");
        setHasPlaybackError(true);
      }
    })();
  }, [
    enterStage,
    hasPlaybackError,
    isActive,
    listenAgainPlayer,
    onComplete,
    playCount,
    playbackStatus,
    playedCount,
    player,
    markPlaybackFailure,
  ]);

  // 안내가 끝났다. 문제 음성 다음 회차를 처음부터 다시 재생한다.
  useEffect(() => {
    if (
      stageRef.current !== "listen-again" ||
      !isActive ||
      !hasFinished(listenAgainStatus) ||
      !hasObservedPlayingRef.current ||
      hasPlaybackError ||
      hasCompletedRef.current
    ) {
      return;
    }

    hasObservedPlayingRef.current = false;
    enterStage("question");
    listenAgainPlayer.pause();
    void (async () => {
      try {
        await player.seekTo(0);
        if (!isActiveRef.current || hasCompletedRef.current) return;
        player.play();
      } catch (error) {
        console.error("[ExamQuestionCue] 문제 음성 반복 재생 실패", error);
        markPlaybackFailure("playback");
        setHasPlaybackError(true);
      }
    })();
  }, [
    enterStage,
    hasPlaybackError,
    isActive,
    listenAgainPlayer,
    listenAgainStatus,
    markPlaybackFailure,
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
        {stage === "listen-again"
          ? "다시 듣기 안내를 재생하고 있어요"
          : playCount > 1
            ? `문제 음성을 듣고 있어요 (${Math.min(playedCount + 1, playCount)}/${playCount})`
            : "문제 음성을 듣고 있어요"}
      </Text>
    </View>
  );
}
