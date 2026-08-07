import type { AudioSource } from "expo-audio";

export type ExamCueKind =
  | "preparing"
  | "reading-aloud"
  | "responding"
  | "speaking";

const EXAM_CUE_AUDIO_SOURCES: Record<ExamCueKind, AudioSource> = {
  preparing: require("../../../public/assets/audio/cue_begin_preparing.wav"),
  "reading-aloud": require("../../../public/assets/audio/cue_begin_reading_aloud.wav"),
  responding: require("../../../public/assets/audio/cue_begin_responding.wav"),
  speaking: require("../../../public/assets/audio/cue_begin_speaking.wav"),
};

const EXAM_CUE_BEEP_SOURCE: AudioSource = require("../../../public/assets/audio/beep.wav");

/**
 * "Now listen again." 안내. Part 4 마지막 문항(Q10)에서 질문 오디오를 두 번째로
 * 들려주기 직전에만 재생한다. `ExamCueKind`에 넣지 않는 이유는 이게 단계 전환
 * 안내가 아니라 문항 오디오 반복 사이에 끼는 안내라서다. `ExamPhaseCue`처럼
 * 앞에 beep을 붙이지도 않는다.
 */
const EXAM_LISTEN_AGAIN_CUE_SOURCE: AudioSource = require("../../../public/assets/audio/cue_now_listen_again.wav");

export function getExamResponseCueKind(partNumber: number): ExamCueKind {
  if (partNumber === 1) return "reading-aloud";
  if (partNumber === 3) return "responding";
  return "speaking";
}

export function getExamCueAudioSource(kind: ExamCueKind): AudioSource {
  return EXAM_CUE_AUDIO_SOURCES[kind];
}

export function getExamCueBeepSource(): AudioSource {
  return EXAM_CUE_BEEP_SOURCE;
}

export function getExamListenAgainCueSource(): AudioSource {
  return EXAM_LISTEN_AGAIN_CUE_SOURCE;
}
