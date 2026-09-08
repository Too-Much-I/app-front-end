import type { ReactNode } from "react";
import { ActivityIndicator } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { colors, shadows, size } from "@/theme";

/**
 * 버튼의 역할.
 *
 * 배경색이 아니라 "화면에서 이 버튼이 무슨 무게인가"로 나눈다. 같은 주황이라도
 * 화면의 주 행동과 보조 행동은 다른 variant다.
 */
type ButtonVariant = "primary" | "secondary" | "neutral" | "danger";

/** 높이 단계. 값은 `tokens.js`의 `size.control`. */
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * 진행 중 표시. 아이콘 자리에 스피너가 들어가고 라벨은 그대로 남는다.
   * 라벨까지 지우면 버튼 폭이 줄어 옆 요소가 밀린다.
   */
  loading?: boolean;
  disabled?: boolean;
  /**
   * 아이콘을 노드가 아니라 함수로 받는 이유.
   *
   * 노드로 받으면 호출부가 색과 크기를 정하게 되고, "주황 버튼 위 아이콘은 흰색"이라는
   * 규칙이 버튼 밖으로 새어 나간다. 크기와 색은 variant · size가 정해서 넘겨주고,
   * 호출부는 어떤 글리프인지만 고른다.
   */
  renderIcon?: (iconProps: { size: number; color: string }) => ReactNode;
  /**
   * 화면에서 유일한 주요 행동일 때만 그림자를 올린다.
   * 버튼마다 뜨면 어느 것이 주 행동인지 그림자가 말해주지 못한다.
   */
  elevated?: boolean;
  /** 바깥 여백·너비처럼 화면마다 다른 배치만 넘긴다(`mt-section`, `w-full`, `flex-1`). */
  className?: string;
  /** 누른 뒤 어디로 가는지가 화면마다 다를 때 덧붙인다. */
  accessibilityHint?: string;
  /** 라벨이 화면 맥락 없이는 뜻이 통하지 않을 때만 따로 준다. 기본값은 `label`이다. */
  accessibilityLabel?: string;
};

const VARIANT_STYLES = {
  primary: {
    fill: "solid",
    container: "border border-transparent bg-brand-cta",
    label: "text-white",
    foreground: colors.surface.DEFAULT,
  },
  secondary: {
    fill: "outline",
    container: "border border-brand-300 bg-surface",
    // 흰 배경 위 주황 글자는 500(3.01:1)이 아니라 700(5.10:1)이어야 본문 대비를 넘긴다.
    label: "text-brand-text",
    foreground: colors.brand.text,
  },
  neutral: {
    fill: "outline",
    container: "border border-line bg-surface",
    label: "text-ink",
    foreground: colors.ink.DEFAULT,
  },
  /**
   * 되돌릴 수 없는 행동 — 시험 나가기, 기록 삭제.
   *
   * 채움이 아니라 외곽선인 것이 이 앱의 규칙이다. `ConfirmModal`이 "파괴적인 쪽을
   * 시각적 기본값으로 두지 않는다"고 정해 두었고, 실제로 되돌아가는 쪽이 채움 버튼을
   * 가져간다. 빨강으로 채운 버튼은 앱 전체에서 dev 전용 진단 화면 한 곳뿐이다.
   *
   * `exam.danger`는 이름 그대로 시험 화면 전용으로 정의된 색이다. 시험 밖에서 이
   * variant가 처음 필요해지면 색을 `exam`에서 꺼내 공용 의미색으로 올린 뒤 여기를 바꾼다.
   * 지금 미리 옮기지 않는 이유는 색이 옮겨가도 쓰는 곳이 늘지 않기 때문이다.
   */
  danger: {
    fill: "outline",
    container: "border border-exam-dangerLine bg-surface",
    label: "text-exam-danger",
    foreground: colors.exam.danger,
  },
} as const satisfies Record<
  ButtonVariant,
  { fill: "solid" | "outline"; container: string; label: string; foreground: string }
>;

