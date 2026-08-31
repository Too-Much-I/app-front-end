import type { ChallengeToday, RawChallengeToday } from "@/types/challenge";

/** 오늘 진행도. 스테이지 화면과, 진입 날짜를 모르는 문제 화면이 함께 쓴다. */
export function mapChallengeToday(raw: RawChallengeToday): ChallengeToday {
  return {
    date: raw.challengeDate,
    expiresInSeconds: raw.expiresInSeconds,
    dailyStatus: raw.dailyStatus,
    totalQuestionCount: raw.totalQuestionCount,
    nextQuestionNumber: raw.nextQuestionNumber,
    completedQuestionNumbers: [...raw.completedQuestionNumbers],
    questions: raw.questions.map((question) => ({ ...question })),
  };
}
