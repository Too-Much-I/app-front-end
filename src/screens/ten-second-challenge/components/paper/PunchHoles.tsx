import { View } from "react-native";

import { colors } from "@/theme";

/**
 * 구멍이 놓이는 자리.
 *
 * 좌표를 prop으로 열지 않고 두 가지로 고정한다 — 노트는 아래에 뜯긴 자국이 있어 여유가
 * 더 필요하고, 카드는 위아래 같은 간격이면 된다. 호출부가 px를 정하기 시작하면 같은
 * 구멍이 화면마다 다른 자리에 뚫린다.
 */
export type PunchHolesFit = "note" | "card";

const FIT_INSET: Record<PunchHolesFit, string> = {
  note: "bottom-6 top-5 left-2",
  /** 카드는 구멍을 가장자리에 걸쳐 뚫는다 — 부모가 클리핑해 반원만 남는다. */
  card: "inset-y-4 -left-1",
};

/** 자리에 맞는 구멍 수. `justify-between`이라 카드가 길어지면 간격이 벌어진다. */
const FIT_COUNT: Record<PunchHolesFit, number> = {
  note: 16,
  card: 4,
};

interface PunchHolesProps {
  /**
   * 구멍 뒤에 비치는 색.
   *
   * 구멍은 "종이를 파낸 자리"라서 뒤에 무엇이 있는지를 부모만 안다 — 노트는 크림 대지,
   * 결과 카드는 화면 배경이다. 좌표와 달리 이 값은 부모가 정하는 게 맞다.
   */
  carvedFrom: string;
  fit?: PunchHolesFit;
}

/**
 * 종이 왼쪽 가장자리의 펀치 구멍.
 *
 * 부모가 `overflow-hidden`이면 구멍의 바깥쪽이 잘려 반원으로 보이고, 아니면 온전한
 * 타원이 남는다. 즉 같은 컴포넌트가 부모의 클리핑 정책에 따라 다르게 보인다.
 */
export function PunchHoles({ carvedFrom, fit = "card" }: PunchHolesProps) {
  return (
    <View
      accessibilityElementsHidden
      className={`absolute z-10 justify-between ${FIT_INSET[fit]}`}
      pointerEvents="none"
    >
      {Array.from({ length: FIT_COUNT[fit] }, (_, index) => index).map((index) => (
        <View
          className="h-3.5 w-2.5 rounded-full border"
          key={index}
          style={{ backgroundColor: carvedFrom, borderColor: colors.challenge.holeEdge }}
        />
      ))}
    </View>
  );
}
