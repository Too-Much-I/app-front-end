import { Feather } from "@expo/vector-icons";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useMemo } from "react";
import { Image, View } from "react-native";

import { Part4Table } from "@/components/exam/Part4Table";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { PLAYBACK_AUDIO_MODE } from "@/features/audio/audio-session";
import { getQuestionAudioSource } from "@/features/exam/question-audio";
import { colors, shadows } from "@/theme";
import type { ExamQuestionInfo } from "@/types/exam";

interface ReanswerQuestionCardProps {
  question: ExamQuestionInfo;
  /** 녹음 중에는 재생 소리가 마이크로 들어가므로 잠근다. */
  isAudioLocked: boolean;
}

/**
 * 재답변 대상 문제 한 개를 보여주는 카드.
 *
 * 응시 화면과 달리 파트에 따라 질문을 가리지 않는다 — Part 4에서 텍스트를 숨기는 건
 * 모의고사 응시 규칙이고, 여기는 이미 채점받은 답을 다시 연습하는 자리다.
 * 같은 이유로 문제 음성도 횟수 제한 없이 다시 들을 수 있다.
 */
export function ReanswerQuestionCard({
  question,
  isAudioLocked,
}: ReanswerQuestionCardProps) {
  const audioSource = useMemo(
    () => (question.audioUrl ? getQuestionAudioSource(question.audioUrl) : null),
    [question.audioUrl],
  );
  const player = useAudioPlayer(audioSource ?? null, { updateInterval: 200 });
  const playbackStatus = useAudioPlayerStatus(player);
  const isPlaying = playbackStatus.playing;

  useEffect(() => {
    if (isAudioLocked && isPlaying) player.pause();
  }, [isAudioLocked, isPlaying, player]);

  const replayQuestion = useCallback(async () => {
    if (!audioSource) return;

    try {
      await setAudioModeAsync(PLAYBACK_AUDIO_MODE);
      player.pause();
      if (player.currentTime > 0) await player.seekTo(0);
      player.play();
    } catch (error) {
      console.error("[Reanswer] 문제 음성 재생 실패", error);
    }
  }, [audioSource, player]);

  return (
    <View className="rounded-3xl bg-surface p-4" style={shadows.card}>
      <Text className="text-sm text-exam-navy">문제</Text>

      <View className="mt-3 gap-3">
        {question.referenceText ? (
          <View className="rounded-2xl border border-line bg-surface-muted px-4 py-3">
            <Text className="text-base leading-7 text-exam-navy">
              {question.referenceText}
            </Text>
          </View>
        ) : null}

        {question.imageUrl ? (
          <View className="aspect-[4/3] w-full overflow-hidden rounded-2xl border border-line bg-surface-muted">
            <Image
              accessibilityLabel="문제 사진"
              className="h-full w-full"
              resizeMode="cover"
              source={{ uri: question.imageUrl }}
            />
          </View>
        ) : null}

        {question.tableContext ? (
          <Part4Table table={question.tableContext} />
        ) : null}

        {question.text ? (
          <View className="border-l-4 border-brand-300 pl-3">
            <Text className="text-base leading-6 text-exam-navy">
              <Text className="text-brand-text">Q. </Text>
              {question.text}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="mt-4 flex-row items-center justify-between gap-3">
        {audioSource ? (
          <Pressable
            accessibilityHint={
              isAudioLocked ? undefined : "문제 음성을 처음부터 다시 재생합니다"
            }
            accessibilityLabel={
              isAudioLocked ? "녹음 중에는 문제를 들을 수 없어요" : "문제 다시 듣기"
            }
            accessibilityRole="button"
            accessibilityState={{ disabled: isAudioLocked }}
            className={`flex-row items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 ${
              isAudioLocked
                ? "border-line bg-surface-muted"
                : "border-sky-line bg-sky-surface"
            }`}
            disabled={isAudioLocked}
            onPress={() => void replayQuestion()}
          >
            <View
              className={`h-6 w-6 items-center justify-center rounded-full ${
                isAudioLocked ? "bg-ink-disabled" : "bg-sky-text"
              }`}
            >
              <Feather
                name={isPlaying ? "volume-2" : "play"}
                size={11}
                color={colors.surface.DEFAULT}
              />
            </View>
            <Text
              className={`text-xs ${isAudioLocked ? "text-ink-disabled" : "text-sky-text"}`}
            >
              {isAudioLocked
                ? "녹음 중에는 들을 수 없어요"
                : isPlaying
                  ? "재생 중이에요"
                  : "문제 다시 듣기"}
            </Text>
          </Pressable>
        ) : (
          <View />
        )}

        <Text className="text-xs text-ink-muted">
          답변 <Text className="text-sm text-exam-navy">{question.speakTimeSec}초</Text>
        </Text>
      </View>
    </View>
  );
}
