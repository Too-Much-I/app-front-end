import type { RawExamHistoryResult } from "@/types/exam";

/**
 * 시험 총점의 만점.
 *
 * 이력 API는 만점을 내려주지 않으므로 TOEIC Speaking 총점을 앱이 상수로 갖는다.
 * 화면 문구("/200점")와 추이 차트 척도가 모두 이 값을 쓴다.
 */
export const EXAM_TOTAL_MAX_SCORE = 200;

export type ExamHistoryTone = "green" | "blue" | "purple" | "orange";

export type ExamHistoryItem = {
  examId: string;
  title: string;
  completedAt: string;
  chartDateLabel: string;
  level: string;
  totalScore: number;
  maxTotalScore: number;
  retriedQuestionCount: number;
  tone: ExamHistoryTone;
};

/** 응답 형식이 계약과 다를 때 던진다. 빈 목록으로 바꾸지 않는다. */
export class ExamHistoryContractError extends Error {
  constructor() {
    super("시험 이력 응답 형식이 올바르지 않습니다.");
    this.name = "ExamHistoryContractError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidDateString(value: unknown): value is string {
  return isNonEmptyString(value) && Number.isFinite(new Date(value).getTime());
}

function chartDateLabel(completedAt: string): string {
  const date = new Date(completedAt);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 등급 배지 색.
 *
 * 색만으로 등급을 전달하지 않는다 — 배지에는 항상 등급 문자를 함께 표시한다.
 * 알 수 없는 등급은 원문을 보존하고 기본 색을 쓴다.
 */
function toneForLevel(level: string): ExamHistoryTone {
  const normalizedLevel = level.trim().toUpperCase();
  if (["AH", "AM", "AL"].includes(normalizedLevel)) return "purple";
  if (normalizedLevel === "IH") return "blue";
  if (["IM3", "IM2", "IM1"].includes(normalizedLevel)) return "green";
  return "orange";
}

/**
 * 검증과 매핑을 한 함수에서 한다.
 *
 * 검증만 하고 캐스트로 타입을 붙이면 검증하지 않은 필드가 조용히 통과한다.
 * 검증된 지역 변수로 결과를 직접 조립해 캐스트를 쓰지 않는다.
 */
function mapItem(value: unknown): ExamHistoryItem {
  if (!isRecord(value)) {
    throw new ExamHistoryContractError();
  }

  const { examId, title, completedAt, totalScore, levelEstimate, retriedQuestionCount } =
    value;

  if (
    !isNonEmptyString(examId) ||
    typeof title !== "string" ||
    !isValidDateString(completedAt) ||
    !isFiniteNumber(totalScore) ||
    typeof levelEstimate !== "string"
  ) {
    throw new ExamHistoryContractError();
  }

  return {
    examId,
    title,
    completedAt,
    chartDateLabel: chartDateLabel(completedAt),
    level: levelEstimate,
    totalScore,
    maxTotalScore: EXAM_TOTAL_MAX_SCORE,
    // 없으면 재답변이 없는 것으로 본다 — 부제에서 문구 하나가 빠질 뿐이라
    // 이력 전체를 계약 오류로 버릴 만한 필드가 아니다.
    retriedQuestionCount: isFiniteNumber(retriedQuestionCount)
      ? retriedQuestionCount
      : 0,
    tone: toneForLevel(levelEstimate),
  };
}

/** 최신순으로 정렬된 이력 항목을 만든다. 서버 정렬을 신뢰하지 않고 다시 정렬한다. */
export function mapExamHistory(raw: RawExamHistoryResult): ExamHistoryItem[] {
  if (!isRecord(raw) || !Array.isArray(raw.histories)) {
    throw new ExamHistoryContractError();
  }

  return raw.histories
    .map((item) => mapItem(item))
    .sort(
      (left, right) =>
        new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime(),
    );
}

/** 총점 평균. 항목이 없으면 0이다. */
export function averageTotalScore(items: readonly ExamHistoryItem[]): number {
  if (items.length === 0) return 0;
  return items.reduce((sum, item) => sum + item.totalScore, 0) / items.length;
}
