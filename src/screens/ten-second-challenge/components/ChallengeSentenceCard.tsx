import { Feather } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "@/components/ui/Text";
import { PunchHoles } from "@/screens/ten-second-challenge/components/paper/PunchHoles";
import { colors, shadows } from "@/theme";

export type SentenceCardTone = "mint" | "sky";

/**
 * 톤이 고르는 것은 색뿐이다. 값은 여기 묶여 있어서 호출부는 "무슨 문장인가"만 말한다.
 */
const TONE = {
  mint: {
    surface: "bg-challenge-mint-surface",
    label: "bg-challenge-mint-label",
    text: "text-challenge-mint-text",
    icon: colors.challenge.mint.text,
  },
  sky: {
    surface: "bg-sky-surface",
    label: "bg-sky-line",
    text: "text-sky-text",
    icon: colors.sky.text,
  },
} satisfies Record<SentenceCardTone, { surface: string; label: string; text: string; icon: string }>;

interface ChallengeSentenceCardProps {
  tone: SentenceCardTone;
  /** 칩에 들어가는 이름 — "내 문장", "추천 표현". */
  label: string;
  /** 칩 옆에 붙는 안내. 이 카드에서 할 수 있는 일이 있을 때만 넘긴다. */
  hint?: string;
  /**
   * 종이 밖으로 나가는 장식 — 테이프, 스티커.
   *
   * 좌표를 prop으로 받는 대신 슬롯으로 연다. 장식은 자기 자리를 스스로 알고 있고,
   * 이 카드는 "클리핑하지 않는 겹"만 제공한다.
   */
  decoration?: ReactNode;
  children: ReactNode;
}

/**
 * 문장 한 개를 담는 결과 화면의 카드.
 *
 * 겹이 둘인 이유는 `overflow` 정책이 서로 반대이기 때문이다. 안쪽 종이는 클리핑해야
 * 펀치 구멍이 반원으로 잘리고, 바깥 겹은 클리핑하지 않아야 테이프가 종이 밖으로 나간다.
 *
 * 여백은 종이 안쪽 래퍼만 갖는다. RN에서 절대배치 오프셋은 부모의 패딩 안쪽부터
 * 잡히기 때문에, 패딩이 있는 View를 장식의 기준으로 삼으면 가장자리에 붙이려던 것이
 * 내용 위로 올라탄다. 왼쪽 `pl-6`은 구멍을 피해 내용이 시작하는 자리다.
 *
 * 글은 색면에 직접 쓰지 않고 흰 상자에 담는다. 색은 "무슨 문장인가"를 구분하는 표지라
 * 글의 배경까지 맡으면 카드마다 본문 대비가 달라진다.
 */
export function ChallengeSentenceCard({
  tone,
  label,
  hint,
  decoration,
  children,
}: ChallengeSentenceCardProps) {
  const palette = TONE[tone];

  return (
    <View>
      <View
        className={`overflow-hidden rounded-3xl ${palette.surface}`}
        style={shadows.card}
      >
        {/* 카드는 화면 배경 위에 놓이므로 구멍 뒤에 비치는 것도 화면 배경이다. */}
        <PunchHoles carvedFrom={colors.surface.subtle} />

        <View className="gap-2 py-4 pl-6 pr-4">
          <View className="flex-row items-center gap-2">
            <View
              className={`flex-row items-center gap-1.5 rounded-lg px-2.5 py-1 ${palette.label}`}
            >
              <Feather color={palette.icon} name="star" size={12} />
              <Text className={`text-xs ${palette.text}`}>{label}</Text>
            </View>

            {hint ? (
              <Text className={`flex-1 text-[11px] ${palette.text}`}>{hint}</Text>
            ) : null}
          </View>

          {/* 글은 흰 바탕 위에 얹고 색 카드가 그것을 감싼다. */}
          <View className="rounded-2xl bg-surface px-4 py-3">{children}</View>
        </View>
      </View>

      {decoration}
    </View>
  );
}
