import { Image, Modal, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { shadows } from "@/theme";

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
// 확인 단계의 긴장감을 과하게 만들지 않으면서 종료 결과에 주의를 모으는 표정이다.
const shockedRabbit = require("../../../../public/mascots/shocked_rabbit.png");

interface ExamExitConfirmationModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ExamExitConfirmationModal({
  visible,
  onCancel,
  onConfirm,
}: ExamExitConfirmationModalProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View className="flex-1 items-center justify-center bg-ink/50 px-6">
        <View
          accessibilityViewIsModal
          className="w-full max-w-md items-center rounded-3xl bg-surface px-6 pb-6 pt-3"
          style={shadows.card}
        >
          {/* 얼굴 전체는 유지하고 원본 하단의 불필요한 여백만 컨테이너 밖으로 숨긴다. */}
          <View className="h-36 w-40 overflow-hidden">
            <Image
              className="h-40 w-40"
              resizeMode="contain"
              source={shockedRabbit}
            />
          </View>

          <View className="mt-5 w-full flex-row items-center rounded-2xl border border-brand-200 bg-brand-50 px-4 py-4">
            <View className="mr-3 h-7 w-7 items-center justify-center rounded-full bg-brand-cta">
              <Text className="text-sm text-white">!</Text>
            </View>
            <Text className="flex-1 text-sm leading-6 text-brand-900">
              지금 나가면 이번 시험은 제출되지 않고 채점 결과도 받을 수 없어요.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            className="mt-6 w-full items-center rounded-full bg-brand-cta py-4"
            onPress={onCancel}
          >
            <Text className="text-base text-white">계속 응시하기</Text>
          </Pressable>

          <Pressable
            accessibilityHint="진행 중인 시험을 종료하고 모의고사 첫 화면으로 이동합니다"
            accessibilityRole="button"
            className="mt-3 w-full items-center rounded-full border border-exam-dangerLine bg-surface py-4"
            onPress={onConfirm}
          >
            <Text className="text-base text-exam-danger">시험 나가기</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
