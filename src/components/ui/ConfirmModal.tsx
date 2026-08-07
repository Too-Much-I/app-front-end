import { View } from "react-native";

import { MascotModal } from "@/components/ui/MascotModal";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
// 마스코트를 prop으로 열지 않고 고정한 이유: 세 사용처(시험 나가기, 재답변 폐기,
// 학습 기록 삭제)가 모두 "지금 것이 사라진다"는 같은 신호라 표정이 갈릴 이유가 없다.
const shockedRabbit = require("../../../public/mascots/shocked_rabbit.png");

interface ConfirmModalProps {
  visible: boolean;
  /** 없으면 안내 박스가 곧바로 마스코트 아래에 온다. */
  title?: string;
  message: string;
  /** 안내 박스 왼쪽의 brand-cta 원형 "!" 배지. */
  warningBadge?: boolean;
  /** CTA(채움) 버튼 — 되돌아가는 쪽이 항상 시각적 기본값이다. */
  cancelLabel: string;
  /** 보조(외곽선) 버튼 — 파괴적이거나 되돌릴 수 없는 쪽. */
  confirmLabel: string;
  confirmTone?: "danger" | "neutral";
  confirmHint?: string;
  /** 확인 동작이 네트워크를 기다리는 중. 두 버튼을 모두 잠근다. */
  pending?: boolean;
  /** 확인 동작 실패 시 버튼 위에 표시하고 재시도를 허용한다. */
  errorMessage?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 되돌릴 수 없는 동작을 확인받는 공용 모달.
 *
 * 취소가 CTA(채움), 확인이 보조(외곽선)다. 파괴적인 쪽을 시각적 기본값으로 두지 않는다.
 * 카드 골격은 `MascotModal`이 그리고 여기서는 에러 문구와 버튼만 얹는다.
 */
export function ConfirmModal({
  visible,
  title,
  message,
  warningBadge = false,
  cancelLabel,
  confirmLabel,
  confirmTone = "neutral",
  confirmHint,
  pending = false,
  errorMessage,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  const confirmBorderClassName =
    confirmTone === "danger" ? "border-exam-dangerLine" : "border-line";
  const confirmTextClassName =
    confirmTone === "danger" ? "text-exam-danger" : "text-ink-muted";

  return (
    <MascotModal
      cropMascotBottom
      mascot={shockedRabbit}
      message={message}
      onRequestClose={pending ? undefined : onCancel}
      title={title}
      visible={visible}
      warningBadge={warningBadge}
    >
      {errorMessage ? (
        <Text className="mt-3 w-full text-sm text-exam-danger">{errorMessage}</Text>
      ) : null}

      {/* Pressable이 자체 Animated opacity를 style 배열 끝에 덧붙여 className의
          opacity-*를 덮어쓴다. 대기 중 흐림 처리는 바깥 View에서 해야 먹는다. */}
      <View className={`w-full ${pending ? "opacity-50" : ""}`}>
        <Pressable
          accessibilityRole="button"
          className="mt-6 w-full items-center rounded-full bg-brand-cta py-4"
          disabled={pending}
          onPress={onCancel}
        >
          <Text className="text-base text-white">{cancelLabel}</Text>
        </Pressable>

        <Pressable
          accessibilityHint={confirmHint}
          accessibilityRole="button"
          className={`mt-3 w-full items-center rounded-full border bg-surface py-4 ${confirmBorderClassName}`}
          disabled={pending}
          onPress={onConfirm}
        >
          <Text className={`text-base ${confirmTextClassName}`}>{confirmLabel}</Text>
        </Pressable>
      </View>
    </MascotModal>
  );
}
