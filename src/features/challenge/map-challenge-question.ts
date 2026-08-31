import type { ChallengeQuestion, RawChallengeQuestion } from "@/types/challenge";

/**
 * 오늘의 챌린지 문제 원문을 화면이 쓰는 형태로 옮긴다.
 *
 * 하는 일은 `challengeDate` → `date` 이름 정리와 문장 좌우 공백 제거뿐이다.
 * 문장은 노트 카드 한가운데에 큰 글씨로 놓여서 앞뒤 공백이 그대로 여백으로 보인다.
 */
export function mapChallengeQuestion(raw: RawChallengeQuestion): ChallengeQuestion {
  return {
    date: raw.challengeDate,
    questionNumber: raw.questionNumber,
    totalQuestionCount: raw.totalQuestionCount,
    promptKo: raw.promptKo.trim(),
    attemptStatus: raw.attemptStatus,
    gradingStatus: raw.gradingStatus,
  };
}
