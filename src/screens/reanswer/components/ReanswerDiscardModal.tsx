import { Image, Modal, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { shadows } from "@/theme";

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
// 응시 종료 확인과 같은 표정을 써서 "지금 것이 사라진다"는 신호를 통일한다.
const shockedRabbit = require("../../../../public/mascots/shocked_rabbit.png");

interface ReanswerDiscardModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 녹음 중이거나 제출하지 않은 녹음본이 있을 때 나가기를 확인한다.
 *
 * 폐기되는 것(지금 녹음)과 남는 것(이미 받은 피드백과 이전 회차)을 함께 말한다 —
 * 재답변은 기존 답변을 덮어쓰지 않으므로 여기서 잃는 건 방금 녹음뿐이다.
 */
export function ReanswerDiscardModal({
  visible,
  onCancel,
  onConfirm,
}: ReanswerDiscardModalProps) {
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
            <Image className="h-40 w-40" resizeMode="contain" source={shockedRabbit} />
          </View>

          <Text className="mt-4 text-lg text-exam-navy">녹음을 그만둘까요?</Text>

          <View className="mt-3 w-full rounded-2xl border border-brand-200 bg-brand-50 px-4 py-4">
            <Text className="text-sm leading-6 text-brand-900">
              지금 녹음한 답변은 저장되지 않아요. 이미 받은 피드백과 이전 회차는 그대로
              남아요.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            className="mt-6 w-full items-center rounded-full bg-brand-cta py-4"
            onPress={onCancel}
          >
            <Text className="text-base text-white">계속 녹음하기</Text>
          </Pressable>

          <Pressable
            accessibilityHint="지금 녹음을 버리고 문제별 피드백으로 돌아갑니다"
            accessibilityRole="button"
            className="mt-3 w-full items-center rounded-full border border-line bg-surface py-4"
            onPress={onConfirm}
          >
            <Text className="text-base text-ink-muted">나가기</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
