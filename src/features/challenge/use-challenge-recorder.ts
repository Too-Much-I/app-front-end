import { useCallback, useMemo } from "react";

import {
  useTimedAudioRecorder,
  type AudioRecordingFinishReason,
  type FinalizedAudioRecording,
  type StartAudioRecordingResult,
} from "@/features/audio/use-timed-audio-recorder";

export interface ChallengeQuestionKey {
  /** 스테이지 API가 내려준 서버 기준 날짜. */
  date: string;
  questionNumber: number;
}

export interface FinalizedChallengeRecording {
  key: ChallengeQuestionKey;
  generationId: number;
  audioFileUri: string;
}

const CHALLENGE_RECORDING_DURATION_MS = 10_000;

/** 서버 기준 날짜와 문제 번호를 녹음 파일에 결합하는 10초 챌린지 어댑터. */
export function useChallengeRecorder() {
  const recorder = useTimedAudioRecorder<ChallengeQuestionKey>();
  const { finish: finishRecording, start: startRecording } = recorder;

  const start = useCallback(
    (key: ChallengeQuestionKey): Promise<StartAudioRecordingResult> =>
      startRecording({
        context: { ...key },
        maxDurationMs: CHALLENGE_RECORDING_DURATION_MS,
      }),
    [startRecording],
  );

  const finish = useCallback(
    async (reason: AudioRecordingFinishReason): Promise<FinalizedChallengeRecording> => {
      const recording: FinalizedAudioRecording<ChallengeQuestionKey> =
        await finishRecording(reason);

      return {
        key: { ...recording.context },
        generationId: recording.generationId,
        audioFileUri: recording.audioFileUri,
      };
    },
    [finishRecording],
  );

  return useMemo(() => ({ ...recorder, start, finish }), [finish, recorder, start]);
}
