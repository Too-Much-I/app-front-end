import type {
  ChallengeAnswerAccepted,
  ChallengeAttempt,
  ChallengeToday,
  ChallengeUploadUrl,
  RawChallengeToday,
  ChallengeDayResult,
  ChallengeQuestion,
  RawChallengeAttempt,
  RawChallengeDayResult,
  RawChallengeUploadUrl,
  RawChallengeAnswerAccepted,
  RawChallengeQuestion,
} from "@/types/challenge";

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

/**
 * ISO 8601 UTC 시각을 앱 시계 기준 ms로 옮긴다.
 *
 * 기기 시계가 틀어져 있으면 만료 판정도 함께 틀어지지만, 업로드 만료의 최종 판정은
 * S3와 서버가 한다. 여기 값은 "더 시도해볼 가치가 있는가"를 재는 예산일 뿐이다.
 */
function toEpochMs(isoTime: string): number {
  const parsed = Date.parse(isoTime);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function mapChallengeAttempt(raw: RawChallengeAttempt): ChallengeAttempt {
  return {
    attemptId: raw.attemptId,
    date: raw.challengeDate,
    questionNumber: raw.questionNumber,
    submissionDeadlineAtMs: toEpochMs(raw.submissionDeadlineAt),
  };
}

export function mapChallengeUploadUrl(raw: RawChallengeUploadUrl): ChallengeUploadUrl {
  return {
    url: raw.upload.url,
    expiresAtMs: toEpochMs(raw.upload.expiresAt),
    contentType: raw.upload.contentType,
    maxBytes: raw.upload.maxBytes,
    submissionDeadlineAtMs: toEpochMs(raw.submissionDeadlineAt),
  };
}

export function mapChallengeAnswerAccepted(
  raw: RawChallengeAnswerAccepted,
): ChallengeAnswerAccepted {
  return {
    attemptId: raw.attemptId,
    date: raw.challengeDate,
    questionNumber: raw.questionNumber,
    gradingStatus: raw.gradingStatus,
    referenceAnswer: raw.referenceAnswer.trim(),
    feedbackAvailable: raw.feedbackAvailable,
  };
}

export function mapChallengeDayResult(raw: RawChallengeDayResult): ChallengeDayResult {
  const question = raw.question;

  return {
    date: raw.challengeDate,
    solvedQuestionCount: raw.solvedQuestionCount,
    question: question
      ? {
          questionNumber: question.questionNumber,
          promptKo: question.promptKo.trim(),
          gradingStatus: question.gradingStatus,
          referenceAnswer: question.referenceAnswer,
          audioUrl: question.audioUrl,
          // 필드 형태가 동결되기 전까지 화면에는 "있다/없다"만 넘긴다.
          hasAiResult: question.aiResult !== null && question.aiResult !== undefined,
        }
      : null,
  };
}
