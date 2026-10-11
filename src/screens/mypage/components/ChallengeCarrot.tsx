import Svg, { Ellipse, Path } from 'react-native-svg';

import { colors } from '@/theme';

/**
 * 당근 그림의 색. `public/challenge/carrot.png`에서 뽑았다.
 *
 * 테마 토큰으로 올리지 않는 이유: 이 당근 하나만 쓰는 그림 색이라, 토큰이 되면 다른 화면이
 * 가져다 쓸 이름만 생긴다. 테두리 주황만 브랜드 500과 같아서 토큰을 쓴다.
 */
const CARROT_BODY_FILL = '#FFA53A';
const CARROT_LEAF_FILL = '#9BD84E';
const CARROT_LEAF_STROKE = '#2E8B3A';
/** 아직 칠하지 않은 칸. 크림 배경 위에서 빈 당근으로 읽히는 밝기다. */
const EMPTY_FILL = '#F4EFE9';
const EMPTY_STROKE = '#D6CEC4';

/** 몸통 위 절반 · 아래 절반 · 이파리를 따로 칠하려고 조각을 나눈 경로(viewBox 40×56, 경계 y=35). */
const UPPER_BODY =
  'M20 16 C29 16 34 19 33 25 C32.6 28.5 31.6 31.8 30.3 35 L9.7 35 C8.4 31.8 7.4 28.5 7 25 C6 19 11 16 20 16 Z';
const LOWER_BODY =
  'M9.7 35 L30.3 35 C28.5 40.5 25 47 22 51 C21 52.5 19 52.5 18 51 C15 47 11.5 40.5 9.7 35 Z';
const UPPER_OUTLINE =
  'M9.7 35 C8.4 31.8 7.4 28.5 7 25 C6 19 11 16 20 16 C29 16 34 19 33 25 C32.6 28.5 31.6 31.8 30.3 35';
const LOWER_OUTLINE =
  'M30.3 35 C28.5 40.5 25 47 22 51 C21 52.5 19 52.5 18 51 C15 47 11.5 40.5 9.7 35';
const UPPER_STRIPES = 'M12 25 Q14.5 26.2 16.5 25.6 M24 31.5 Q26.2 31 28.3 29.8';
const LOWER_STRIPE = 'M16.5 42 Q18.3 43 19.8 42.6';

const VIEWBOX_WIDTH = 40;
const VIEWBOX_HEIGHT = 56;
const STROKE_WIDTH = 2.4;

interface ChallengeCarrotProps {
  /** 그날 푼 문장 수. 1이면 아래 절반, 2면 몸통 전체, 3이면 이파리까지 칠한다. */
  solvedQuestionCount: number;
  width: number;
}

/**
 * 하루치 진행을 칠한 당근 하나.
 *
 * 칠하지 않은 조각은 테두리·줄무늬도 회색이다 — 칠한 영역의 선만 주황이어야 "절반"이
 * 경계선 없이도 읽힌다(2026-10-11 결정).
 */
export function ChallengeCarrot({ solvedQuestionCount, width }: ChallengeCarrotProps) {
  const isLowerDone = solvedQuestionCount >= 1;
  const isUpperDone = solvedQuestionCount >= 2;
  const isLeafDone = solvedQuestionCount >= 3;

  const lowerStroke = isLowerDone ? colors.brand.DEFAULT : EMPTY_STROKE;
  const upperStroke = isUpperDone ? colors.brand.DEFAULT : EMPTY_STROKE;
  const leafFill = isLeafDone ? CARROT_LEAF_FILL : EMPTY_FILL;
  const leafStroke = isLeafDone ? CARROT_LEAF_STROKE : EMPTY_STROKE;

  return (
    <Svg
      accessibilityElementsHidden
      height={(width * VIEWBOX_HEIGHT) / VIEWBOX_WIDTH}
      importantForAccessibility="no-hide-descendants"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      width={width}
    >
      <Ellipse
        cx={13}
        cy={10}
        fill={leafFill}
        rx={5.5}
        ry={7}
        stroke={leafStroke}
        strokeWidth={STROKE_WIDTH}
        transform="rotate(-32 13 10)"
      />
      <Ellipse
        cx={27}
        cy={10}
        fill={leafFill}
        rx={5.5}
        ry={7}
        stroke={leafStroke}
        strokeWidth={STROKE_WIDTH}
        transform="rotate(32 27 10)"
      />
      <Ellipse
        cx={20}
        cy={7.5}
        fill={leafFill}
        rx={5.5}
        ry={7.5}
        stroke={leafStroke}
        strokeWidth={STROKE_WIDTH}
      />

      <Path d={UPPER_BODY} fill={isUpperDone ? CARROT_BODY_FILL : EMPTY_FILL} />
      <Path d={LOWER_BODY} fill={isLowerDone ? CARROT_BODY_FILL : EMPTY_FILL} />

      <Path
        d={UPPER_OUTLINE}
        fill="none"
        stroke={upperStroke}
        strokeLinecap="round"
        strokeWidth={STROKE_WIDTH}
      />
      <Path
        d={LOWER_OUTLINE}
        fill="none"
        stroke={lowerStroke}
        strokeLinecap="round"
        strokeWidth={STROKE_WIDTH}
      />
      <Path
        d={UPPER_STRIPES}
        fill="none"
        stroke={upperStroke}
        strokeLinecap="round"
        strokeWidth={2}
      />
      <Path
        d={LOWER_STRIPE}
        fill="none"
        stroke={lowerStroke}
        strokeLinecap="round"
        strokeWidth={2}
      />
    </Svg>
  );
}
