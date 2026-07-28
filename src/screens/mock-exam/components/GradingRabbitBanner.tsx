import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/theme";

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
//
// webm(VP9)이 아니라 mp4(H.264)를 쓴다. 같은 파일 하나로 iOS·Android·웹이 모두
// 재생되기 때문에 플랫폼 분기도, 번들에 두 벌을 싣는 일도 없다.
const runningRabbitVideo = require("../../../../public/mascots/running_rabbit.mp4");
const runningRabbitPoster = require("../../../../public/mascots/running_rabbit_poster.jpg");

const BANNER_HEIGHT = 200;
/** 영상이 720×720 정사각이라 배너 높이에 맞춘 정사각으로 놓는다. */
const VIDEO_SIZE = BANNER_HEIGHT;

const DASH_DURATION_MS = 900;
/** 선이 왼쪽으로 흘러가는 거리. 시작점보다 왼쪽으로 이만큼 이동한 뒤 사라진다. */
const DASH_TRAVEL = 74;

/**
 * 토끼 뒤로 흐르는 속도선.
 *
 * `top`은 배너 기준 세로 위치, `gap`은 영상 왼쪽 모서리에서 더 떨어뜨릴 거리.
 * 길이·높이·시작 시점을 흩어놔야 세 줄이 한 덩어리로 움직이지 않는다.
 */
const SPEED_LINES = [
  { top: 66, width: 34, gap: 4, delayMs: 0 },
  { top: 104, width: 22, gap: 18, delayMs: 300 },
  { top: 140, width: 40, gap: 0, delayMs: 600 },
] as const;

function SpeedLine({ top, width, gap, delayMs }: (typeof SPEED_LINES)[number]) {
  const travel = useSharedValue(0);

  useEffect(() => {
    travel.value = withRepeat(
      withTiming(1, { duration: DASH_DURATION_MS, easing: Easing.linear }),
      -1,
    );
  }, [travel]);

  const lineStyle = useAnimatedStyle(() => {
    // 각 선이 서로 다른 지점에서 출발하도록 시작 시점만큼 위상을 밀어둔다.
    const phase = (travel.value + delayMs / DASH_DURATION_MS) % 1;
    return {
      transform: [{ translateX: -phase * DASH_TRAVEL }],
      // 양 끝에서 자연스럽게 사라지도록 가운데가 가장 진하다.
      opacity: Math.sin(phase * Math.PI),
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top,
          // 오른쪽 끝을 배너 중앙에서 영상 반폭만큼 왼쪽으로 — 즉 영상 왼쪽 모서리에 붙인다.
          right: "50%",
          marginRight: VIDEO_SIZE / 2 + gap,
          width,
          height: 3,
          borderRadius: 2,
          backgroundColor: colors.brand[300],
        },
        lineStyle,
      ]}
    />
  );
}

/**
 * 화면 위쪽의 "달리는 토끼" 띠.
 *
 * 영상 배경이 흰색이고 알파 채널이 없어서(yuv420p), 배너 배경을 흰색으로 맞춰
 * 영상의 네모난 경계가 보이지 않게 한다. 흰 토끼를 키잉으로 도려낼 수는 없다 —
 * 토끼 몸통도 흰색이라 배경만 골라낼 방법이 없다.
 *
 * 영상이 준비되기 전에는 첫 프레임을 뽑아둔 포스터를 덮어둔다. 재생이 실패해도
 * 포스터가 그대로 남아서, 최악의 경우에도 빈 흰 칸이 되지는 않는다.
 */
export function GradingRabbitBanner() {
  const [hasRenderedFrame, setHasRenderedFrame] = useState(false);

  const player = useVideoPlayer(runningRabbitVideo, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });

  return (
    <View
      accessible
      accessibilityLabel="채점하러 달려가는 토끼"
      accessibilityRole="image"
      className="items-center justify-center overflow-hidden bg-surface"
      style={{ height: BANNER_HEIGHT }}
    >
      <View pointerEvents="none">
        <VideoView
          allowsPictureInPicture={false}
          contentFit="contain"
          nativeControls={false}
          player={player}
          // 첫 프레임이 실제로 그려진 순간에만 포스터를 걷는다. 재생 준비(readyToPlay)를
          // 신호로 쓰면 아직 아무것도 안 그려진 빈 칸이 한 프레임 스칠 수 있다.
          onFirstFrameRender={() => setHasRenderedFrame(true)}
          style={{ width: VIDEO_SIZE, height: VIDEO_SIZE }}
        />
      </View>

      {hasRenderedFrame ? null : (
        <Image
          className="absolute"
          resizeMode="contain"
          source={runningRabbitPoster}
          style={{ width: VIDEO_SIZE, height: VIDEO_SIZE }}
        />
      )}

      {/* 영상 왼쪽 여백에만 그린다. 영상이 불투명해서 뒤에 깔 수는 없고, 위에 얹으면
          토끼를 가로지른다. 배경이 양쪽 다 흰색이라 밖에 둬도 한 장면으로 읽힌다. */}
      {SPEED_LINES.map((line) => (
        <SpeedLine key={line.top} {...line} />
      ))}
    </View>
  );
}
