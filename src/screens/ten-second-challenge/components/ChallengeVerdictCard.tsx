import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "@/components/ui/Text";
import { StarSticker } from "@/screens/ten-second-challenge/components/paper/StarSticker";
import { shadows } from "@/theme";

interface ChallengeVerdictCardProps {
  /** 토선생의 한마디 본문. 화면에서 가장 먼저 읽히는 문장이다. */
  message: string;
  /** 본문 아래에 덧붙일 것 — 채점 중 자리 표시 등. 같은 흰 상자 안에 들어간다. */
  children?: ReactNode;
  /** 종이 밖으로 나가는 장식. 별 스티커는 이 카드의 일부라 여기서 직접 그린다. */
  decoration?: ReactNode;
}

/**
 * 결과 화면 맨 위의 판정 카드.
 *
 * 노란 색면을 쓰는 자리는 화면에 여기 하나뿐이다. 아래 문장 카드들이 민트·하늘로
 * 갈리는 것과 달리 이 카드는 "무엇을 먼저 읽어야 하는가"를 색으로 말한다.
 *
 * 문장 카드와 같은 이유로 겹이 둘이다 — 안쪽은 클리핑, 바깥은 별 스티커와 테이프가
 * 카드 밖으로 나갈 수 있게 열어둔다.
 */
export function ChallengeVerdictCard({
  message,
  children,
  decoration,
}: ChallengeVerdictCardProps) {
  return (
    <View>
      <View className="overflow-hidden rounded-3xl bg-challenge-verdict" style={shadows.card}>
        <View className="gap-3 p-4">
          {/* 문장 카드와 같은 구조 — 글은 흰 상자에, 색은 그것을 감싸는 테두리에. */}
          <View className="gap-3 rounded-2xl bg-surface px-4 py-4">
            <Text className="text-center text-lg leading-8">{message}</Text>
            {children}
          </View>
        </View>
      </View>

      <StarSticker />
      {decoration}
    </View>
  );
}
