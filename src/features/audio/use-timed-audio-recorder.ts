import {
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import {
  AUDIO_METER_UPDATE_INTERVAL_MS,
  PLAYBACK_AUDIO_MODE,
  RECORDING_AUDIO_MODE,
  VOICE_RECORDING_OPTIONS,
} from "@/features/audio/audio-session";
import {
  deleteRecordingFile,
  getValidRecordingFile,
} from "@/features/audio/recording-file";
import {
  RecordingPermissionError,
  resolveRecordingPermissionAsync,
  type RecordingPermissionFailureOperation,
} from "@/features/audio/recording-permission";

export type AudioRecordingStatus =
  | "idle"
  | "preparing"
  | "recording"
  | "finalizing"
  | "interrupted"
  | "permission-denied"
  | "error";

export type AudioRecordingFailureStage =
  | "permission"
  | "prepare"
  | "stop"
  | "file-validation"
  | "interruption";

export type AudioRecordingStartOperation =
  | RecordingPermissionFailureOperation
  | "audio-mode"
  | "recorder-prepare"
  | "record-start";

interface AudioRecordingErrorOptions extends ErrorOptions {
  operation?: AudioRecordingStartOperation;
  permissionGranted?: boolean;
}

export class AudioRecordingError extends Error {
  public readonly operation?: AudioRecordingStartOperation;
  public readonly permissionGranted?: boolean;

  constructor(
    public readonly stage: AudioRecordingFailureStage,
    message: string,
    options?: AudioRecordingErrorOptions,
  ) {
    super(message, options);
    this.name = "AudioRecordingError";
    this.operation = options?.operation;
    this.permissionGranted = options?.permissionGranted;
  }
}

export interface StartAudioRecordingInput<TContext> {
  context: TContext;
  maxDurationMs: number;
}

interface RecordingGeneration<TContext> {
  id: number;
  context: TContext;
  maxDurationMs: number;
  /**
   * `record()` 직후의 wall-clock 시각. 0이면 아직 녹음이 시작되지 않았다.
   * 네이티브는 `forDuration` 자동 정지 시 `durationMillis`를 0으로 되감기 때문에
   * 경과 시간의 기준으로 쓸 수 없다.
   */
  startedAtMs: number;
  terminalIntent: "finalize" | "discard" | null;
  ownsAudioMode: boolean;
  hasOpenRecording: boolean;
}

export interface StartAudioRecordingResult {
  started: boolean;
  reason?: "permission-denied" | "interrupted" | "error";
  error?: AudioRecordingError;
}

export interface FinalizedAudioRecording<TContext> {
  context: TContext;
  generationId: number;
  audioFileUri: string;
}

export type AudioRecordingFinishReason =
  | "user"
  | "native-timeout"
  | "fallback-timeout";

export type AudioRecordingDiscardReason =
  | "app-state"
  | "owner-inactive"
  | "media-reset"
  | "unexpected-stop"
  | "dispose";

const NATIVE_FINISH_TOLERANCE_MS = 300;
const FALLBACK_FINISH_DELAY_MS = 500;

/** 네이티브 카운터 대신 wall-clock으로 잰 녹음 경과 시간. */
function getElapsedMs<TContext>(generation: RecordingGeneration<TContext>): number {
  if (generation.startedAtMs === 0) return 0;
  return Math.max(0, Date.now() - generation.startedAtMs);
}

export function useTimedAudioRecorder<TContext>() {
  const recorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, AUDIO_METER_UPDATE_INTERVAL_MS);
  const [status, setStatus] = useState<AudioRecordingStatus>("idle");
  const [canAskPermissionAgain, setCanAskPermissionAgain] = useState(true);
  const [lastError, setLastError] = useState<AudioRecordingError | null>(null);
  const mountedRef = useRef(true);
  const statusRef = useRef<AudioRecordingStatus>("idle");
  const generationSequenceRef = useRef(0);
  const activeGenerationRef = useRef<RecordingGeneration<TContext> | null>(null);
  const terminalPromiseRef = useRef<Promise<FinalizedAudioRecording<TContext> | null> | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ownedFinalizedUriRef = useRef<string | null>(null);
  const isPermissionRequestInFlightRef = useRef(false);
  const disposeRef = useRef<() => void>(() => undefined);

  const updateStatus = useCallback((nextStatus: AudioRecordingStatus) => {
    statusRef.current = nextStatus;
    if (mountedRef.current) setStatus(nextStatus);
  }, []);

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current === null) return;
    clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = null;
  }, []);

  const cleanupGeneration = useCallback(
    async (generation: RecordingGeneration<TContext>, shouldDeleteFile: boolean) => {
      clearFallbackTimer();
      let stopError: unknown = null;

      if (recorder.isRecording) {
        try {
          await recorder.stop();
        } catch (error) {
          stopError = error;
          console.error("[TimedAudioRecorder] 녹음기 정지 실패", error);
        } finally {
          generation.hasOpenRecording = false;
        }
      }

      if (generation.ownsAudioMode) {
        try {
          await setAudioModeAsync(PLAYBACK_AUDIO_MODE);
        } catch (error) {
          console.error("[TimedAudioRecorder] 재생 오디오 모드 복원 실패", error);
          stopError ??= error;
        } finally {
          generation.ownsAudioMode = false;
        }
      }

      const audioFileUri = recorder.uri;
      if (shouldDeleteFile && audioFileUri) {
        try {
          deleteRecordingFile(audioFileUri);
        } catch (error) {
          console.error("[TimedAudioRecorder] 부분 녹음 파일 삭제 실패", error);
        }
      }

      if (stopError !== null) {
        throw new AudioRecordingError("stop", "녹음을 종료하지 못했어요.", {
          cause: stopError,
        });
      }

      return audioFileUri;
    },
    [clearFallbackTimer, recorder],
  );

  const runTerminal = useCallback(
    (
      generation: RecordingGeneration<TContext>,
    ): Promise<FinalizedAudioRecording<TContext> | null> => {
      const activePromise = terminalPromiseRef.current;
      if (activePromise !== null) return activePromise;

      const terminalPromise = (async () => {
        const shouldFinalize = generation.terminalIntent === "finalize";
        if (shouldFinalize) updateStatus("finalizing");

        try {
          const audioFileUri = await cleanupGeneration(generation, !shouldFinalize);

          if (!shouldFinalize) {
            updateStatus("interrupted");
            return null;
          }

          if (!audioFileUri) {
            throw new AudioRecordingError(
              "file-validation",
              "완성된 녹음 파일을 찾지 못했어요.",
            );
          }

          try {
            getValidRecordingFile(audioFileUri);
          } catch (error) {
            try {
              deleteRecordingFile(audioFileUri);
            } catch (deleteError) {
              console.error(
                "[TimedAudioRecorder] 유효하지 않은 파일 삭제 실패",
                deleteError,
              );
            }
            throw new AudioRecordingError(
              "file-validation",
              "완성된 녹음 파일이 유효하지 않아요.",
              { cause: error },
            );
          }

          if (!mountedRef.current) {
            try {
              deleteRecordingFile(audioFileUri);
            } catch (error) {
              console.error("[TimedAudioRecorder] 화면 이탈 후 녹음 파일 삭제 실패", error);
            }
            throw new AudioRecordingError(
              "interruption",
              "화면을 벗어나 녹음을 취소했어요.",
            );
          }

          const finalizedRecording: FinalizedAudioRecording<TContext> = {
            context: generation.context,
            generationId: generation.id,
            audioFileUri,
          };
          ownedFinalizedUriRef.current = audioFileUri;
          return finalizedRecording;
        } catch (error) {
          const recordingError =
            error instanceof AudioRecordingError
              ? error
              : new AudioRecordingError("stop", "녹음을 확정하지 못했어요.", {
                  cause: error,
                });
          if (mountedRef.current) setLastError(recordingError);
          updateStatus("error");
          throw recordingError;
        } finally {
          if (activeGenerationRef.current?.id === generation.id) {
            activeGenerationRef.current = null;
          }
        }
      })();

      terminalPromiseRef.current = terminalPromise;
      void terminalPromise.finally(() => {
        if (terminalPromiseRef.current === terminalPromise) terminalPromiseRef.current = null;
      }).catch(() => undefined);
      return terminalPromise;
    },
    [cleanupGeneration, updateStatus],
  );

  const finish = useCallback(
    async (_reason: AudioRecordingFinishReason) => {
      const generation = activeGenerationRef.current;
      if (!generation) {
        const terminalPromise = terminalPromiseRef.current;
        if (terminalPromise) {
          const finalizedRecording = await terminalPromise;
          if (finalizedRecording) return finalizedRecording;
        }
        throw new AudioRecordingError("stop", "종료할 녹음이 없어요.");
      }

      if (generation.terminalIntent === null) generation.terminalIntent = "finalize";
      const finalizedRecording = await runTerminal(generation);
      if (finalizedRecording) return finalizedRecording;
      throw new AudioRecordingError("interruption", "녹음이 중단되어 다시 녹음해야 해요.");
    },
    [runTerminal],
  );

  const discard = useCallback(
    async (_reason: AudioRecordingDiscardReason) => {
      const generation = activeGenerationRef.current;
      if (!generation) {
        await terminalPromiseRef.current?.catch(() => null);
        return;
      }
      if (generation.terminalIntent === null) generation.terminalIntent = "discard";
      if (generation.terminalIntent === "discard") {
        await runTerminal(generation);
        return;
      }

      // 먼저 기록된 finalize가 이기되, 오디오 세션을 끄기 전에 stop·파일 확정을 기다린다.
      await terminalPromiseRef.current?.catch(() => null);
    },
    [runTerminal],
  );

  const start = useCallback(
    async ({
      context,
      maxDurationMs,
    }: StartAudioRecordingInput<TContext>): Promise<StartAudioRecordingResult> => {
      if (statusRef.current === "preparing" || statusRef.current === "recording") {
        return { started: false, reason: "error" };
      }
      if (!Number.isFinite(maxDurationMs) || maxDurationMs <= 0) {
        const error = new AudioRecordingError("prepare", "녹음 제한 시간이 올바르지 않아요.");
        setLastError(error);
        updateStatus("error");
        return { started: false, reason: "error", error };
      }

      const previousTerminal = terminalPromiseRef.current;
      if (previousTerminal) await previousTerminal.catch(() => null);

      if (ownedFinalizedUriRef.current) {
        try {
          deleteRecordingFile(ownedFinalizedUriRef.current);
        } catch (error) {
          console.error("[TimedAudioRecorder] 이전 미등록 녹음 파일 삭제 실패", error);
        }
        ownedFinalizedUriRef.current = null;
      }

      const generation: RecordingGeneration<TContext> = {
        id: generationSequenceRef.current + 1,
        context,
        maxDurationMs,
        startedAtMs: 0,
        terminalIntent: null,
        ownsAudioMode: false,
        hasOpenRecording: false,
      };
      generationSequenceRef.current = generation.id;
      activeGenerationRef.current = generation;
      if (mountedRef.current) setLastError(null);
      updateStatus("preparing");
      let failureOperation: AudioRecordingStartOperation = "permission-check";
      let permissionGranted = false;

      try {
        const permission = await resolveRecordingPermissionAsync({
          onRequestStart: () => {
            isPermissionRequestInFlightRef.current = true;
          },
          onRequestEnd: () => {
            isPermissionRequestInFlightRef.current = false;
          },
        });
        if (activeGenerationRef.current?.id !== generation.id || generation.terminalIntent) {
          return { started: false, reason: "interrupted" };
        }
        permissionGranted = permission.granted;
        setCanAskPermissionAgain(permission.canAskAgain);
        if (!permission.granted) {
          activeGenerationRef.current = null;
          updateStatus("permission-denied");
          return { started: false, reason: "permission-denied" };
        }

        failureOperation = "audio-mode";
        generation.ownsAudioMode = true;
        await setAudioModeAsync(RECORDING_AUDIO_MODE);
        if (activeGenerationRef.current?.id !== generation.id || generation.terminalIntent) {
          try {
            await setAudioModeAsync(PLAYBACK_AUDIO_MODE);
          } finally {
            generation.ownsAudioMode = false;
          }
          return { started: false, reason: "interrupted" };
        }

        failureOperation = "recorder-prepare";
        await recorder.prepareToRecordAsync();
        if (activeGenerationRef.current?.id !== generation.id || generation.terminalIntent) {
          await discard("app-state");
          return { started: false, reason: "interrupted" };
        }

        failureOperation = "record-start";
        recorder.record({ forDuration: maxDurationMs / 1_000 });
        generation.hasOpenRecording = true;
        generation.startedAtMs = Date.now();
        updateStatus("recording");
        fallbackTimerRef.current = setTimeout(() => {
          void finish("fallback-timeout").catch(() => undefined);
        }, maxDurationMs + FALLBACK_FINISH_DELAY_MS);
        return { started: true };
      } catch (error) {
        if (generation.terminalIntent === "discard") {
          await runTerminal(generation).catch(() => undefined);
          return { started: false, reason: "interrupted" };
        }

        generation.terminalIntent = "discard";
        await runTerminal(generation).catch(() => undefined);
        const recordingError = new AudioRecordingError(
          "prepare",
          "마이크를 준비하지 못했어요.",
          {
            cause: error,
            operation:
              error instanceof RecordingPermissionError
                ? error.operation
                : failureOperation,
            permissionGranted,
          },
        );
        if (mountedRef.current) setLastError(recordingError);
        updateStatus("error");
        return { started: false, reason: "error", error: recordingError };
      }
    },
    [discard, finish, recorder, runTerminal, updateStatus],
  );

  const transferOwnership = useCallback((audioFileUri: string) => {
    if (ownedFinalizedUriRef.current !== audioFileUri) return false;
    ownedFinalizedUriRef.current = null;
    updateStatus("idle");
    return true;
  }, [updateStatus]);

  const resetForRetry = useCallback(() => {
    if (statusRef.current === "preparing" || statusRef.current === "recording") return false;
    if (ownedFinalizedUriRef.current) {
      try {
        deleteRecordingFile(ownedFinalizedUriRef.current);
      } catch (error) {
        console.error("[TimedAudioRecorder] 재녹음 전 파일 삭제 실패", error);
      }
      ownedFinalizedUriRef.current = null;
    }
    setLastError(null);
    updateStatus("idle");
    return true;
  }, [updateStatus]);

  const dispose = useCallback(() => {
    mountedRef.current = false;
    isPermissionRequestInFlightRef.current = false;
    void discard("dispose").catch(() => undefined);
    const ownedUri = ownedFinalizedUriRef.current;
    ownedFinalizedUriRef.current = null;
    if (ownedUri) {
      try {
        deleteRecordingFile(ownedUri);
      } catch (error) {
        console.error("[TimedAudioRecorder] 화면 이탈 파일 삭제 실패", error);
      }
    }
  }, [discard]);

  useEffect(() => {
    disposeRef.current = dispose;
  }, [dispose]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active" && !isPermissionRequestInFlightRef.current) {
        void discard("app-state").catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [discard]);

  useEffect(() => {
    const generation = activeGenerationRef.current;
    if (!generation || generation.terminalIntent !== null) return;
    if (recorderState.mediaServicesDidReset) {
      void discard("media-reset").catch(() => undefined);
      return;
    }
    if (statusRef.current !== "recording" || recorderState.isRecording) return;

    if (getElapsedMs(generation) >= generation.maxDurationMs - NATIVE_FINISH_TOLERANCE_MS) {
      void finish("native-timeout").catch(() => undefined);
    } else if (generation.hasOpenRecording) {
      void discard("unexpected-stop").catch(() => undefined);
    }
  }, [discard, finish, recorderState.isRecording, recorderState.mediaServicesDidReset]);

  useEffect(() => {
    mountedRef.current = true;
    return () => disposeRef.current();
  }, []);

  // recorderState 폴링이 렌더를 유발하므로 wall-clock 경과도 매 tick 갱신된다.
  const activeGeneration = activeGenerationRef.current;
  const isTimingActive = status === "recording" || status === "finalizing";
  const elapsedMs = isTimingActive && activeGeneration ? getElapsedMs(activeGeneration) : 0;
  const maxDurationMs = activeGeneration?.maxDurationMs ?? 0;

  return useMemo(
    () => ({
      status,
      elapsedMs,
      remainingMs: Math.max(0, maxDurationMs - elapsedMs),
      meteringDb: recorderState.metering ?? null,
      canAskPermissionAgain,
      lastError,
      start,
      finish,
      discard,
      resetForRetry,
      transferOwnership,
      dispose,
    }),
    [
      canAskPermissionAgain,
      discard,
      dispose,
      elapsedMs,
      finish,
      lastError,
      maxDurationMs,
      recorderState.metering,
      resetForRetry,
      start,
      status,
      transferOwnership,
    ],
  );
}
