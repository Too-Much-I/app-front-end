import { View } from "react-native";

import type { ChallengeStageQuestion } from "@/screens/challenge/challenge-stage-status";
import { CHALLENGE_STAGE_STOP_SIZE } from "@/screens/challenge/challenge-stage-layout";
import { ChallengeStageStop } from "@/screens/challenge/components/ChallengeStageStop";

/** 밭 한 판의 가로세로 비. 길이 한 번 굽었다 펴지는 데 필요한 세로 길이다. */
const FIELD_ASPECT_RATIO = 0.7857;
/** 길의 중심선 `x(t) = 0.5 + AMP * cos(2πt)`. 자리와 점선이 같은 식을 쓴다. */
const PATH_AMPLITUDE = 0.28;
const FIRST_STOP_T = 0.1;
const LAST_STOP_T = 0.9;
/** 자리와 자리 사이에 놓는 점 개수. */
const DOTS_PER_GAP = 5;
/** 구덩이에 가려 반쪽만 보이는 점이 없도록 자리 양옆으로 비우는 간격. */
const DOT_CLEARANCE_T = 0.12;
const DOT_SIZE = 5;

interface ChallengeStageFieldProps {
  questions: ChallengeStageQuestion[];
  onSelect: (question: ChallengeStageQuestion) => void;
}

/**
 * 오늘의 문장 세 개가 놓인 당근밭.
 *
 * 목록이 아니라 지도인 이유는 순서가 곧 규칙이기 때문이다 — 앞 문장을 풀어야 다음이
 * 열리는데, 세로로 나열한 카드는 그 순서를 색으로만 말한다. 길로 이으면 잠긴 자리가
 * 왜 잠겼는지를 배치가 설명한다.
 *
 * 길은 점선뿐이다. 초록 띠를 깔아봤지만 크림 배경 위에서 색면이 하나 더 생기는 만큼
 * 구덩이와 당근잎의 초록이 힘을 나눠 가졌다. 점만 남기면 길은 읽히고 색은 당근에 남는다.
 *
 * 배경 그림을 쓰지 않는 이유도 같다 — 그릴 것이 점밖에 없으면 자리와 같은 수식으로
 * 계산해 찍는 편이 낫다. 문항 수가 달라져도 점과 자리가 함께 움직인다.
 */
export function ChallengeStageField({ questions, onSelect }: ChallengeStageFieldProps) {
  return (
    <View className="w-full" style={{ aspectRatio: FIELD_ASPECT_RATIO }}>
      {getDotPositions(questions.length).map(({ x, y }) => (
        <View
          accessibilityElementsHidden
          className="absolute rounded-full bg-brand-300"
          key={`${x}-${y}`}
          style={{
            left: `${x * 100}%`,
            top: `${y * 100}%`,
            width: DOT_SIZE,
            height: DOT_SIZE,
            marginLeft: -DOT_SIZE / 2,
            marginTop: -DOT_SIZE / 2,
          }}
        />
      ))}

      {questions.map((question, index) => {
        const { x, y } = getPointAt(getStopT(index, questions.length));

        return (
          <View
            className="absolute"
            key={question.questionNumber}
            style={{
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              width: CHALLENGE_STAGE_STOP_SIZE.width,
              height: CHALLENGE_STAGE_STOP_SIZE.height,
              marginLeft: -CHALLENGE_STAGE_STOP_SIZE.width / 2,
              marginTop: -CHALLENGE_STAGE_STOP_SIZE.height / 2,
            }}
          >
            <ChallengeStageStop
              onPress={() => onSelect(question)}
              questionNumber={question.questionNumber}
              status={question.status}
            />
          </View>
        );
      })}
    </View>
  );
}

/** 길 위의 한 점. 값은 0~1 비율이다. */
function getPointAt(t: number): { x: number; y: number } {
  return { x: 0.5 + PATH_AMPLITUDE * Math.cos(2 * Math.PI * t), y: t };
}

/** i번째 자리가 놓이는 t. */
function getStopT(index: number, count: number): number {
  if (count <= 1) return (FIRST_STOP_T + LAST_STOP_T) / 2;

  return FIRST_STOP_T + ((LAST_STOP_T - FIRST_STOP_T) * index) / (count - 1);
}

/** 자리와 자리를 잇는 점들. 자리 위에는 찍지 않는다. */
function getDotPositions(count: number): { x: number; y: number }[] {
  const dots: { x: number; y: number }[] = [];

  for (let index = 0; index + 1 < count; index += 1) {
    const from = getStopT(index, count) + DOT_CLEARANCE_T;
    const to = getStopT(index + 1, count) - DOT_CLEARANCE_T;
    if (to <= from) continue;

    for (let step = 0; step < DOTS_PER_GAP; step += 1) {
      dots.push(getPointAt(from + ((to - from) * step) / (DOTS_PER_GAP - 1)));
    }
  }

  return dots;
}
