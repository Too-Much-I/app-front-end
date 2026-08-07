import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { colors } from "@/theme";
import type { InvalidExamPartPrelude } from "@/types/exam";

const ERROR_MESSAGES: Record<InvalidExamPartPrelude["reason"], string> = {
  "missing-part3-intro": "Part 3 안내 문구가 제공되지 않았어요.",
  "missing-part3-guide-audio": "Part 3 안내 음성이 제공되지 않았어요.",
  "misplaced-part3-content": "Part 3 안내 데이터의 위치가 올바르지 않아요.",
  "unsupported-part3-guide-audio": "Part 3 안내 음성 주소를 사용할 수 없어요.",
  "missing-part4-table": "Part 4에서 참고할 정보 표가 제공되지 않았어요.",
  "misplaced-part4-table": "Part 4 정보 표가 첫 문제에 제공되지 않았어요.",
  "conflicting-part4-table": "Part 4 문제들의 정보 표가 서로 달라요.",
  "invalid-part4-table": "Part 4 정보 표의 형식을 사용할 수 없어요.",
};

export function ExamPreludeError({
  prelude,
  onExit,
}: {
  prelude?: InvalidExamPartPrelude;
  onExit: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center bg-surface px-6 py-8">
      <View
        accessibilityLiveRegion="assertive"
        className="w-full max-w-xl items-center rounded-2xl border border-exam-dangerLine bg-surface p-6"
      >
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={38}
          color={colors.exam.danger}
        />
        <Text className="mt-4 text-center text-xl text-exam-danger">
          시험 정보를 준비하지 못했어요
        </Text>
        <Text className="mt-2 text-center text-sm leading-6 text-ink-muted">
          {prelude
            ? ERROR_MESSAGES[prelude.reason]
            : "필수 사전 정보를 확인할 수 없어요."}{" "}
          불완전한 정보로 문제를 시작하지 않습니다.
        </Text>
        <Pressable
          accessibilityRole="button"
          className="mt-6 w-full items-center rounded-2xl bg-brand-cta py-3.5"
          onPress={onExit}
        >
          <Text className="text-base text-white">시험 나가기</Text>
        </Pressable>
      </View>
    </View>
  );
}
