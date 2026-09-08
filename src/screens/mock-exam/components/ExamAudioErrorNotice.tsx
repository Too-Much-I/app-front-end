import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { colors, size } from "@/theme";

/**
 * 어디에 붙는 안내인가.
 *
 * `card`는 큐가 있던 자리를 대신 차지하는 카드고, `footer`는 화면 아래에 가로로
 * 붙는 띠다. 둘은 같은 사건을 알리지만 화면에서 차지하는 자리가 달라 골격이 다르다.
 */
type ExamAudioErrorNoticePlacement = "card" | "footer";

interface ExamAudioErrorNoticeProps {
  message: string;
  placement: ExamAudioErrorNoticePlacement;
  /** 없으면 재시도 버튼을 그리지 않는다 — 재생할 음원 자체가 없는 경우가 있다. */
  onRetry?: () => void;
  retryLabel?: string;
  /** 되돌아갈 길이 없을 때의 유일한 진행 방향이라 항상 채움 CTA다. */
  exitLabel: string;
  onExit: () => void;
  /**
   * `footer`의 배경처럼 **화면을 따라가야 하는 값만** 넘긴다.
   *
   * 파트 안내 화면은 `bg-surface`, 파트 지시문 화면은 `bg-surface-subtle` 위에 얹히는데
   * 하단 띠가 화면 배경과 달라지면 띠가 아니라 떠 있는 카드로 읽힌다. 그래서 이 값만
   * 호출부에 남긴다. 나머지 형태는 `placement`가 정한다.
   */
  className?: string;
}

const PLACEMENT_STYLES = {
  card: "w-full gap-3 rounded-2xl border border-exam-dangerLine bg-surface p-card",
  footer: "gap-3 border-t border-line px-screen pb-5 pt-4",
} as const satisfies Record<ExamAudioErrorNoticePlacement, string>;

/** 카드는 큐 자리에 들어가므로 문장이 짧고, 하단 띠는 화면의 주 행동 자리라 한 단계 크다. */
const PLACEMENT_BUTTON_SIZE = {
  card: "md",
  footer: "lg",
} as const satisfies Record<ExamAudioErrorNoticePlacement, "md" | "lg">;

/**
 * 안내 음성을 재생하지 못했을 때 주는 두 갈래 선택.
 *
 * 시작 큐 · 문제 큐 · 파트 안내 · 파트 지시문 네 곳이 같은 골격을 각자 조립하고 있었다.
 * 큐 둘은 재생하지 못한 대상을 가리키는 문장 하나만 달랐다.
 *
 * 이 컴포넌트가 소유하는 것은 **내용의 규칙**이다 — 경고 아이콘과 색, 오류를 즉시
 * 읽어주는 `assertive`, 그리고 "재시도는 보조, 빠져나가는 쪽이 채움 CTA"라는 버튼 규칙.
 * 호출부가 정하는 것은 어디에 붙는가(`placement`)와 무슨 문장인가뿐이다.
 *
 * 오류에 `assertive`를 쓰는 것은 이 저장소의 관례다 — 실패는 즉시 읽어주고, 진행 상태는
 * `polite`로 기다린다(`ExamAnswerStatus`, `GradingFailedNotice`가 같은 규칙을 따른다).
 */
export function ExamAudioErrorNotice({
  message,
  placement,
  onRetry,
  retryLabel = "처음부터 다시 듣기",
  exitLabel,
  onExit,
  className,
}: ExamAudioErrorNoticeProps) {
  const buttonSize = PLACEMENT_BUTTON_SIZE[placement];

  return (
    <View className={`${PLACEMENT_STYLES[placement]} ${className ?? ""}`}>
      <View
        accessibilityLiveRegion="assertive"
        className="flex-row items-center justify-center gap-2"
      >
        <MaterialCommunityIcons
          color={colors.exam.danger}
          name="alert-circle-outline"
          size={size.icon.md}
        />
        <Text className="text-sm text-exam-danger">{message}</Text>
      </View>

      <View className="flex-row gap-3">
        {onRetry ? (
          <Button
            className="flex-1"
            label={retryLabel}
            size={buttonSize}
            variant="secondary"
            onPress={onRetry}
          />
        ) : null}
        <Button className="flex-1" label={exitLabel} size={buttonSize} onPress={onExit} />
      </View>
    </View>
  );
}
