import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useState } from "react";
import { Image, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { createExamSession } from "@/features/exam/api/exam-session-create";
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
  const [isStartingExam, setIsStartingExam] = useState(false);
  const [startExamError, setStartExamError] = useState(false);
  const soundCheckPlayer = useAudioPlayer(soundCheckAudio, { updateInterval: 100 });
  const playbackStatus = useAudioPlayerStatus(soundCheckPlayer);
  const hasPlaybackFinished =
    playbackStatus.didJustFinish ||
    (playbackStatus.duration > 0 && playbackStatus.currentTime >= playbackStatus.duration);
  const hasSoundPlaybackError = hasPlaybackError || playbackStatus.error !== null;
  const canCompleteSoundTest = hasPlayed && !hasSoundPlaybackError;

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

  const handleStartExam = async () => {
    if (isStartingExam) return;

    soundCheckPlayer.pause();
    setIsStartingExam(true);
    setStartExamError(false);

    try {
      const session = await createExamSession();
      setIsStartingExam(false);
      navigation.navigate("ExamSession", { session });
    } catch (error) {
      console.error("[SoundTest] 시험 세션 생성 실패", error);
      setStartExamError(true);
      setIsStartingExam(false);
    }
  };

  return (
    <DeviceTestLayout currentStep={2} onBack={handleBack}>
      <View className="flex-1">
        <View className="items-center">
          <Text className="text-center text-3xl">음향 테스트</Text>
          <Text className="mt-2 text-center text-base leading-6 text-ink-muted">
            {isComplete
              ? "잘 들린다면 시험을 시작해주세요"
              : hasSoundPlaybackError
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
            accessibilityState={{ disabled: isStartingExam }}
            className={`items-center justify-center rounded-2xl py-4 ${
              isStartingExam ? "bg-line" : "bg-brand-cta"
            }`}
            disabled={isStartingExam}
            onPress={() => {
              void handleStartExam();
            }}
          >
            <Text className={`text-lg ${isStartingExam ? "text-ink-disabled" : "text-white"}`}>
              {isStartingExam ? "시험 준비 중..." : "모의고사 시작하기"}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canCompleteSoundTest }}
            className={`items-center justify-center rounded-2xl py-4 ${
              canCompleteSoundTest ? "bg-brand-cta" : "bg-line"
            }`}
            disabled={!canCompleteSoundTest}
            onPress={() => {
              if (!canCompleteSoundTest) return;
              soundCheckPlayer.pause();
              setIsComplete(true);
            }}
          >
            <Text
              className={`text-lg ${
                canCompleteSoundTest ? "text-white" : "text-ink-disabled"
              }`}
            >
              잘 들려요
            </Text>
          </Pressable>
        )}
        {startExamError ? (
          <Text
            accessibilityLiveRegion="polite"
            className="mt-3 text-center text-sm text-exam-danger"
          >
            시험을 불러오지 못했어요. 네트워크를 확인하고 다시 시도해주세요.
          </Text>
        ) : null}
      </View>
    </DeviceTestLayout>
  );
}
