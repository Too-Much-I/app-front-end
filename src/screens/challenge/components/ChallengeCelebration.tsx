import { Image, View } from "react-native";

import { colors } from "@/theme";

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const graduateTurtle = require("../../../../public/mascots/graduate_turtle.png");

/**
 * 흩날리는 색종이 한 조각씩.
 *
 * 좌표를 밖으로 열지 않는다 — 조각이 마스코트를 피해 놓인 배치 자체가 이 컴포넌트의
 * 내용이라, 호출부가 숫자를 바꾸면 조각이 거북이 얼굴 위로 올라간다. 위치는 백분율이라
 * 화면 너비가 달라져도 좌우 균형이 유지된다.
 */
const CONFETTI = [
  { top: 4, left: "10%", size: 13, rotate: "24deg", color: colors.challenge.confetti.mint },
  { top: 26, left: "20%", size: 10, rotate: "-16deg", color: colors.challenge.confetti.pink },
  { top: 62, left: "8%", size: 15, rotate: "40deg", color: colors.challenge.confetti.pink },
  { top: 96, left: "16%", size: 9, rotate: "-8deg", color: colors.challenge.confetti.yellow },
  { top: 8, left: "76%", size: 14, rotate: "-28deg", color: colors.challenge.confetti.yellow },
  { top: 40, left: "88%", size: 10, rotate: "18deg", color: colors.challenge.confetti.sky },
  { top: 74, left: "80%", size: 13, rotate: "-36deg", color: colors.challenge.confetti.mint },
  { top: 104, left: "72%", size: 9, rotate: "12deg", color: colors.challenge.confetti.sky },
] as const;

/**
 * 문장을 끝낸 것을 축하하는 자리.
 *
 * 졸업모를 쓴 거북이와 흩날리는 색종이. 채점이 끝난 화면에서만 쓰고, 기다리는 중이거나
 * 실패한 화면은 각자의 마스코트와 안내 문구를 그대로 쓴다 — 아직 축하할 일이 아니다.
 *
 * 조각은 정지해 있다. 떨어지는 움직임을 넣으려면 화면에 들어올 때 한 번만 재생해야
 * 하는데(반복되면 읽는 동안 계속 시선을 끈다) 그 타이밍은 결과 도착 시점과 묶여 있다.
 */
export function ChallengeCelebration() {
  return (
    <View accessibilityElementsHidden className="h-40 items-center justify-end">
      {CONFETTI.map((piece, index) => (
        <View
          key={index}
          pointerEvents="none"
          style={{
            position: "absolute",
            top: piece.top,
            left: piece.left,
            width: piece.size,
            height: piece.size * 0.7,
            borderRadius: 2,
            backgroundColor: piece.color,
            transform: [{ rotate: piece.rotate }],
          }}
        />
      ))}

      {/*
        원본은 전신이 다 들어간 이미지라 그대로 두면 얼굴이 작다. 이미지를 키운 뒤
        상자로 **아래쪽만** 잘라 표정을 키운다.

        이미지를 위로 밀지 않는다. 밀면 학사모 끝이 먼저 잘리는데, 졸업모는 "다 끝냈다"는
        신호라 다리보다 먼저 지켜야 하는 부분이다. 상자를 이미지보다 낮게 두는 것만으로
        하반신이 잘리고 위쪽은 그대로 남는다.
      */}
      <View className="h-40 w-44 items-center overflow-hidden">
        <Image className="h-56 w-56" resizeMode="contain" source={graduateTurtle} />
      </View>
    </View>
  );
}