const SIZE_STYLES = {
  sm: { container: "min-h-control-sm gap-xs px-md", label: "text-sm", icon: size.icon.sm },
  md: { container: "min-h-control-md gap-content px-lg", label: "text-base", icon: size.icon.md },
  lg: { container: "min-h-control-lg gap-content px-xl", label: "text-base", icon: size.icon.md },
} as const satisfies Record<
  ButtonSize,
  { container: string; label: string; icon: number }
>;

/**
 * 비활성 상태.
 *
 * variant의 **채움 여부를 유지한다.** 외곽선 버튼이 비활성일 때 회색으로 채워지면
 * 같은 버튼이 상태에 따라 다른 종류의 버튼으로 보인다. 색만 힘을 잃고 형태는 남아야
 * 사용자가 "같은 버튼인데 지금은 못 누른다"로 읽는다.
 *
 * 글자색이 둘로 갈리는 이유는 배경이 다르기 때문이다. `ink.disabled`(#9CA3AF)는
 * `line`(#E5E7EB) 위에서 1.87:1이라 읽히지 않지만 흰 배경 위에서는 2.54:1로 읽힌다.
 * 채움 쪽은 한 단계 진한 `ink.muted`(#E5E7EB 위 4.02:1)를 쓴다.
 * WCAG가 비활성 컨트롤을 대비 기준에서 빼주더라도 라벨은 정보다.
 */
const DISABLED_STYLES = {
  solid: {
    container: "border border-transparent bg-line",
    label: "text-ink-muted",
    foreground: colors.ink.muted,
  },
  outline: {
    container: "border border-line bg-surface",
    label: "text-ink-disabled",
    foreground: colors.ink.disabled,
  },
} as const;

/**
 * 앱의 모든 버튼.
 *
 * 만들기 전에는 같은 "브랜드 CTA"가 `rounded-2xl bg-brand-cta py-4` ·
 * `rounded-full bg-brand px-6 py-3` · `rounded-2xl bg-brand px-6 py-4`처럼 화면마다
 * 다른 문자열로 59곳에 흩어져 있었다. `bg-brand`(500)와 `bg-brand-cta`(같은 500)가
 * 섞여 있던 것처럼, 같은 값을 가리키는 다른 이름까지 함께 굳고 있었다.
 *
 * 색 · 높이 · 반경은 프롭으로 열지 않고 variant · size가 정한다. 호출부가 정하는 것은
 * **배치**(`className`)뿐이다 — `StartMockExamButton`이 세운 규칙을 그대로 따른다.
 *
 * 모서리는 `rounded-control`(16px) 하나다. 알약(`rounded-full`)과 사각이 섞여 있던 것을
 * 사각으로 모았다. `rounded-pill` 토큰이 남아 있는 것은 원형 아이콘 버튼과 배지를 위한
 * 것이지, 라벨이 붙은 버튼의 선택지가 아니다.
 *
 * 터치 피드백은 `Pressable`이 이미 통일하고 있으므로 여기서 다시 다루지 않는다.
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  size: sizeName = "md",
  loading = false,
  disabled = false,
  renderIcon,
  elevated = false,
  className,
  accessibilityHint,
  accessibilityLabel,
}: ButtonProps) {
  const isInert = disabled || loading;
  const sizeStyle = SIZE_STYLES[sizeName];
  const activeStyle = VARIANT_STYLES[variant];
  const variantStyle = isInert ? DISABLED_STYLES[activeStyle.fill] : activeStyle;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      // sm은 hitTarget(44)보다 낮으므로 모자란 만큼 위아래로 터치 영역을 넓힌다.
      hitSlop={
        sizeName === "sm" ? (size.hitTarget - size.control.sm) / 2 : undefined
      }
      accessibilityState={{ busy: loading, disabled }}
      className={`flex-row items-center justify-center rounded-control ${sizeStyle.container} ${variantStyle.container} ${className ?? ""}`}
      disabled={isInert}
      style={elevated && !isInert ? shadows.card : undefined}
      onPress={onPress}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.foreground} size="small" />
      ) : (
        renderIcon?.({ color: variantStyle.foreground, size: sizeStyle.icon })
      )}
      <Text className={`${sizeStyle.label} ${variantStyle.label}`}>{label}</Text>
    </Pressable>
  );
}
