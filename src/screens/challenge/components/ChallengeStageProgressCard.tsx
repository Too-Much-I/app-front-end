import { Image, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { shadows } from "@/theme";

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const carrot = require("../../../../public/challenge/carrot.png");

interface ChallengeStageProgressCardProps {
  solvedCount: number;
  totalCount: number;
  /** 다 풀었는가. `solvedCount === totalCount`로도 알 수 있지만 문구가 갈리는 곳이 여기뿐이다. */
  isCompleted: boolean;
}

/**
 * 오늘 몇 개를 뽑았는지.
 *
 * 밭 그림만으로도 진행도는 읽히지만 세어야 알 수 있다. 숫자를 위에 한 번 더 두어
 * 화면을 열자마자 "1 / 3"이 눈에 들어오게 한다.
 */
export function ChallengeStageProgressCard({
  solvedCount,
  totalCount,
  isCompleted,
}: ChallengeStageProgressCardProps) {
  return (
    <View
      accessibilityLabel={`오늘 ${totalCount}문장 중 ${solvedCount}문장 완료`}
      accessible
      className="flex-row items-center gap-3 self-start rounded-3xl bg-surface py-3 pl-4 pr-6"
      style={shadows.card}
    >
      <Image
        accessibilityElementsHidden
        className="h-9 w-6"
        resizeMode="contain"
        source={carrot}
      />

      <View>
        <Text className="text-xs text-ink-muted">오늘 완료</Text>
        <View className="flex-row items-end gap-2">
          {/* 푼 수와 전체 수는 같은 크기다. 앞 숫자만 키우면 "1"이 제목처럼 읽혀서
              "1 / 3"이 한 덩어리의 분수로 보이지 않는다. 강조는 주황 하나로 충분하다. */}
          <Text className="text-lg text-brand-cta">{solvedCount}</Text>
          <Text className="text-lg text-ink">/ {totalCount}</Text>
          <Text className="pb-1 pl-1 text-xs text-ink-muted">
            {isCompleted ? "완료" : "진행 중"}
          </Text>
        </View>
      </View>
    </View>
  );
}
