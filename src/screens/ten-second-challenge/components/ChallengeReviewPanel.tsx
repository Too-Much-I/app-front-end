import { Feather } from "@expo/vector-icons";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback } from "react";
import { View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { PLAYBACK_AUDIO_MODE } from "@/features/audio/audio-session";
import { formatCountdown } from "@/screens/ten-second-challenge/challenge-ui";
import { colors } from "@/theme";

interface ChallengeReviewPanelProps {
  audioFileUri: string;
  recordedSeconds: number;
}

/**
 * 방금 녹음한 답변을 들어보는 칸.
 *
 * 녹음본마다 새로 마운트되도록 호출부가 `key`에 파일 경로를 넘긴다 — `useAudioPlayer`는
 * 마운트 시점의 소스를 들고 있어서, 다시 녹음한 파일을 같은 인스턴스로 재생할 수 없다.
 */
export function ChallengeReviewPanel({
  audioFileUri,
  recordedSeconds,
}: ChallengeReviewPanelProps) {
  const player = useAudioPlayer({ uri: audioFileUri }, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);
  const isPlaying = status.playing;

  const togglePlayback = useCallback(async () => {
    try {
      // 녹음이 끝나며 재생 모드로 돌아오지만, 다른 화면이 모드를 바꿔둔 뒤 돌아오는
      // 경로가 있어 재생 직전에 한 번 더 확정한다.
      await setAudioModeAsync(PLAYBACK_AUDIO_MODE);
      if (isPlaying) {
        player.pause();
        return;
      }
      if (player.currentTime > 0) await player.seekTo(0);
      player.play();
    } catch (error) {
      console.error("[Challenge] 녹음본 재생 실패", error);
    }
  }, [isPlaying, player]);

  return (
    <View className="flex-row items-center gap-3">
      <Pressable
        accessibilityHint="방금 녹음한 답변을 처음부터 들려줍니다"
        accessibilityLabel={isPlaying ? "재생 멈추기" : "내 녹음 들어보기"}
        accessibilityRole="button"
        className="h-11 w-11 items-center justify-center rounded-full bg-brand-cta"
        onPress={() => void togglePlayback()}
      >
        <Feather
          color={colors.surface.DEFAULT}
          name={isPlaying ? "pause" : "play"}
          size={20}
        />
      </Pressable>

      <View className="flex-1">
        <Text className="text-sm text-ink">내 녹음</Text>
        <Text className="text-xs tabular-nums text-ink-muted">
          {formatCountdown(recordedSeconds)}
        </Text>
      </View>
    </View>
  );
}
