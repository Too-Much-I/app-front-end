import { Feather } from "@expo/vector-icons";
import { Image, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { AudioWaveform } from "@/features/audio/components/AudioWaveform";
import { formatDuration } from "@/screens/reanswer/reanswer-ui";
import { colors, shadows } from "@/theme";

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const rabbitFace = require("../../../../public/mascots/rabbit_face.png");

interface ReanswerRecordPanelProps {
  status: "idle" | "recording" | "reviewing";
  meteringDb: number | null;
  remainingSeconds: number;
  recordedSeconds: number;
  speakTimeSec: number;
  onStart: () => void;
  onStop: () => void;
  onRetake: () => void;
  onSubmit: () => void;
}

/**
 * 녹음 대기 · 녹음 중 · 검토를 한 카드 안에서 바꿔 그린다.
 *
 * 구성과 문구는 웹의 `ExamReanswerPanel`을 따른다. 다른 점은 남은 시간이다 —
 * 웹에는 제한이 없지만 앱은 문제의 `speakTimeSec`만큼만 녹음하고 자동으로 끝낸다.
 * 응시 화면의 타이머 카드 대신 얇은 막대를 쓰는 이유는 여기가 시험이 아니라 연습이라
 * 남은 시간이 화면의 주인공일 필요가 없어서다.
 */
export function ReanswerRecordPanel({
  status,
  meteringDb,
  remainingSeconds,
  recordedSeconds,
  speakTimeSec,
  onStart,
  onStop,
  onRetake,
  onSubmit,
}: ReanswerRecordPanelProps) {
  const remainingRatio =
    speakTimeSec > 0 ? Math.max(0, Math.min(1, remainingSeconds / speakTimeSec)) : 0;

  return (
    <View className="rounded-3xl bg-surface p-4" style={shadows.card}>
      {status === "idle" ? (
        <View className="items-center gap-4">
          <View className="w-full flex-row items-center gap-1">
            <Image
              accessibilityElementsHidden
              className="h-10 w-10"
              resizeMode="contain"
              source={rabbitFace}
            />
            <View className="rounded-2xl bg-surface px-3 py-2" style={shadows.card}>
              <Text className="text-sm text-exam-navy">다시 연습해보세요!</Text>
            </View>
          </View>

          <Pressable
            accessibilityHint="이 문제에 다시 답변할 녹음을 시작합니다"
            accessibilityLabel="녹음 시작"
            accessibilityRole="button"
            className="h-20 w-20 items-center justify-center rounded-full bg-brand-cta"
            onPress={onStart}
            style={shadows.card}
          >
            <Feather name="mic" size={32} color={colors.surface.DEFAULT} />
          </Pressable>
        </View>
      ) : null}

      {status === "recording" ? (
        <View className="gap-3">
          <View className="gap-1.5">
            <View className="flex-row items-baseline justify-between">
              <Text className="text-xs text-ink-muted">남은 시간</Text>
              <Text className="text-lg tabular-nums text-exam-danger">
                {formatDuration(remainingSeconds)}
              </Text>
            </View>
            <View className="h-1 overflow-hidden rounded-full bg-line">
              <View
                className="h-full rounded-full bg-exam-danger"
                style={{ width: `${remainingRatio * 100}%` }}
              />
            </View>
          </View>

          <View className="items-center">
            <AudioWaveform active meteringDb={meteringDb} variant="answer" />
          </View>

          <View className="items-center">
            <Pressable
              accessibilityHint="녹음을 끝내고 제출할지 정합니다"
              accessibilityLabel="녹음 종료"
              accessibilityRole="button"
              className="flex-row items-center gap-2 rounded-full bg-ink px-5 py-3"
              onPress={onStop}
            >
              <View className="h-2.5 w-2.5 bg-white" />
              <Text className="text-sm text-white">녹음 종료</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {status === "reviewing" ? (
        <View className="gap-3">
          <View className="gap-0.5">
            <Text className="text-center text-sm leading-6 text-ink-muted">
              녹음이 끝났어요. 제출하거나 다시 녹음할 수 있어요.
            </Text>
            <Text className="text-center text-xs tabular-nums text-ink-disabled">
              {formatDuration(recordedSeconds)} / {formatDuration(speakTimeSec)}
            </Text>
          </View>

          <View className="flex-row gap-2">
            <Pressable
              accessibilityHint="지금 녹음한 답변을 버리고 처음부터 다시 녹음합니다"
              accessibilityLabel="다시 녹음"
              accessibilityRole="button"
              className="flex-1 items-center rounded-full border border-line bg-surface py-3"
              onPress={onRetake}
            >
              <Text className="text-sm text-ink-muted">다시 녹음</Text>
            </Pressable>

            <Pressable
              accessibilityHint="녹음한 답변을 제출하고 채점을 기다립니다"
              accessibilityLabel="제출하기"
              accessibilityRole="button"
              className="flex-1 items-center rounded-full bg-brand-cta py-3"
              onPress={onSubmit}
            >
              <Text className="text-sm text-white">제출하기</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}
