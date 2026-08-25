import { Feather } from "@expo/vector-icons";
import { Image, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { colors } from "@/theme";

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const logo = require("../../../../public/logo.png");

interface ChallengeHeaderProps {
  /** 없으면 닫기 버튼을 숨긴다 — 제출 중처럼 화면을 벗어날 수 없는 동안. */
  onClose?: () => void;
}

/**
 * 워드마크와 화면 이름을 세로줄로 잇는 가벼운 헤더.
 *
 * 응시·재답변의 `ShardHeader`(주황 띠 + 네이비 조각)를 쓰지 않는다. 저 띠는 시험이
 * 시작됐다는 신호이고, 챌린지는 크림 배경 위에서 노트 한 장만 보이는 화면이라
 * 위쪽에 강한 색면이 들어오면 노트가 주인공 자리를 뺏긴다.
 */
export function ChallengeHeader({ onClose }: ChallengeHeaderProps) {
  const { top: topInset } = useSafeAreaInsets();

  return (
    <View className="bg-surface-subtle" style={{ paddingTop: topInset }}>
      <View className="h-14 flex-row items-center justify-center">
        {onClose ? (
          <Pressable
            accessibilityHint="이 문장을 그만두고 이전 화면으로 돌아갑니다"
            accessibilityLabel="10초 챌린지 닫기"
            accessibilityRole="button"
            className="absolute left-3 h-11 w-11 items-center justify-center rounded-full"
            onPress={onClose}
          >
            <Feather color={colors.ink.DEFAULT} name="x" size={23} />
          </Pressable>
        ) : null}

        <Image
          accessibilityElementsHidden
          className="h-7 w-8"
          resizeMode="contain"
          source={logo}
        />
        {/* 로고 옆 "토선생"은 홈 화면과 같은 이유로 광학 중심을 1.5px 내린다. */}
        <Text className="relative top-[1.5px] ml-1.5 text-lg text-brand-text">토선생</Text>
        <View className="mx-3 h-4 w-px bg-line" />
        <Text accessibilityRole="header" className="text-lg">
          10초 챌린지
        </Text>
      </View>
    </View>
  );
}
