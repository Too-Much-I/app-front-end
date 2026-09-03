import { Image, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import {
  CARROT_HEIGHT,
  CARROT_WIDTH,
  CHALLENGE_STAGE_STOP_SIZE,
  DONE_CARROT_HEIGHT,
  DONE_CARROT_WIDTH,
  HOLE_HEIGHT,
  HOLE_WIDTH,
} from "@/screens/challenge/challenge-stage-layout";
import type { ChallengeStageCardStatus } from "@/screens/challenge/challenge-stage-status";

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const hole = require("../../../../public/challenge/hole.png");
const carrot = require("../../../../public/challenge/carrot.png");

interface ChallengeStageStopProps {
  questionNumber: number;
  status: ChallengeStageCardStatus;
  /** 어디로 가는지는 스테이지가 정한다. 이 조각이 라우트를 알면 이 화면 밖에서 못 쓴다. */
  onPress: () => void;
}

const STATUS_HINT: Record<ChallengeStageCardStatus, string> = {
  next: "10초 안에 이 문장을 영어로 말합니다",
  done: "이 문장의 채점 결과를 봅니다",
  locked: "앞 문장을 마치면 열립니다",
};

/**
 * 구덩이 하나와 그 위의 당근.
 *
 * 아직 안 뽑은 문장은 땅에 꽂힌 당근으로, 이미 푼 문장은 빈 구덩이 옆에 눕혀둔 당근으로
 * 그린다. 구덩이는 상태와 무관하게 늘 같은 그림이라 아래에 깔고, 바뀌는 것은 당근뿐이다.
 *
 * 아직 차례가 아닌 문장은 흐리게만 두고 자물쇠를 얹지 않는다. 세 자리가 한 화면에 같이
 * 보여서 어디까지 왔는지는 색만으로 읽히고, 자물쇠는 밭 그림에 어울리지 않는다.
 */
export function ChallengeStageStop({
  questionNumber,
  status,
  onPress,
}: ChallengeStageStopProps) {
  const isLocked = status === "locked";

  return (
    <Pressable
      accessibilityHint={STATUS_HINT[status]}
      accessibilityLabel={`${questionNumber}번째 문장`}
      accessibilityRole="button"
      accessibilityState={{ disabled: isLocked }}
      // 아직 차례가 아닌 문장은 눌리지 않는다. 눌러서 보내면 서버가 순서로 막고
      // 사용자는 문제 화면을 스쳐 지나 되돌아온다 — 스테이지가 그 왕복을 없애는 화면이다.
      disabled={isLocked}
      onPress={onPress}
      style={{ width: CHALLENGE_STAGE_STOP_SIZE.width, height: CHALLENGE_STAGE_STOP_SIZE.height }}
    >
      <Image
        accessibilityElementsHidden
        resizeMode="contain"
        source={hole}
        style={{
          position: "absolute",
          left: 0,
          top: (CHALLENGE_STAGE_STOP_SIZE.height - HOLE_HEIGHT) / 2,
          width: HOLE_WIDTH,
          height: HOLE_HEIGHT,
        }}
      />

      {status === "done" ? (
        // 뽑아서 구덩이 옆에 눕혀둔 당근.
        <Image
          accessibilityElementsHidden
          resizeMode="contain"
          source={carrot}
          style={{
            position: "absolute",
            right: -14,
            // 구덩이 한가운데보다 조금 아래. 굴러 나온 자리로 보이게 한다.
            top: CHALLENGE_STAGE_STOP_SIZE.height / 2 - DONE_CARROT_HEIGHT / 2 + 8,
            width: DONE_CARROT_WIDTH,
            height: DONE_CARROT_HEIGHT,
            transform: [{ rotate: "115deg" }],
          }}
        />
      ) : (
        <View
          style={{
            position: "absolute",
            left: (CHALLENGE_STAGE_STOP_SIZE.width - CARROT_WIDTH) / 2,
            // 뿌리 끝이 구덩이 한가운데에 잠기는 높이.
            bottom: CHALLENGE_STAGE_STOP_SIZE.height / 2 - 10,
            width: CARROT_WIDTH,
            height: CARROT_HEIGHT,
            opacity: isLocked ? 0.4 : 1,
          }}
        >
          <Image
            accessibilityElementsHidden
            className="absolute h-full w-full"
            resizeMode="contain"
            source={carrot}
          />
          {/* 번호는 뿌리 가운데에. 잎이 위쪽 4할을 차지해서 그만큼 내려야 뿌리에 온다. */}
          <View className="absolute inset-x-0 top-[40%] items-center">
            <Text className="text-lg text-white">{questionNumber}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}
