type ToeicSpeakingLevel = {
  abbreviation: string;
  levelLabel: string;
};

/** 종합 피드백 웹 화면과 동일한 TOEIC Speaking 등급명·축약 코드 대응표. */
const TOEIC_SPEAKING_LEVELS: readonly ToeicSpeakingLevel[] = [
  { abbreviation: "AH", levelLabel: "Advanced High" },
  { abbreviation: "AM", levelLabel: "Advanced Mid" },
  { abbreviation: "AL", levelLabel: "Advanced Low" },
  { abbreviation: "IH", levelLabel: "Intermediate High" },
  { abbreviation: "IM3", levelLabel: "Intermediate Mid 3" },
  { abbreviation: "IM2", levelLabel: "Intermediate Mid 2" },
  { abbreviation: "IM1", levelLabel: "Intermediate Mid 1" },
  { abbreviation: "IL", levelLabel: "Intermediate Low" },
  { abbreviation: "NH", levelLabel: "Novice High" },
  { abbreviation: "NM/NL", levelLabel: "Novice Mid / Low" },
];

/** 비교에 영향을 주지 않는 공백·괄호·구분자·보이지 않는 문자를 제거한다. */
function normalizeLevelForComparison(level: string): string {
  return level
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** 두 문자열을 같게 만들기 위해 필요한 삽입·삭제·교체 횟수를 구한다. */
function getEditDistance(source: string, target: string): number {
  const previousRow = Array.from({ length: target.length + 1 }, (_, index) => index);

  for (let sourceIndex = 1; sourceIndex <= source.length; sourceIndex += 1) {
    let diagonal = previousRow[0];
    previousRow[0] = sourceIndex;

    for (let targetIndex = 1; targetIndex <= target.length; targetIndex += 1) {
      const above = previousRow[targetIndex];
      const substitutionCost =
        source[sourceIndex - 1] === target[targetIndex - 1] ? 0 : 1;

      previousRow[targetIndex] = Math.min(
        previousRow[targetIndex] + 1,
        previousRow[targetIndex - 1] + 1,
        diagonal + substitutionCost,
      );
      diagonal = above;
    }
  }

  return previousRow[target.length];
}

/** 오타가 있더라도 충분히 가깝고 후보가 하나로 명확한 전체 등급명을 찾는다. */
function findFuzzyLevel(normalizedLevel: string): ToeicSpeakingLevel | null {
  // AH, IM1 같은 짧은 코드의 오타까지 추측하면 다른 등급으로 잘못 매핑하기 쉽다.
  if (normalizedLevel.length < 7) return null;

  const candidates = TOEIC_SPEAKING_LEVELS.map((level) => {
    const normalizedLabel = normalizeLevelForComparison(level.levelLabel);
    return {
      level,
      distance: getEditDistance(normalizedLevel, normalizedLabel),
      allowedDistance: Math.max(1, Math.floor(normalizedLabel.length * 0.2)),
    };
  }).sort((left, right) => left.distance - right.distance);

  const [closest, secondClosest] = candidates;
  if (
    !closest ||
    closest.distance > closest.allowedDistance ||
    closest.distance === secondClosest?.distance
  ) {
    return null;
  }

  return closest.level;
}

/** 서버의 전체 등급명(또는 이미 축약된 코드)을 오타까지 보정해 축약 코드로 바꾼다. */
export function getLevelAbbreviation(levelEstimate: string): string {
  const normalizedLevel = normalizeLevelForComparison(levelEstimate);
  const exactLevel = TOEIC_SPEAKING_LEVELS.find(
    ({ abbreviation, levelLabel }) =>
      normalizeLevelForComparison(abbreviation) === normalizedLevel ||
      normalizedLevel.includes(normalizeLevelForComparison(levelLabel)),
  );
  const level = exactLevel ?? findFuzzyLevel(normalizedLevel);

  return level?.abbreviation ?? levelEstimate;
}
