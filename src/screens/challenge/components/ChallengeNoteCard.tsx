import { Feather } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Image, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { isUrgentRemaining } from "@/screens/challenge/challenge-ui";
import { PunchHoles } from "@/screens/challenge/components/paper/PunchHoles";
import { Tape } from "@/screens/challenge/components/paper/Tape";
import { colors, shadows } from "@/theme";

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const paintingCat = require("../../../../public/mascots/painting_cat.png");

/** 아래쪽 뜯긴 가장자리를 만드는 물결 수. */
const TORN_EDGE_BUMP_COUNT = 14;
/** 속지 괘선 수와 간격(px). 속지보다 길게 그려두고 넘치는 줄은 잘라낸다. */
const RULE_LINE_COUNT = 20;
const RULE_LINE_GAP = 30;

interface ChallengeNoteCardProps {
  promptKo: string;
  /** 남은 시간(초). `null`이면 셀 시간이 없다는 뜻이라 상단 바를 그리지 않는다. */
  remainingSeconds: number | null;
  /** 제한 시간 전체(초). 남은 비율을 내는 분모다. */
  totalSeconds: number;
  /** 노트 아래쪽 답변 칸에 들어갈 것 — 준비 안내, 파형, 녹음본 재생 중 하나. */
  children: ReactNode;
}

/**
 * 오늘의 문장을 적어둔 노트 한 장.
 *
 * 크림 대지 위에 흰 속지가 살짝 비뚤게 얹히고, 왼쪽은 펀치 구멍으로 뚫려 있고 아래는
 * 뜯긴 자국이 남아 있다. 시험 화면의 문제 카드처럼 반듯한 사각형을 쓰지 않는 이유는
 * 챌린지가 채점받는 자리가 아니라 연습장이기 때문이다.
 *
 * 구멍과 뜯긴 가장자리는 "대지 색으로 속지를 파낸" 모양이라 둘 다 `challenge.mat`으로
 * 그린다. 속지의 `overflow-hidden`이 물결의 아래쪽 절반을 잘라 반원만 남긴다.
 *
 * 남은 시간 바를 카드 위 가장자리에 붙인 이유는 시선 때문이다. 10초 동안 사용자의 눈은
 * 문장에 있어야 하는데, 숫자를 읽으려면 눈을 떼고 위로 올라갔다 초점을 다시 잡아야 한다.
 * 길이가 줄어드는 막대는 문장을 보는 채로 주변시에 들어오고, 매초 바뀌는 숫자와 달리
 * 연속적으로 변해서 주의를 반복해 끌어당기지 않는다. 정확한 숫자는 위 배지에 그대로 있다.
 *
 * 카드는 내용 높이가 아니라 화면의 남는 높이를 먹는다. 대지 → 속지 → 내용 래퍼까지
 * `grow`를 이어 붙여야 그 높이가 안쪽까지 전달된다. `flex-1`이 아니라 `grow`인 이유는
 * flex-basis 때문이다 — `flex-1`은 basis를 0으로 만들어서 긴 문장이 들어왔을 때 카드가
 * 내용보다 작게 눌린다. `grow`는 내용 높이를 하한으로 두고 남는 만큼만 늘어난다.
 *
 * 패딩이 있는 View를 절대배치의 기준으로 삼지 않는다 — RN에서 `top: 0`이 패딩 바깥이
 * 아니라 안쪽부터 잡히면 가장자리에 붙이려던 것이 내용 위로 올라탄다. 그래서 대지와 속지
 * 모두 패딩 없는 껍데기를 두고, 여백은 내용 전용 래퍼가 갖는다.
 */
