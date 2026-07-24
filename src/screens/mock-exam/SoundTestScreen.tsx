import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useState } from "react";
import { Image, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import type { MockExamStackParamList } from "@/navigation/types";
import { DeviceTestLayout } from "@/screens/mock-exam/components/DeviceTestLayout";
import { colors } from "@/theme";

const headphonesIcon = require("../../../public/icons/device-test/headphones.png");
const soundCheckAudio = require("../../../public/assets/audio/sound_check.wav");

type SoundTestScreenProps = NativeStackScreenProps<MockExamStackParamList, "SoundTest">;

export function SoundTestScreen({ navigation }: SoundTestScreenProps) {
  const [hasPlayed, setHasPlayed] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);
  const soundCheckPlayer = useAudioPlayer(soundCheckAudio, { updateInterval: 100 });
  const playbackStatus = useAudioPlayerStatus(soundCheckPlayer);
  const hasPlaybackFinished =
    playbackStatus.didJustFinish ||
    (playbackStatus.duration > 0 && playbackStatus.currentTime >= playbackStatus.duration);

  const handlePlayback = useCallback(async () => {
    if (playbackStatus.playing) {
      soundCheckPlayer.pause();
      return;
    }

    try {
      setHasPlaybackError(false);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

      if (playbackStatus.isLoaded && hasPlaybackFinished) {
        await soundCheckPlayer.seekTo(0);
      }

      soundCheckPlayer.play();
      setHasPlayed(true);
    } catch (error) {
      console.error("[SoundTest] 안내 음성 재생 실패", error);
      setHasPlaybackError(true);
    }
  }, [hasPlaybackFinished, playbackStatus, soundCheckPlayer]);

  const handleBack = useCallback(() => {
    soundCheckPlayer.pause();
    navigation.goBack();
  }, [navigation, soundCheckPlayer]);

  const handleStartExam = () => {
    soundCheckPlayer.pause();
    // TODO: 시험 진행 화면이 추가되면 createExamSession() 결과와 함께 해당 라우트로 이동한다.
    console.log("[SoundTest] 모의고사 시작하기 press");
  };

  return (
    <DeviceTestLayout currentStep={2} onBack={handleBack}>
      <View className="flex-1">
        <View className="items-center">
          <Text className="text-center text-3xl">음향 테스트</Text>
          <Text className="mt-2 text-center text-base leading-6 text-ink-muted">
            {isComplete
              ? "잘 들린다면 시험을 시작해주세요"
              : hasPlaybackError || playbackStatus.error !== null
                ? "안내 음성을 재생하지 못했어요. 다시 시도해주세요"
                : "오디오나 헤드폰 환경을 권장해요"}
          </Text>
        </View>

        <View className="my-6 min-h-80 flex-1 items-center justify-center px-5 py-6">
          {isComplete ? (
            <View className="absolute right-5 top-5 h-11 w-11 items-center justify-center rounded-full bg-sky-surface">
              <MaterialCommunityIcons name="check-bold" size={26} color={colors.sky.text} />
            </View>
          ) : null}

          <View className="h-52 w-52 items-center justify-center rounded-3xl bg-brand-50">
            <Image
              accessibilityLabel="헤드폰"
              className="h-40 w-44"
              resizeMode="contain"
              source={headphonesIcon}
            />
          </View>

          {!isComplete ? (
            <Pressable
              accessibilityHint="테스트용 안내 음성을 재생합니다"
              accessibilityRole="button"
              className="mt-8 flex-row items-center gap-2 rounded-full border border-brand-cta bg-surface-subtle px-5 py-3"
              onPress={() => {
                void handlePlayback();
              }}
            >
              <MaterialCommunityIcons
                name={playbackStatus.playing ? "pause" : hasPlaybackFinished ? "replay" : "play"}
                size={22}
                color={colors.brand.text}
              />
              <Text className="text-sm text-brand-text">
                {playbackStatus.playing
                  ? "일시정지"
                  : hasPlaybackFinished
                    ? "다시 재생하기"
                    : hasPlayed
                      ? "이어 듣기"
                      : "안내 음성 재생"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {isComplete ? (
          <Pressable
            accessibilityRole="button"
            className="items-center justify-center rounded-2xl bg-brand-cta py-4"
            onPress={handleStartExam}
          >
            <Text className="text-lg text-white">모의고사 시작하기</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !hasPlayed }}
            className={`items-center justify-center rounded-2xl py-4 ${
              hasPlayed ? "bg-brand-cta" : "bg-line"
            }`}
            disabled={!hasPlayed}
            onPress={() => {
              soundCheckPlayer.pause();
              setIsComplete(true);
            }}
          >
            <Text className={`text-lg ${hasPlayed ? "text-white" : "text-ink-disabled"}`}>
              잘 들려요
            </Text>
          </Pressable>
        )}
      </View>
    </DeviceTestLayout>
  );
}
