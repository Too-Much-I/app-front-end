import { AntDesign } from "@expo/vector-icons";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { colors, shadows } from "@/theme";

type StartMockExamButtonProps = {
  onPress: () => void;
  /** 바깥 여백·너비처럼 화면마다 다른 배치만 넘긴다(`mt-2`, `w-full` 등). */
  className?: string;
  /** 누른 뒤 어디로 가는지가 화면마다 다를 때만 덧붙인다. */
  accessibilityHint?: string;
};

/**
 * 모의고사 응시를 시작하는 공용 CTA.
 *
 * 홈·모의고사 탭·피드백 빈 상태에서 같은 행동을 서로 다른 모양으로 보여주던 버튼을
 * 홈 기준으로 통일한 것이다. 화면 전체에서 유일하게 강한 주황이어야 하므로 색과
 * 그림자는 프롭으로 열지 않고, 배치(`className`)만 호출부가 정한다.
 *
 * 이동은 호출부가 맡는다 — 홈은 탭, 나머지는 각자의 스택으로 가야 해서 내비게이션
 * 대상이 화면마다 다르다.
 */
export function StartMockExamButton({
  onPress,
  className,
  accessibilityHint,
}: StartMockExamButtonProps) {
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel="모의고사 시작하기"
      accessibilityRole="button"
      // 규칙: 버튼이 주황이면 아이콘·글자는 흰색
      className={`flex-row items-center justify-center gap-2 rounded-2xl bg-brand-cta py-4 ${className ?? ""}`}
      style={shadows.card}
      onPress={onPress}
    >
      <AntDesign name="audio" size={20} color={colors.surface.DEFAULT} />
      <Text className="text-base text-white">모의고사 시작하기</Text>
    </Pressable>
  );
}
