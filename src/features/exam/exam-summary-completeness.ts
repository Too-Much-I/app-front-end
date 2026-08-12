const COMPLETE_EXAM_QUESTION_COUNT = 11;
const PART_NUMBERS = [1, 2, 3, 4, 5] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasNonBlankString(value: unknown): boolean {
  return Array.isArray(value) && value.some(isNonBlankString);
}

/** 웹과 같은 필수 값 계약으로 서버 원본 summary의 완성을 판정한다. */
export function isRawExamSummaryComplete(value: unknown): boolean {
  const raw = asRecord(value);
  const partFeedback = asRecord(raw.partFeedback);
  const partScores = asRecord(raw.partScores);

  return (
    raw.totalSolvedQuestions === COMPLETE_EXAM_QUESTION_COUNT &&
    isFiniteNumber(raw.totalScore) &&
    isNonBlankString(raw.levelEstimate) &&
    isNonBlankString(raw.summary) &&
    isNonBlankString(raw.overallFeedback) &&
    hasNonBlankString(raw.strengths) &&
    hasNonBlankString(raw.weaknesses) &&
    hasNonBlankString(raw.recommendedPractice) &&
    PART_NUMBERS.every((partNumber) => {
      const key = `part${partNumber}`;
      return (
        isNonBlankString(partFeedback[key]) &&
        isFiniteNumber(partScores[key])
      );
    })
  );
}
