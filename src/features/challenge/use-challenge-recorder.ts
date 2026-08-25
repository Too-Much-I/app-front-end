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

/** 10초 챌린지의 이름 그대로인 제한 시간. 화면의 카운트다운도 이 값을 기준으로 그린다. */
export const CHALLENGE_RECORDING_DURATION_MS = 10_000;

/** 서버 기준 날짜와 문제 번호를 녹음 파일에 결합하는 10초 챌린지 어댑터. */
export function useChallengeRecorder() {
  const recorder = useTimedAudioRecorder<ChallengeQuestionKey>();
  // 아래에서 정의하는 `start`/`finish`와 겹치지 않게 원본을 이름으로 구분한다.
  // "timed"는 이 어댑터가 감싸고 있는 공용 훅(`useTimedAudioRecorder`)을 가리킨다.
  const { finish: finishTimedRecording, start: startTimedRecording } = recorder;

  const start = useCallback(
    (key: ChallengeQuestionKey): Promise<StartAudioRecordingResult> =>
      startTimedRecording({
        context: { ...key },
        maxDurationMs: CHALLENGE_RECORDING_DURATION_MS,
      }),
    [startTimedRecording],
  );

  const finish = useCallback(
    async (reason: AudioRecordingFinishReason): Promise<FinalizedChallengeRecording> => {
      const recording: FinalizedAudioRecording<ChallengeQuestionKey> =
        await finishTimedRecording(reason);

      return {
        key: { ...recording.context },
        generationId: recording.generationId,
        audioFileUri: recording.audioFileUri,
      };
    },
    [finishTimedRecording],
  );

  return useMemo(() => ({ ...recorder, start, finish }), [finish, recorder, start]);
}
