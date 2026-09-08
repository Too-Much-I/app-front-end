import type { ReactNode } from "react";
import { View, type ImageSourcePropType } from "react-native";

import { Text } from "@/components/ui/Text";
import { EmptyHistoryIllustration } from "@/screens/feedback/components/EmptyHistoryIllustration";

interface EmptyHistoryCardProps {
  mascot: ImageSourcePropType;
  title: string;
  description: string;
  /**
   * 다음 행동 버튼.
   *
   * 슬롯인 이유: 무엇을 권할지가 탭마다 다르고, 재답변 탭은 상태에 따라 두 갈래로
   * 갈린다(재답변할 시험이 있으면 그 피드백으로, 없으면 응시로). 이걸 프롭으로 받으면
   * 카드가 두 탭의 사정을 다 알아야 한다.
   *
   * 대신 자리는 카드가 정한다 — 버튼은 위 여백과 전체 폭을 스스로 정하지 않는다.
   */
  children: ReactNode;
}

/**
 * 이력이 비었을 때 마스코트와 다음 행동을 함께 보여주는 카드.
 *
 * 모의고사 탭과 재답변 탭의 빈 상태가 마스코트·문구·행동만 다르고 골격이 같았다.
 * 일러스트는 이미 `EmptyHistoryIllustration`으로 묶여 있었고, 그것을 감싸는 카드까지
 * 마저 묶은 것이다. 두 탭을 오갈 때 카드 여백이 어긋나면 그림이 튄다는 이유도 같다.
 *
 * 상하 여백이 비대칭(위 16 · 아래 24)인 것은 두 화면에서 그대로 옮겨온 값이다.
 * 왜 비대칭인지는 기록에 남아 있지 않다 — 바꿀 때는 두 탭을 함께 보고 정한다.
 */
export function EmptyHistoryCard({
  mascot,
  title,
  description,
  children,
}: EmptyHistoryCardProps) {
  return (
    <View className="mt-3xl items-center rounded-3xl border border-line bg-surface px-xl pb-2xl pt-lg">
      <EmptyHistoryIllustration mascot={mascot} />

      <Text accessibilityRole="header" className="mt-element text-center text-xl">
        {title}
      </Text>
      <Text className="mt-content text-center text-sm leading-6 text-ink-muted">
        {description}
      </Text>

      <View className="mt-section w-full">{children}</View>
    </View>
  );
}
