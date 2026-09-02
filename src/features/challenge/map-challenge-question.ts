import { z } from "zod";

import type { ChallengeQuestion } from "@/types/challenge";

/**
 * `GET /api/v1/challenges/today/questions/{questionNumber}` 응답의 와이어 모양.
 *
 * 매퍼가 읽는 필드만 선언한다. 명세 v1 §6.2의 `difficulty`는 표시에 쓰지 않으므로
 * 선언하지 않았다 — 읽지 않는 필드를 스키마에 넣으면 우리가 쓰지도 않는 값이 바뀌었을 때
 * 화면이 멈춘다.
 */
export const challengeQuestionSchema = z.object({
  /**
   * 서버 기준 KST 날짜. 자정 경계가 기기 시계와 갈리므로 앱이 계산하지 않는다.
   * 이 값이 이후 요청의 `X-Challenge-Date`가 되므로 형식까지 확인한다.
   */
  challengeDate: z.iso.date(),
  questionNumber: z.number().int(),
  totalQuestionCount: z.number().int(),
  /** 10초 안에 영어로 바꿔 말할 한국어 문장. */
  promptKo: z.string(),
  attemptStatus: z.enum(["not_started", "submitted"]),
  gradingStatus: z.enum([
    "not_requested",
    "pending",
    "processing",
    "completed",
    "failed",
  ]),
});

/**
 * 오늘의 챌린지 문제 원문을 화면이 쓰는 형태로 옮긴다.
 *
 * 하는 일은 `challengeDate` → `date` 이름 정리와 문장 좌우 공백 제거뿐이다.
 * 문장은 노트 카드 한가운데에 큰 글씨로 놓여서 앞뒤 공백이 그대로 여백으로 보인다.
 */
export function mapChallengeQuestion(
  raw: z.infer<typeof challengeQuestionSchema>,
): ChallengeQuestion {
  return {
    date: raw.challengeDate,
    questionNumber: raw.questionNumber,
    totalQuestionCount: raw.totalQuestionCount,
    promptKo: raw.promptKo.trim(),
    attemptStatus: raw.attemptStatus,
    gradingStatus: raw.gradingStatus,
  };
}
