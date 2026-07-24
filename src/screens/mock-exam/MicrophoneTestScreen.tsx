import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback } from "react";
import { Image, Linking, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import type { MockExamStackParamList } from "@/navigation/types";
import { DeviceTestLayout } from "@/screens/mock-exam/components/DeviceTestLayout";
import { useMicrophoneTest } from "@/screens/mock-exam/hooks/use-microphone-test";
import { colors } from "@/theme";

const microphoneIcon = require("../../../public/icons/device-test/microphone.png");

type MicrophoneTestScreenProps = NativeStackScreenProps<
  MockExamStackParamList,
  "MicrophoneTest"
>;

export function MicrophoneTestScreen({ navigation }: MicrophoneTestScreenProps) {
  const {
    testState,
    canAskPermissionAgain,
    durationSeconds,
    elapsedSeconds,
    waveformHeights,
    isComplete,
    isRecording,
    isBusy,
    hasRecording,
    isPlaying,
    hasPlaybackError,
    hasPlaybackProgress,
    startRecording,
    togglePlayback,
    prepareToLeave,
    resetTest,
  } = useMicrophoneTest();

  const handleBack = useCallback(() => {
    prepareToLeave();
    navigation.goBack();
  }, [navigation, prepareToLeave]);

  const helpText = (() => {
    if (testState === "denied") return "마이크 권한을 허용해야 입력 신호를 확인할 수 있어요";
    if (testState === "paused") return "마이크 상태를 확인하고 녹음을 이어갈게요";
    if (testState === "interrupted") return "테스트가 중단됐어요. 다시 시도해주세요";
    if (testState === "error") return "마이크를 시작하지 못했어요. 다시 시도해주세요";
    if (testState === "recording") return "목소리에 따라 파형이 움직이고 있어요";
    if (testState === "complete") return "녹음된 음량을 확인해주세요";
    return "조용한 환경에서 응시해주세요";
  })();

  const buttonLabel = (() => {
    if (testState === "requesting") return "마이크 준비 중...";
    if (testState === "recording") return "녹음 중";
    if (testState === "paused") return "녹음 다시 연결 중...";
    if (testState === "denied" && !canAskPermissionAgain) return "앱 설정에서 권한 허용";
    if (testState === "denied") return "마이크 권한 다시 요청";
    if (testState === "interrupted") return "다시 테스트하기";
    if (testState === "error") return "다시 테스트하기";
    return "마이크 테스트 시작";
  })();

  return (
    <DeviceTestLayout currentStep={1} onBack={handleBack}>
      <View className="flex-1">
        <View className="items-center">
          <Text className="text-center text-3xl">마이크 테스트</Text>
          <Text className="mt-2 text-center text-base leading-6 text-ink-muted">{helpText}</Text>
        </View>

        <View className="my-6 min-h-80 flex-1 items-center justify-center px-5 py-6">
          {isComplete ? (
            <View className="absolute right-5 top-5 h-11 w-11 items-center justify-center rounded-full bg-sky-surface">
              <MaterialCommunityIcons name="check-bold" size={26} color={colors.sky.text} />
            </View>
          ) : null}

          <View className="h-52 w-52 items-center justify-center rounded-full bg-brand-50">
            <Image
              accessibilityLabel="마이크"
              className="h-44 w-24"
              resizeMode="contain"
              source={microphoneIcon}
            />
          </View>

          <View className="mt-7 h-16 flex-row gap-1.5">
            {waveformHeights.map((height, index) => (
              <View key={index} className="h-16 justify-center">
                <View
                  className={`w-1.5 rounded-full ${
                    isComplete ? "bg-sky" : isRecording ? "bg-brand-cta" : "bg-brand-200"
                  }`}
                  style={{ height }}
                />
              </View>
            ))}
          </View>

          <View accessibilityLiveRegion="polite" className="mt-3 flex-row items-center gap-2">
            <View
              className={`h-2.5 w-2.5 rounded-full ${
                isComplete ? "bg-sky" : isRecording ? "bg-brand-cta" : "bg-line"
              }`}
            />
            <Text className={`text-sm ${isComplete ? "text-sky-text" : "text-ink-muted"}`}>
              {isComplete
                ? "마이크 입력 정상"
                : isRecording
                  ? `00:0${elapsedSeconds} / 00:0${durationSeconds}`
                  : `${durationSeconds}초 동안 말해주세요`}
            </Text>
          </View>

          {isComplete && hasRecording ? (
            <Pressable
              accessibilityLabel={isPlaying ? "내 녹음 일시정지" : "내 녹음 재생"}
              accessibilityRole="button"
              className={`mt-5 flex-row items-center gap-2 rounded-full border border-sky-line px-5 py-3 ${
                hasPlaybackError ? "bg-line" : "bg-sky-surface"
              }`}
              disabled={hasPlaybackError}
              onPress={() => {
                void togglePlayback();
              }}
            >
              <MaterialCommunityIcons
                name={isPlaying ? "pause" : hasPlaybackProgress ? "replay" : "play"}
                size={22}
                color={colors.sky.text}
              />
              <Text className="text-sm text-sky-text">
                {hasPlaybackError
                  ? "녹음을 불러오지 못했어요"
                  : isPlaying
                    ? "일시정지"
                    : hasPlaybackProgress
                      ? "다시 듣기"
                      : "내 녹음 듣기"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {isComplete ? (
          <>
            <Pressable
              accessibilityRole="button"
              className="items-center justify-center rounded-2xl bg-brand-cta py-4"
              onPress={() => {
                prepareToLeave();
                navigation.navigate("SoundTest");
              }}
            >
              <Text className="text-lg text-white">다음, 음향 테스트</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              className="mt-2 items-center justify-center py-3"
              onPress={resetTest}
            >
              <Text className="text-sm text-ink-muted">다시 테스트하기</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            accessibilityHint="마이크 권한 확인 후 입력 테스트를 시작합니다"
            accessibilityRole="button"
            className={`items-center justify-center rounded-2xl py-4 ${
              isBusy ? "bg-line" : "bg-brand-cta"
            }`}
            disabled={isBusy}
            onPress={() => {
              if (testState === "denied" && !canAskPermissionAgain) {
                void Linking.openSettings().catch((error: unknown) => {
                  console.error("[MicrophoneTest] 앱 설정 화면 열기 실패", error);
                });
                return;
              }

              void startRecording();
            }}
          >
            <Text
              className={`text-lg ${isBusy ? "text-ink-disabled" : "text-white"}`}
            >
              {buttonLabel}
            </Text>
          </Pressable>
        )}
      </View>
    </DeviceTestLayout>
  );
}
