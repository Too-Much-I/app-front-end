import { Image, View, type ImageSourcePropType } from "react-native";

import { Sparkle, type SparkleProps } from "@/components/ui/Sparkle";

/** 빈 이력의 마스코트 주변에 홈 인사 영역과 같은 색 조합으로 흩뿌리는 반짝임. */
const EMPTY_HISTORY_SPARKLES: SparkleProps[] = [
  { className: "left-[7%] top-4", size: "2xl", colorClassName: "text-sky-300" },
  { className: "right-[9%] top-2", size: "xl", colorClassName: "text-brand-300" },
  { className: "left-[14%] top-[118px]", size: "lg", colorClassName: "text-yellow-400" },
  { className: "right-[10%] top-[132px]", size: "2xl", colorClassName: "text-sky-400" },
  { className: "left-[24%] top-[66px]", size: "sm", colorClassName: "text-brand-200" },
  { className: "right-[23%] top-[76px]", size: "base", colorClassName: "text-yellow-300" },
];

/**
 * 빈 상태 카드 위쪽의 마스코트 자리.
 *
 * 두 빈 상태(모의고사·재답변)가 마스코트만 다르고 배치와 반짝임이 같다. 좌표가 서로
 * 어긋나면 탭을 오갈 때 그림이 튀므로 한 컴포넌트로 묶는다.
 */
export function EmptyHistoryIllustration({
  mascot,
}: {
  mascot: ImageSourcePropType;
}) {
  return (
    <View className="relative h-52 w-full max-w-sm overflow-hidden">
      <Image
        accessible={false}
        source={mascot}
        style={{
          bottom: 0,
          height: "100%",
          left: "29%",
          position: "absolute",
          width: "42%",
          zIndex: 10,
        }}
        resizeMode="contain"
      />
      {EMPTY_HISTORY_SPARKLES.map((sparkle) => (
        <Sparkle key={sparkle.className} {...sparkle} />
      ))}
    </View>
  );
}
