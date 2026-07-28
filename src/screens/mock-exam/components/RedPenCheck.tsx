import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/theme";

/** 기준 크기. 다른 크기를 주면 아래 좌표가 같은 비율로 늘어난다. */
const BASE_SIZE = 26;

/**
 * 체크 획 두 개의 시작점·길이·각도.
 *
 * 폰트의 ✓ 글리프를 쓰지 않는 이유: 글리프는 획이 균일하고 각도가 고정이라
 * 다섯 줄에 같은 도장을 찍은 것처럼 보인다. 손으로 그은 자국은 두 획의 각도가
 * 어긋나 있고 짧은 획이 먼저 그어진다.
 */
const SHORT_STROKE = { x: 4, y: 12, length: 11, degrees: 48 };
const LONG_STROKE = { x: 11.4, y: 20.2, length: 19.5, degrees: -56 };
const THICKNESS = 2.6;

const SHORT_DURATION_MS = 130;
const LONG_DURATION_MS = 210;

interface StrokeProps {
  degrees: number;
  delayMs: number;
  durationMs: number;
  length: number;
  scale: number;
  x: number;
  y: number;
}

/**
 * 획 하나.
 *
 * 회전은 View의 중심을 기준으로 일어나므로, 획의 시작점에 0×0 피벗을 두고
 * 그 피벗을 회전시킨 뒤 획은 피벗에서 오른쪽으로 그린다. 그래야 길이가 0에서
 * 자라날 때 시작점이 제자리에 남는다(가운데에서 양쪽으로 벌어지지 않는다).
 */
function Stroke({ degrees, delayMs, durationMs, length, scale, x, y }: StrokeProps) {
  const drawn = useSharedValue(0);
  const thickness = THICKNESS * scale;
  const fullLength = length * scale;

  useEffect(() => {
    drawn.value = withDelay(
      delayMs,
      withTiming(1, { duration: durationMs, easing: Easing.out(Easing.quad) }),
    );
  }, [delayMs, drawn, durationMs]);

  const strokeStyle = useAnimatedStyle(() => ({ width: fullLength * drawn.value }));

  return (
    <View
      className="absolute"
      style={{
        left: x * scale,
        top: y * scale,
        width: 0,
        height: 0,
        transform: [{ rotate: `${degrees}deg` }],
      }}
    >
      <Animated.View
        style={[
          {
            position: "absolute",
            left: 0,
            top: -thickness / 2,
            height: thickness,
            borderRadius: thickness / 2,
            backgroundColor: colors.grading.ink,
          },
          strokeStyle,
        ]}
      />
    </View>
  );
}

export interface RedPenCheckProps {
  /** 그리기 시작을 늦춘다. 여러 줄이 동시에 그어지면 손으로 쓴 것으로 안 보인다. */
  delayMs?: number;
  size?: number;
  /** 획 전체를 기울인다. 줄마다 다른 값을 줘서 같은 도장으로 안 보이게 한다. */
  tiltDegrees?: number;
}

/** 답안지 여백에 빨간펜으로 그은 체크 자국. */
export function RedPenCheck({
  delayMs = 0,
  size = BASE_SIZE,
  tiltDegrees = 0,
}: RedPenCheckProps) {
  const scale = size / BASE_SIZE;

  return (
    <View
      style={{ width: size, height: size, transform: [{ rotate: `${tiltDegrees}deg` }] }}
    >
      <Stroke
        degrees={SHORT_STROKE.degrees}
        delayMs={delayMs}
        durationMs={SHORT_DURATION_MS}
        length={SHORT_STROKE.length}
        scale={scale}
        x={SHORT_STROKE.x}
        y={SHORT_STROKE.y}
      />
      <Stroke
        degrees={LONG_STROKE.degrees}
        delayMs={delayMs + SHORT_DURATION_MS}
        durationMs={LONG_DURATION_MS}
        length={LONG_STROKE.length}
        scale={scale}
        x={LONG_STROKE.x}
        y={LONG_STROKE.y}
      />
    </View>
  );
}
