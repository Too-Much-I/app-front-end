import { z } from "zod";

import { getLevelAbbreviation } from "@/features/exam/level-estimate";
import type { RawExamHistoryResult } from "@/types/exam";

/**
 * `GET /api/v1/exams/history` 응답에 대한 우리 쪽 계약. 아직 관찰 전용이다.
 *
 * 아래 매퍼의 방어 코드를 그대로 옮기지 않고 **계약대로 엄격하게** 썼다. 방어 코드는
 * "서버가 이런 적이 있었다"는 기록일 수도 있고 그냥 조심스러웠던 것일 수도 있는데,
 * 코드만 읽어서는 둘을 구분할 수 없다. 실제 트래픽이 무엇을 위반하는지 보고 나서
 * 느슨하게 만드는 편이, 지금 추측으로 느슨하게 두는 것보다 정확하다.
 *
 * 특히 `retriedQuestionCount`는 매퍼가 없으면 0으로 넘기지만 여기서는 필수로 둔다 —
 * 그 방어가 실제로 필요한지가 이 관찰로 처음 확인된다.
 *
 * `totalCount`는 매퍼가 읽지 않으므로 선언하지 않는다.
 */
export const examHistorySchema = z.object({
  histories: z.array(
    z.object({
      examId: z.string().min(1),
      title: z.string(),
      // 매퍼가 이미 `isValidDateString`으로 던지는 값이다. 스키마가 그보다 느슨하면
      // 화면을 실제로 깨뜨리는 응답이 관찰에 안 잡혀 관찰 모드의 의미가 없어진다.
      completedAt: z
        .string()
        .refine((value) => value.length > 0 && Number.isFinite(new Date(value).getTime())),
      totalScore: z.number(),
      levelEstimate: z.string(),
      retriedQuestionCount: z.number(),
    }),
  ),
});

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

  const level = getLevelAbbreviation(levelEstimate);

  return {
    examId,
    title,
    completedAt,
    chartDateLabel: chartDateLabel(completedAt),
    level,
    totalScore,
    maxTotalScore: EXAM_TOTAL_MAX_SCORE,
    // 없으면 재답변이 없는 것으로 본다 — 부제에서 문구 하나가 빠질 뿐이라
    // 이력 전체를 계약 오류로 버릴 만한 필드가 아니다.
    retriedQuestionCount: isFiniteNumber(retriedQuestionCount)
      ? retriedQuestionCount
      : 0,
    tone: toneForLevel(level),
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
