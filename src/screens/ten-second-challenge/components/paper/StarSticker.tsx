import { FontAwesome } from "@expo/vector-icons";
import { View } from "react-native";

import { colors } from "@/theme";

/** 흰 테두리를 만드는 뒷별과 앞별의 크기 차이. */
const OUTLINE_SIZE = 38;
const STAR_SIZE = 30;

/**
 * 카드 모서리에 붙인 별 스티커.
 *
 * 흰 테두리는 아이콘 하나로 안 나와서 흰 별 위에 노란 별을 겹쳐 만든다. 스티커라서
 * 카드 밖으로 튀어나와야 하고, 그래서 부모는 클리핑하지 않는 겹이어야 한다.
 */
export function StarSticker() {
  return (
    <View
      accessibilityElementsHidden
      className="absolute -left-1 -top-3 items-center justify-center"
      pointerEvents="none"
      style={{ transform: [{ rotate: "-12deg" }] }}
    >
      <FontAwesome color={colors.surface.DEFAULT} name="star" size={OUTLINE_SIZE} />
      <View className="absolute">
        <FontAwesome color={colors.challenge.star} name="star" size={STAR_SIZE} />
      </View>
    </View>
  );
}
