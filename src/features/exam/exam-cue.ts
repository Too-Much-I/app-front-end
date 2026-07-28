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
