import { View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import type { ChallengeNoteStatus } from "@/screens/challenge/challenge-status";

interface ChallengeActionBarProps {
  status: ChallengeNoteStatus;
  onFinish: () => void;
  onRetake: () => void;
  onSubmit: () => void;
}

/**
 * 화면 맨 아래 버튼 줄.
 *
 * 녹음 중에는 "완료" 하나뿐이고, 채움 버튼이 아니라 외곽선 버튼이다 — 10초는 안 눌러도
 * 알아서 끝난다. 채움 CTA는 "눌러야 진행된다"는 약속인데 여기서는 사실이 아니고, 화면에서
 * 가장 무거운 자리를 문장이 아니라 옵션 버튼이 가져가 버린다.
 *
 * 녹음이 확정되면 반대가 된다. 그때는 제출이 사용자가 내려야 할 진짜 결정이라
 * 하단이 채움 CTA를 되찾는다.
 */
export function ChallengeActionBar({
  status,
  onFinish,
  onRetake,
  onSubmit,
}: ChallengeActionBarProps) {
  if (status === "reviewing") {
    return (
      <View className="gap-2">
        <Text className="text-center text-xs text-ink-muted">
          들어보고 마음에 들면 제출해요.
        </Text>

        <View className="flex-row gap-2">
          <Button
            accessibilityHint="지금 녹음을 버리고 10초를 처음부터 다시 시작합니다"
            className="flex-1"
            label="다시 녹음"
            variant="neutral"
            onPress={onRetake}
          />

          <Button
            accessibilityHint="녹음한 답변을 올리고 채점을 요청합니다"
            className="flex-1"
            label="제출하기"
            onPress={onSubmit}
          />
        </View>
      </View>
    );
  }

  const isRecording = status === "recording";

  return (
    <View className="gap-2">
      <Text className="text-center text-xs text-ink-muted">
        10초가 지나면 자동으로 끝나요.
      </Text>

      {/* 비활성일 때도 외곽선을 유지한다 — Button이 variant의 채움 여부를 지킨다. */}
      <Button
        accessibilityHint="10초를 다 쓰지 않고 지금 녹음을 끝냅니다"
        className="w-full"
        disabled={!isRecording}
        label="완료"
        variant="secondary"
        onPress={onFinish}
      />
    </View>
  );
}
