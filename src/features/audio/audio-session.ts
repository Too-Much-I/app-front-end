import { RecordingPresets } from "expo-audio";
import type { AudioMode, RecordingOptions } from "expo-audio";

export const AUDIO_METER_UPDATE_INTERVAL_MS = 100;

export const VOICE_RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  directory: "cache",
  extension: ".m4a",
  sampleRate: 44_100,
  numberOfChannels: 1,
  bitRate: 96_000,
  isMeteringEnabled: true,
} satisfies RecordingOptions;

export const RECORDING_AUDIO_MODE = {
  allowsRecording: true,
  allowsBackgroundRecording: false,
  playsInSilentMode: true,
  interruptionMode: "doNotMix",
  shouldPlayInBackground: false,
  shouldRouteThroughEarpiece: false,
} satisfies Partial<AudioMode>;

export const PLAYBACK_AUDIO_MODE = {
  allowsRecording: false,
  playsInSilentMode: true,
  interruptionMode: "doNotMix",
  shouldPlayInBackground: false,
  shouldRouteThroughEarpiece: false,
} satisfies Partial<AudioMode>;

const VISUAL_FLOOR_DB = -50;
const VISUAL_CEILING_DB = -6;
const VISUAL_RESPONSE_EXPONENT = 1.8;

export function normalizeMeteringDb(meteringDb: number | null | undefined): number {
  if (meteringDb === null || meteringDb === undefined || !Number.isFinite(meteringDb)) {
    return 0;
  }

  const normalizedLevel = Math.min(
    1,
    Math.max(0, (meteringDb - VISUAL_FLOOR_DB) / (VISUAL_CEILING_DB - VISUAL_FLOOR_DB)),
  );

  return normalizedLevel ** VISUAL_RESPONSE_EXPONENT;
}
