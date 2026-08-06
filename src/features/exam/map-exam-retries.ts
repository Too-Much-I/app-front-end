import {
  getExamPartNumberByQuestionNumber,
  getExamQuestionMaxScore,
} from "@/features/exam/part-meta";
import type { RawExamRetriesResult } from "@/types/exam";

export type ReanswerQuestionItem = {
  examId: string;
  partNumber: number;
  questionNumber: number;
  /** 비교에 쓴 최신 회차. 카드의 "N차 답변" 표기는 이 값 + 1이다. */
  retryCount: number;
  initialScore: number;
  latestScore: number;
  maxScore: number;
  completedAt: string;
};

export type ReanswerProgress = {
  /** 최초 답변 대비 평균 달성률 변화(퍼센트포인트). */
  averageDeltaPercentagePoints: number;
  improvedQuestionCount: number;
  comparableQuestionCount: number;
};

/** 응답 형식이 계약과 다를 때 던진다. 빈 목록으로 바꾸지 않는다. */
export class ExamRetriesContractError extends Error {
  constructor() {
    super("재답변 이력 응답 형식이 올바르지 않습니다.");
    this.name = "ExamRetriesContractError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

type GradedAttempt = {
  retryCount: number;
  score: number;
  completedAt: string | null;
};

/**
 * 채점이 끝난 회차만 골라낸다.
 *
 * 서버가 대기 중인 회차를 생략하든 score를 null로 주든 똑같이 걸러지도록,
 * status 필드가 아니라 "score가 유한한 수인가"로 판단한다.
 */
function toGradedAttempt(value: unknown): GradedAttempt | null {
  if (!isRecord(value)) return null;

  const { retryCount, score, completedAt } = value;
  if (!isFiniteNumber(retryCount) || !Number.isInteger(retryCount)) return null;
  if (retryCount < 0) return null;
  if (!isFiniteNumber(score)) return null;

  return {
    retryCount,
    score,
    completedAt: typeof completedAt === "string" ? completedAt : null,
  };
}

/**
 * 문항 하나를 비교 가능한 항목으로 만든다. 비교할 수 없으면 null.
 *
 * 비교 조건은 007 계약의 client calculation contract를 따른다 — 최초 회차(retryCount=0)와
 * 재답변 회차(retryCount>0) 모두 채점이 끝나 있어야 하고, 두 점수가 만점 범위 안이어야 한다.
 * 조건을 못 채운 문항은 평균의 분모에서도 빠진다.
 */
function toReanswerQuestion(
  examId: string,
  value: unknown,
): ReanswerQuestionItem | null {
  if (!isRecord(value)) return null;

  const { questionNumber, attempts } = value;
  if (!isFiniteNumber(questionNumber) || !Array.isArray(attempts)) return null;

  const partNumber = getExamPartNumberByQuestionNumber(questionNumber);
  const maxScore = getExamQuestionMaxScore(questionNumber);
  if (partNumber === null || maxScore === null || maxScore <= 0) return null;

  const graded = attempts
    .map(toGradedAttempt)
    .filter((attempt): attempt is GradedAttempt => attempt !== null);

  const initial = graded.find((attempt) => attempt.retryCount === 0);
  const latest = graded
    .filter((attempt) => attempt.retryCount > 0)
    .sort((left, right) => right.retryCount - left.retryCount)[0];

  if (!initial || !latest) return null;
  if (initial.score < 0 || initial.score > maxScore) return null;
  if (latest.score < 0 || latest.score > maxScore) return null;

  return {
    examId,
    // 서버의 partNumber가 누락되거나 어긋나도 문항 번호와 배점 기준이 서로 갈리지 않는다.
    partNumber,
    questionNumber,
    retryCount: latest.retryCount,
    initialScore: initial.score,
    latestScore: latest.score,
    maxScore,
    completedAt: latest.completedAt ?? initial.completedAt ?? "",
  };
}

/** 재답변 이력에서 비교 가능한 문항만 문항 번호 순으로 추린다. */
export function mapExamRetries(raw: RawExamRetriesResult): ReanswerQuestionItem[] {
  if (
    !isRecord(raw) ||
    !isNonEmptyString(raw.examId) ||
    !Array.isArray(raw.questions)
  ) {
    throw new ExamRetriesContractError();
  }

  const examId = raw.examId;

  return raw.questions
    .map((question) => toReanswerQuestion(examId, question))
    .filter((item): item is ReanswerQuestionItem => item !== null)
    .sort((left, right) => left.questionNumber - right.questionNumber);
}

/**
 * 재답변 성과 요약.
 *
 * 만점이 다른 문항의 원점수 차이를 그대로 평균하지 않는다 — 문항별 달성률(score/maxScore)
 * 차이를 구한 뒤 평균해 퍼센트포인트로 표시한다. 100점 환산 점수는 만들지 않는다.
 * 반올림은 표시 직전에 한 번만 하고, -0.0은 0.0으로 정규화한다.
 */
export function summarizeReanswerProgress(
  items: readonly ReanswerQuestionItem[],
): ReanswerProgress {
  if (items.length === 0) {
    return {
      averageDeltaPercentagePoints: 0,
      improvedQuestionCount: 0,
      comparableQuestionCount: 0,
    };
  }

  const averageDeltaRatio =
    items.reduce(
      (sum, item) => sum + (item.latestScore - item.initialScore) / item.maxScore,
      0,
    ) / items.length;

  const rounded = Math.round(averageDeltaRatio * 1_000) / 10;

  return {
    averageDeltaPercentagePoints: rounded === 0 ? 0 : rounded,
    improvedQuestionCount: items.filter(
      (item) => item.latestScore > item.initialScore,
    ).length,
    comparableQuestionCount: items.length,
  };
}
