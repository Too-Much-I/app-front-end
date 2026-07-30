import { useFocusEffect } from "@react-navigation/native";
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import {
  ANSWER_RECORDING_OPTIONS,
  AUDIO_METER_UPDATE_INTERVAL_MS,
  PLAYBACK_AUDIO_MODE,
  RECORDING_AUDIO_MODE,
} from "@/features/exam/answer-audio";

export type MicrophoneTestState =
  | "idle"
  | "requesting"
  | "recording"
  | "paused"
  | "complete"
  | "denied"
  | "interrupted"
  | "error";

type AudioStopTrigger =
  | "recording-finished"
  | "navigation-blur"
  | "app-background"
  | "screen-leave"
  | "test-reset"
  | "start-cancelled"
  | "start-error"
  | "resume-error";

interface AudioStopResult {
  audioUri: string | null;
  hasError: boolean;
}

const TEST_DURATION_SECONDS = 3;
const TEST_DURATION_MS = TEST_DURATION_SECONDS * 1_000;
export function useMicrophoneTest() {
  const recorder = useAudioRecorder(ANSWER_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, AUDIO_METER_UPDATE_INTERVAL_MS);
  const recordingPlayer = useAudioPlayer(null, { updateInterval: 100 });
  const playbackStatus = useAudioPlayerStatus(recordingPlayer);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopPromiseRef = useRef<Promise<AudioStopResult> | null>(null);
  const startAttemptRef = useRef(0);
  const isMountedRef = useRef(true);
  const isScreenFocusedRef = useRef(false);
  const isAppBackgroundedRef = useRef(AppState.currentState === "background");
  const ownsRecordingAudioModeRef = useRef(false);
  const hasOpenRecordingRef = useRef(false);
  const testStateRef = useRef<MicrophoneTestState>("idle");
  const [testState, setTestState] = useState<MicrophoneTestState>("idle");
  const [canAskPermissionAgain, setCanAskPermissionAgain] = useState(true);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);

  const isComplete = testState === "complete";
  const isRecording = testState === "recording";
  const isBusy =
    testState === "requesting" || testState === "recording" || testState === "paused";

  const updateTestState = useCallback((nextState: MicrophoneTestState) => {
    testStateRef.current = nextState;
    if (isMountedRef.current) setTestState(nextState);
  }, []);

  const clearRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current === null) return;

    clearTimeout(recordingTimerRef.current);
    recordingTimerRef.current = null;
  }, []);

  /**
   * blur와 시작 취소가 연달아 발생해도 네이티브 stop은 한 번만 실행한다.
   * 두 번째 호출부터는 stopPromiseRef에 들어 있는 같은 결과를 기다린다.
   */
  const stopActiveAudio = useCallback(
    (trigger: AudioStopTrigger): Promise<AudioStopResult> => {
      startAttemptRef.current += 1;
      clearRecordingTimer();

      const activeStopPromise = stopPromiseRef.current;
      if (activeStopPromise !== null) return activeStopPromise;

      const stopPromise = (async (): Promise<AudioStopResult> => {
        let hasError = false;

        try {
          recordingPlayer.pause();
        } catch (error) {
          hasError = true;
          console.error(`[MicrophoneTest] ${trigger}: 녹음 재생 정지 실패`, error);
        }

        try {
          if (recorder.isRecording || hasOpenRecordingRef.current) {
            try {
              await recorder.stop();
            } finally {
              hasOpenRecordingRef.current = false;
            }
          }
        } catch (error) {
          hasError = true;
          console.error(`[MicrophoneTest] ${trigger}: 녹음기 정지 실패`, error);
        }

        if (ownsRecordingAudioModeRef.current) {
          try {
            await setAudioModeAsync(PLAYBACK_AUDIO_MODE);
            ownsRecordingAudioModeRef.current = false;
          } catch (error) {
            hasError = true;
            console.error(`[MicrophoneTest] ${trigger}: 오디오 모드 복원 실패`, error);
          }
        }

        let audioUri: string | null = null;
        try {
          audioUri = recorder.uri;
        } catch (error) {
          hasError = true;
          console.error(`[MicrophoneTest] ${trigger}: 녹음 파일 URI 확인 실패`, error);
        }

        return { audioUri, hasError };
      })().catch((error: unknown) => {
        console.error(`[MicrophoneTest] ${trigger}: 오디오 정리 중 예상하지 못한 오류`, error);
        return { audioUri: null, hasError: true };
      });

      stopPromiseRef.current = stopPromise;
      void stopPromise.then(() => {
        if (stopPromiseRef.current === stopPromise) stopPromiseRef.current = null;
      });

      return stopPromise;
    },
    [clearRecordingTimer, recorder, recordingPlayer],
  );

  const isStartAttemptActive = useCallback((attempt: number) => {
    return (
      startAttemptRef.current === attempt &&
      isMountedRef.current &&
      isScreenFocusedRef.current &&
      !isAppBackgroundedRef.current
    );
  }, []);

  const cleanupCancelledStart = useCallback(async () => {
    const activeStopPromise = stopPromiseRef.current;
    if (activeStopPromise !== null) await activeStopPromise;

    // 앞선 cleanup보다 녹음 모드 전환이 늦게 끝났다면 한 번 더 복원해야 한다.
    if (
      ownsRecordingAudioModeRef.current ||
      recorder.isRecording ||
      hasOpenRecordingRef.current
    ) {
      await stopActiveAudio("start-cancelled");
    }
  }, [recorder, stopActiveAudio]);

  const interruptAndStop = useCallback(
    (trigger: AudioStopTrigger) => {
      const activeState = testStateRef.current;
      if (
        activeState === "requesting" ||
        activeState === "recording" ||
        activeState === "paused"
      ) {
        updateTestState("interrupted");
      }

      void stopActiveAudio(trigger);
    },
    [stopActiveAudio, updateTestState],
  );

  const finishRecording = useCallback(async () => {
    const { audioUri, hasError } = await stopActiveAudio("recording-finished");

    if (
      !isMountedRef.current ||
      !isScreenFocusedRef.current ||
      isAppBackgroundedRef.current
    ) {
      return;
    }

    if (hasError || audioUri === null) {
      updateTestState("error");
      return;
    }

    try {
      recordingPlayer.replace(audioUri);
      setRecordingUri(audioUri);
      updateTestState("complete");
    } catch (error) {
      console.error("[MicrophoneTest] 녹음 파일을 재생기에 연결하지 못했습니다.", error);
      updateTestState("error");
    }
  }, [recordingPlayer, stopActiveAudio, updateTestState]);

  const startRecording = useCallback(async () => {
    if (
      testStateRef.current === "requesting" ||
      testStateRef.current === "recording" ||
      testStateRef.current === "paused"
    ) {
      return;
    }
    if (!isScreenFocusedRef.current || isAppBackgroundedRef.current) return;

    const activeStopPromise = stopPromiseRef.current;
    if (activeStopPromise !== null) await activeStopPromise;
    if (!isScreenFocusedRef.current || isAppBackgroundedRef.current) return;

    const attempt = startAttemptRef.current + 1;
    startAttemptRef.current = attempt;
    updateTestState("requesting");

    try {
      recordingPlayer.pause();
      setRecordingUri(null);

      const permission = await requestRecordingPermissionsAsync();
      if (!isStartAttemptActive(attempt)) return;

      setCanAskPermissionAgain(permission.canAskAgain);
      if (!permission.granted) {
        updateTestState("denied");
        return;
      }

      ownsRecordingAudioModeRef.current = true;
      await setAudioModeAsync(RECORDING_AUDIO_MODE);
      // setAudioModeAsync를 기다리는 사이 cleanup이 먼저 복원했을 수 있으므로 소유권을 재확인한다.
      ownsRecordingAudioModeRef.current = true;
      if (!isStartAttemptActive(attempt)) {
        void cleanupCancelledStart();
        return;
      }

      await recorder.prepareToRecordAsync();
      if (!isStartAttemptActive(attempt)) {
        void cleanupCancelledStart();
        return;
      }

      recorder.record();
      hasOpenRecordingRef.current = true;
      updateTestState("recording");
      recordingTimerRef.current = setTimeout(() => {
        void finishRecording();
      }, TEST_DURATION_MS);
    } catch (error) {
      if (!isStartAttemptActive(attempt)) {
        void cleanupCancelledStart();
        return;
      }

      console.error("[MicrophoneTest] 녹음 시작 실패", error);
      updateTestState("error");
      void stopActiveAudio("start-error");
    }
  }, [
    cleanupCancelledStart,
    finishRecording,
    isStartAttemptActive,
    recorder,
    recordingPlayer,
    stopActiveAudio,
    updateTestState,
  ]);

  const resumePausedRecording = useCallback(async () => {
    try {
      // Expo가 foreground 진입 시 자동 재개하므로 검증하는 동안 다시 잠시 멈춘다.
      if (recorder.isRecording) recorder.pause();

      const permission = await getRecordingPermissionsAsync();
      if (
        !isMountedRef.current ||
        !isScreenFocusedRef.current ||
        isAppBackgroundedRef.current
      ) {
        return;
      }

      setCanAskPermissionAgain(permission.canAskAgain);
      if (!permission.granted) {
        updateTestState("denied");
        await stopActiveAudio("resume-error");
        return;
      }

      const recorderStatus = recorder.getStatus();
      if (
        !hasOpenRecordingRef.current ||
        !recorderStatus.canRecord ||
        recorderStatus.mediaServicesDidReset
      ) {
        updateTestState("interrupted");
        await stopActiveAudio("resume-error");
        return;
      }

      const remainingDurationMs = Math.max(
        0,
        TEST_DURATION_MS - recorderStatus.durationMillis,
      );
      if (remainingDurationMs === 0) {
        await finishRecording();
        return;
      }

      ownsRecordingAudioModeRef.current = true;
      await setAudioModeAsync(RECORDING_AUDIO_MODE);
      ownsRecordingAudioModeRef.current = true;

      if (!isScreenFocusedRef.current || isAppBackgroundedRef.current) {
        void cleanupCancelledStart();
        return;
      }

      if (!recorder.isRecording) recorder.record();
      updateTestState("recording");
      recordingTimerRef.current = setTimeout(() => {
        void finishRecording();
      }, remainingDurationMs);
    } catch (error) {
      console.error("[MicrophoneTest] 백그라운드 복귀 후 녹음 재개 실패", error);
      updateTestState("interrupted");
      await stopActiveAudio("resume-error");
    }
  }, [cleanupCancelledStart, finishRecording, recorder, stopActiveAudio, updateTestState]);

  const refreshPermissionAfterBackground = useCallback(async () => {
    try {
      const permission = await getRecordingPermissionsAsync();
      if (
        !isMountedRef.current ||
        !isScreenFocusedRef.current ||
        isAppBackgroundedRef.current
      ) {
        return;
      }

      setCanAskPermissionAgain(permission.canAskAgain);
      if (permission.granted) updateTestState("idle");
    } catch (error) {
      console.error("[MicrophoneTest] 백그라운드 복귀 후 마이크 권한 확인 실패", error);
      updateTestState("error");
    }
  }, [updateTestState]);

  useFocusEffect(
    useCallback(() => {
      isScreenFocusedRef.current = true;

      return () => {
        isScreenFocusedRef.current = false;
        interruptAndStop("navigation-blur");
      };
    }, [interruptAndStop]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background") {
        isAppBackgroundedRef.current = true;
        if (!isScreenFocusedRef.current) return;

        const activeState = testStateRef.current;
        if (activeState === "recording") {
          clearRecordingTimer();
          updateTestState("paused");
          return;
        }

        if (activeState === "requesting") {
          interruptAndStop("app-background");
          return;
        }

        if (activeState === "complete") {
          try {
            recordingPlayer.pause();
          } catch (error) {
            console.error("[MicrophoneTest] 백그라운드 전환 중 재생 정지 실패", error);
          }
        }
        return;
      }

      if (nextState !== "active") return;

      isAppBackgroundedRef.current = false;
      if (!isScreenFocusedRef.current) return;

      const activeState = testStateRef.current;
      if (activeState === "paused") {
        void resumePausedRecording();
        return;
      }

      if (activeState === "denied") {
        void refreshPermissionAfterBackground();
        return;
      }

      // Expo의 foreground 자동 재생 대상이었더라도 테스트 음성은 사용자 입력 없이 재생하지 않는다.
      if (activeState === "complete") {
        try {
          recordingPlayer.pause();
        } catch (error) {
          console.error("[MicrophoneTest] foreground 복귀 후 재생 정지 실패", error);
        }
      }
    });

    return () => subscription.remove();
  }, [
    clearRecordingTimer,
    interruptAndStop,
    recordingPlayer,
    refreshPermissionAfterBackground,
    resumePausedRecording,
    updateTestState,
  ]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      isScreenFocusedRef.current = false;
      startAttemptRef.current += 1;
      clearRecordingTimer();
    };
  }, [clearRecordingTimer]);

  const togglePlayback = useCallback(async () => {
    if (recordingUri === null || playbackStatus.error !== null) return;

    try {
      if (playbackStatus.playing) {
        recordingPlayer.pause();
        return;
      }

      const hasReachedEnd =
        playbackStatus.didJustFinish ||
        (playbackStatus.duration > 0 && playbackStatus.currentTime >= playbackStatus.duration);

      if (playbackStatus.isLoaded && hasReachedEnd) {
        await recordingPlayer.seekTo(0);
      }

      recordingPlayer.play();
    } catch (error) {
      console.error("[MicrophoneTest] 녹음 파일 재생 실패", error);
      updateTestState("error");
    }
  }, [playbackStatus, recordingPlayer, recordingUri, updateTestState]);

  const prepareToLeave = useCallback(() => {
    interruptAndStop("screen-leave");
  }, [interruptAndStop]);

  const resetTest = useCallback(() => {
    updateTestState("idle");
    void stopActiveAudio("test-reset");
  }, [stopActiveAudio, updateTestState]);

  const elapsedSeconds = Math.min(
    TEST_DURATION_SECONDS,
    Math.floor(recorderState.durationMillis / 1_000),
  );

  return {
    testState,
    canAskPermissionAgain,
    durationSeconds: TEST_DURATION_SECONDS,
    elapsedSeconds,
    meteringDb: recorderState.metering ?? null,
    isComplete,
    isRecording,
    isBusy,
    hasRecording: recordingUri !== null,
    isPlaying: playbackStatus.playing,
    hasPlaybackError: playbackStatus.error !== null,
    hasPlaybackProgress: playbackStatus.currentTime > 0,
    startRecording,
    togglePlayback,
    prepareToLeave,
    resetTest,
  };
}
