import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";

import { normalizeMeteringDb } from "@/features/audio/audio-session";

const VISUAL_SMOOTHING = 0.35;

const MICROPHONE_TEST_SCALES = [
  0.35, 0.5, 0.7, 0.85, 1, 0.8, 0.8, 1, 0.85, 0.7, 0.5, 0.35,
] as const;

const ANSWER_SCALES = [
  0.3, 0.42, 0.58, 0.76, 0.52, 0.88, 0.64, 0.4, 0.8, 1, 0.68, 0.46, 0.72, 0.92,
  0.56, 0.36, 0.5, 0.78, 0.6, 0.4, 0.28, 0.5, 0.4, 0.3,
] as const;

type AudioWaveformVariant = "microphone-test" | "answer";
type AudioWaveformState = "idle" | "recording" | "complete";

interface AudioWaveformProps {
  active: boolean;
  meteringDb: number | null;
  state?: AudioWaveformState;
  variant: AudioWaveformVariant;
}

interface WaveformConfig {
  scales: readonly number[];
  minHeight: number;
  maxHeight: number;
}

const WAVEFORM_CONFIGS: Record<AudioWaveformVariant, WaveformConfig> = {
  "microphone-test": {
    scales: MICROPHONE_TEST_SCALES,
    minHeight: 8,
    maxHeight: 60,
  },
  answer: {
    scales: ANSWER_SCALES,
    minHeight: 8,
    maxHeight: 40,
  },
};

function createEmptyWaveform(config: WaveformConfig): number[] {
  return config.scales.map(() => config.minHeight);
}

export function AudioWaveform({
  active,
  meteringDb,
  state = active ? "recording" : "idle",
  variant,
}: AudioWaveformProps) {
  const config = WAVEFORM_CONFIGS[variant];
  const emptyWaveform = useMemo(() => createEmptyWaveform(config), [config]);
  const [heights, setHeights] = useState<number[]>(emptyWaveform);

  useEffect(() => {
    if (!active) {
      if (state === "idle") setHeights(emptyWaveform);
      return;
    }

    const normalizedLevel = normalizeMeteringDb(meteringDb);
    const targetHeight =
      config.minHeight + normalizedLevel * (config.maxHeight - config.minHeight);

    setHeights((currentHeights) =>
      currentHeights.map((currentHeight, index) => {
        const scale = config.scales[index] ?? 1;
        const scaledTarget =
          config.minHeight + (targetHeight - config.minHeight) * scale;
        return currentHeight + (scaledTarget - currentHeight) * VISUAL_SMOOTHING;
      }),
    );
  }, [active, config, emptyWaveform, meteringDb, state]);

  /*
   * 막대 사이 간격이 간격 토큰(`gap-content` 등)을 쓰지 않는 이유:
   * 이건 요소 사이의 여백이 아니라 파형의 밀도를 만드는 조형 값이다.
   * 바로 아래 `barWidthClassName`의 막대 폭과 한 쌍으로 움직인다 —
   * microphone-test는 `w-1.5`에 `gap-1.5`, 그 외는 `w-1`에 `gap-1`으로
   * 폭과 간격이 같아야 막대가 고르게 늘어선 파형으로 읽힌다.
   * 간격만 8px로 벌리면 파형이 아니라 막대그래프가 된다.
   */
  const containerClassName =
    variant === "microphone-test"
      ? "h-16 flex-row gap-1.5"
      : "h-10 flex-row items-center gap-1";
  const barContainerClassName =
    variant === "microphone-test" ? "h-16 justify-center" : "h-10 justify-center";
  const barWidthClassName = variant === "microphone-test" ? "w-1.5" : "w-1";
  const barColorClassName = (() => {
    if (variant === "answer") {
      return active ? "bg-exam-dangerSoft" : "bg-line";
    }
    if (state === "complete") return "bg-sky";
    if (active) return "bg-brand-cta";
    return "bg-brand-200";
  })();

  return (
    <View
      accessibilityElementsHidden
      className={containerClassName}
      importantForAccessibility="no-hide-descendants"
    >
      {heights.map((height, index) => (
        <View key={index} className={barContainerClassName}>
          <View
            className={`${barWidthClassName} rounded-full ${barColorClassName}`}
            style={{ height }}
          />
        </View>
      ))}
    </View>
  );
}
