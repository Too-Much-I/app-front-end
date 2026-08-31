import { Feather } from "@expo/vector-icons";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback } from "react";
import { View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { PLAYBACK_AUDIO_MODE } from "@/features/audio/audio-session";
import { formatCountdown } from "@/screens/challenge/challenge-ui";
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

  /**
   * 남는 시간은 파일이 스스로 말하는 길이가 아니라 녹음하며 잰 길이에서 뺀다.
   *
   * `status.duration`은 아직 확정되지 않았으면 0을 준다. 방금 만든 녹음 파일은 컨테이너에
   * 총 길이가 확정적으로 기록되지 않는 경우가 있어서, 재생 직후 몇 프레임 동안 0이 잡히면
   * 남은 시간이 음수로 튄다. `recordedSeconds`는 이미 확정된 값이라 그런 구간이 없다.
   *
   * 멈춰 있을 때 전체 길이로 되돌리는 이유는 `togglePlayback`이 다시 누를 때 항상 0으로
   * seek하기 때문이다 — 다음 재생이 처음부터 시작하니 표시도 처음 값이어야 한다.
   */
  const displaySeconds = isPlaying
    ? Math.max(0, recordedSeconds - status.currentTime)
    : recordedSeconds;

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
          {formatCountdown(displaySeconds)}
        </Text>
      </View>
    </View>
  );
}