export function ChallengeNoteCard({
  promptKo,
  remainingSeconds,
  totalSeconds,
  children,
}: ChallengeNoteCardProps) {
  return (
    <View className="relative grow">
      <View className="grow rounded-3xl bg-challenge-mat p-3" style={shadows.card}>
        <View
          className="relative grow overflow-hidden rounded-2xl bg-surface"
          style={{ transform: [{ rotate: "-0.8deg" }] }}
        >
          <NoteRuleLines />
          <PunchHoles carvedFrom={colors.challenge.mat} fit="note" />

          <View className="grow items-center justify-center gap-4 pb-20 pl-9 pr-5 pt-5">
            <View className="flex-row items-center gap-1.5 rounded-lg bg-challenge-label px-3 py-1.5">
              <Feather color={colors.brand.cta} name="star" size={14} />
              <Text className="text-sm">오늘의 문장</Text>
            </View>

            {/*
              * 행간만 토큰 스케일 밖의 값이다. `text-3xl`이 들고 오는 38px은 제목용이라
              * 두 줄 이상 감기는 문장에서 답답하고, Tailwind의 `leading-10`(35px)은 더
              * 좁다. px가 아니라 rem으로 적어 런타임 rem 스케일링에서 빠지지 않게 한다.
              */}
            <Text className="text-center text-3xl leading-[3.375rem]">{promptKo}</Text>

            <DashedRule colorClassName="border-sky" />

            <View className="min-h-28 w-full justify-center rounded-2xl border border-line bg-surface px-4 py-3">
              {children}
              <View className="mt-3">
                <DashedRule colorClassName="border-line" />
              </View>
            </View>
          </View>

          <NoteTornEdge />
        </View>
      </View>

      <Tape side="right" tone="sky" />

      {/*
        마스코트는 대지보다 나중에 그려서 카드 위로 올라온다. 그래서 키울 때는 속지의
        `pb`를 같이 늘려야 한다 — 안 그러면 답변 칸 왼쪽의 재생 버튼을 덮는다.
      */}
      <Image
        accessibilityElementsHidden
        className="absolute -bottom-4 -left-3 h-32 w-32"
        resizeMode="contain"
        source={paintingCat}
      />

      {/* 테이프보다 나중에 그린다 — 겹치는 자리에서 장식이 기능을 가리면 안 된다. */}
      <NoteTimerBar remainingSeconds={remainingSeconds} totalSeconds={totalSeconds} />
    </View>
  );
}

/**
 * 가로 점선 한 줄.
 *
 * RN의 점선 테두리는 한 변만 주면 안드로이드에서 실선으로 떨어진다. 네 변을 모두 준
 * View를 높이 1px 창으로 잘라내 가로 점선만 남긴다.
 */
function DashedRule({ colorClassName }: { colorClassName: string }) {
  return (
    <View className="h-px w-full overflow-hidden">
      <View className={`h-0 w-full border border-dashed ${colorClassName}`} />
    </View>
  );
}

function NoteTimerBar({
  remainingSeconds,
  totalSeconds,
}: {
  remainingSeconds: number | null;
  totalSeconds: number;
}) {
  if (remainingSeconds === null) return null;

  const remainingRatio =
    totalSeconds > 0 ? Math.max(0, Math.min(1, remainingSeconds / totalSeconds)) : 0;

  return (
    <View
      accessibilityElementsHidden
      className="absolute inset-x-0 top-0 h-1.5 overflow-hidden rounded-t-3xl bg-challenge-holeEdge/50"
      pointerEvents="none"
    >
      <View
        className={`h-full ${isUrgentRemaining(remainingSeconds) ? "bg-exam-danger" : "bg-brand-cta"}`}
        style={{ width: `${remainingRatio * 100}%` }}
      />
    </View>
  );
}

function NoteRuleLines() {
  return (
    <View accessibilityElementsHidden className="absolute inset-x-0 top-16" pointerEvents="none">
      {Array.from({ length: RULE_LINE_COUNT }, (_, index) => index).map((index) => (
        <View
          className="h-px bg-challenge-rule"
          key={index}
          style={index === 0 ? undefined : { marginTop: RULE_LINE_GAP }}
        />
      ))}
    </View>
  );
}

function NoteTornEdge() {
  return (
    <View
      accessibilityElementsHidden
      className="absolute -bottom-1.5 left-0 right-0 z-10 h-3 flex-row"
      pointerEvents="none"
    >
      {Array.from({ length: TORN_EDGE_BUMP_COUNT }, (_, index) => index).map((index) => (
        <View className="-mx-0.5 h-3 flex-1 rounded-full bg-challenge-mat" key={index} />
      ))}
    </View>
  );
}
