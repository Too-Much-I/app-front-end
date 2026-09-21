import { useCallback, useMemo } from "react";

import {
  useTimedAudioRecorder,
  type AudioRecordingFinishReason,
  type StartAudioRecordingResult,
} from "@/features/audio/use-timed-audio-recorder";
import type { AnswerKey, FinalizedAnswer } from "@/types/exam";

interface StartAnswerRecordingInput {
  key: AnswerKey;
  maxDurationMs: number;
}

/**
 * 공통 시간제한 녹음에 시험 문항 식별자를 결합한다.
 * 업로드 큐는 녹음 시작 당시의 문항을 받아야 하므로 AnswerKey를 복제해 보관한다.
 */
export function useAnswerRecorder() {
  const recorder = useTimedAudioRecorder<AnswerKey>();
  // 아래에서 정의하는 `start`/`finish`와 겹치지 않게 원본을 이름으로 구분한다.
  // "timed"는 이 어댑터가 감싸고 있는 공용 훅(`useTimedAudioRecorder`)을 가리킨다.
  const { finish: finishTimedRecording, start: startTimedRecording } = recorder;

  const start = useCallback(
    ({ key, maxDurationMs }: StartAnswerRecordingInput): Promise<StartAudioRecordingResult> =>
      startTimedRecording({ context: { ...key }, maxDurationMs }),
    [startTimedRecording],
  );

  const finish = useCallback(
    async (reason: AudioRecordingFinishReason): Promise<FinalizedAnswer> => {
      const finalizedRecording = await finishTimedRecording(reason);
      return {
        key: { ...finalizedRecording.context },
        generationId: finalizedRecording.generationId,
        audioFileUri: finalizedRecording.audioFileUri,
      };
    },
    [finishTimedRecording],
  );

  // `discard`는 사유를 그대로 쓰므로 공용 훅의 것을 spread로 통과시킨다.
  return useMemo(() => ({ ...recorder, start, finish }), [finish, recorder, start]);
}
