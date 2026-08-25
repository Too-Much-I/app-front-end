import { useCallback, useMemo } from "react";

import {
  AudioRecordingError,
  useTimedAudioRecorder,
  type AudioRecordingFailureStage,
  type AudioRecordingFinishReason,
  type AudioRecordingStartOperation,
  type AudioRecordingStatus,
  type StartAudioRecordingResult,
} from "@/features/audio/use-timed-audio-recorder";
import type { AnswerKey, FinalizedAnswer } from "@/types/exam";

export { AudioRecordingError as AnswerRecordingError };
export type AnswerRecordingStatus = AudioRecordingStatus;
export type AnswerRecordingFailureStage = AudioRecordingFailureStage;
export type AnswerRecordingStartOperation = AudioRecordingStartOperation;

interface StartAnswerRecordingInput {
  key: AnswerKey;
  maxDurationMs: number;
}

type AnswerRecordingDiscardReason =
  | "app-state"
  | "exam-inactive"
  | "media-reset"
  | "unexpected-stop"
  | "dispose";

/**
 * 공통 시간제한 녹음에 시험 문항 식별자를 결합한다.
 * 업로드 큐는 녹음 시작 당시의 문항을 받아야 하므로 AnswerKey를 복제해 보관한다.
 */
export function useAnswerRecorder() {
  const recorder = useTimedAudioRecorder<AnswerKey>();
  const {
    discard: discardRecording,
    finish: finishRecording,
    start: startRecording,
  } = recorder;

  const start = useCallback(
    ({ key, maxDurationMs }: StartAnswerRecordingInput): Promise<StartAudioRecordingResult> =>
      startRecording({ context: { ...key }, maxDurationMs }),
    [startRecording],
  );

  const finish = useCallback(
    async (reason: AudioRecordingFinishReason): Promise<FinalizedAnswer> => {
      const finalizedRecording = await finishRecording(reason);
      return {
        key: { ...finalizedRecording.context },
        generationId: finalizedRecording.generationId,
        audioFileUri: finalizedRecording.audioFileUri,
      };
    },
    [finishRecording],
  );

  const discard = useCallback(
    (reason: AnswerRecordingDiscardReason): Promise<void> =>
      discardRecording(reason === "exam-inactive" ? "owner-inactive" : reason),
    [discardRecording],
  );

  return useMemo(
    () => ({ ...recorder, start, finish, discard }),
    [discard, finish, recorder, start],
  );
}
