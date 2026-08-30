import type {
  ChallengeAnswerAccepted,
  ChallengeAttempt,
  ChallengeCorrectionItem,
  RawChallengeQuestionResult,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** 빈 문자열과 공백뿐인 값은 없는 것으로 본다 — 화면이 빈 카드를 그리지 않게 한다. */
function toText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * 첨삭 항목은 여섯 필드가 모두 문자열일 때만 통과시킨다.
 *
 * 형태가 동결되지 않은 응답이라 하나라도 빠진 항목이 섞여 올 수 있는데, 그런 항목은
 * 시트에서 빈 줄로 보이는 것보다 아예 없는 편이 낫다. `original`은 여기서 다듬는다 —
 * 앞뒤 공백이 남으면 transcript에서 찾지 못해 밑줄이 사라진다.
 */
function toCorrectionItem(value: unknown): ChallengeCorrectionItem | null {
  if (!isRecord(value)) return null;

  const type = toText(value.type);
  const original = toText(value.original);
  const issue = toText(value.issue);
  const explanation = toText(value.explanation);
  const suggested = toText(value.suggested);
  const severity = toText(value.severity);

  if (!type || !original || !issue || !explanation || !suggested || !severity) return null;
  return { type, original, issue, explanation, suggested, severity };
}

function toCorrectionItems(value: unknown): ChallengeCorrectionItem[] {
  if (!Array.isArray(value)) return [];

  const items: ChallengeCorrectionItem[] = [];
  for (const entry of value) {
    const item = toCorrectionItem(entry);
    if (item) items.push(item);
  }
  return items;
}

/**
 * `aiResult`를 화면이 쓰는 값으로 좁힌다.
 *
 * `unknown`으로 받는 이유는 명세 9절이 형태를 동결하지 않았기 때문이고, 그래서 캐스팅
 * 대신 필드를 하나씩 확인한다. 채점 중에는 이 값이 통째로 없으므로(`null`) 전부 빈 값이 된다.
 *
 * `transcript`는 `aiResult` 안에서 확인됐지만 형제 필드로 오는 경우도 아직 배제하지 못해
 * 양쪽을 본다. 두 자리 중 하나만 채워져 있어도 화면은 같게 동작한다.
 */
function mapAiResult(question: RawChallengeQuestionResult) {
  const aiResult = isRecord(question.aiResult) ? question.aiResult : null;
  const feedback = aiResult && isRecord(aiResult.feedback) ? aiResult.feedback : null;

  return {
    transcript: toText(aiResult?.transcript) ?? toText(question.transcript),
    feedbackSummary: toText(feedback?.summary),
    corrections: toCorrectionItems(feedback?.correctionItems),
    correctedAnswer: toText(feedback?.correctedAnswer),
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
          hasAiResult: question.aiResult !== null && question.aiResult !== undefined,
          ...mapAiResult(question),
        }
      : null,
  };
}
