import { Text } from "react-native";

type SparkleSize = "sm" | "base" | "lg" | "xl" | "2xl";

const SIZE_CLASS: Record<SparkleSize, string> = {
  sm: "text-xs",
  base: "text-sm",
  lg: "text-base",
  xl: "text-xl",
  "2xl": "text-2xl",
};

export type SparkleProps = {
  /** 카드 안에서의 위치. 부모가 `relative`여야 하며, 절대 위치 클래스(top-, right- 등)만 넘긴다. */
  className: string;
  size?: SparkleSize;
  /** 색/불투명도 클래스. 배경마다 대비가 달라 고정 팔레트 대신 자유롭게 받는다. */
  colorClassName?: string;
};

/**
 * 마스코트 주변에 흩뿌리는 장식용 반짝임 하나.
 * 위치는 호출부에서 className으로, 크기는 프리셋으로, 색은 배경에 맞춰 colorClassName으로 받는다.
 */
export function Sparkle({ className, size = "sm", colorClassName = "text-brand-300" }: SparkleProps) {
  return <Text className={`absolute ${SIZE_CLASS[size]} ${colorClassName} ${className}`}>✦</Text>;
}
