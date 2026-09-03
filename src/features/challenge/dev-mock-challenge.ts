import type {
  ChallengeAnswerAccepted,
  ChallengeAttempt,
  ChallengeCorrectionItem,
  ChallengeDayResult,
  ChallengeQuestion,
  ChallengeToday,
} from "@/types/challenge";

/**
 * 백엔드가 붙기 전까지 챌린지 화면을 끝까지 걸어보기 위한 임시 목 데이터.
 *
 * 전부 `__DEV__` 안에서만 쓰이고, 서버가 준비되면 이 파일과 아래 다섯 곳의 분기를
 * 함께 지우면 원래 흐름으로 돌아온다.
 *
 * - `challenge-today-queries.ts`  오늘 진행도 — 응답이 없으면 목으로 대체
 * - `use-challenge-question.ts`   문제 조회 — 목으로 바로 대체
 * - `use-challenge-attempt.ts`    attempt 발급 — 목으로 바로 대체
 * - `use-challenge-submission.ts` 제출 접수 — 올리지 않고 접수된 것처럼 넘어감
 * - `use-challenge-result.ts`     결과 조회 — 응답이 없으면 목으로 대체
 */

/** 실제 API를 이만큼 기다려보고 응답이 없으면 목으로 넘어간다. */
export const DEV_API_TIMEOUT_MS = 2_500;

/**
 * 제출이 즉시 끝나면 진행 표시가 한 프레임도 보이지 않는다.
 * 업로드가 실제로 걸리는 시간을 대신하는 최소한의 지연이다.
 */
export const DEV_SUBMIT_DELAY_MS = 1_200;

/**
 * 목 문장 한 세트.
 *
 * 문제·발화·첨삭이 서로 맞아야 밑줄이 실제로 그어지는 화면을 볼 수 있어서, 백엔드가 준
 * 예시 응답(D005Q01 / beginner)을 그대로 옮겼다. `transcript` 안에 `original`이 그대로
 * 들어 있어야 `findCorrectionSpans`가 자리를 찾는다.
 */
const DEV_MOCK_PROMPT_KO = "그녀는 검은색 신발을 신고 있어요.";
const DEV_MOCK_REFERENCE_ANSWER = "She's wearing black shoes.";
const DEV_MOCK_TRANSCRIPT = "She wear black shoe.";
const DEV_MOCK_FEEDBACK_SUMMARY = "현재진행형과 복수형을 사용하면 문장이 자연스러워져요.";
const DEV_MOCK_CORRECTED_ANSWER = "She is wearing black shoes.";

const DEV_MOCK_CORRECTIONS: ChallengeCorrectionItem[] = [
  {
    type: "GRAMMAR",
    original: "wear",
    issue: "현재진행형이 필요해요",
    explanation:
      "지금 입고 있는 상태를 말하므로 주어 She 뒤에 is를 쓰고 동사에 -ing를 붙여야 해요.",
    suggested: "is wearing",
    severity: "high",
  },
  {
    type: "GRAMMAR",
    original: "shoe",
    issue: "복수형이 필요해요",
    explanation:
      "한국어의 ‘신발’은 여기서 한 켤레를 뜻하므로 shoes처럼 복수형으로 표현해요.",
    suggested: "shoes",
    severity: "medium",
  },
];

export const DEV_MOCK_CHALLENGE_QUESTION: ChallengeQuestion = {
  date: "2026-08-25",
  questionNumber: 1,
  totalQuestionCount: 3,
  promptKo: DEV_MOCK_PROMPT_KO,
  attemptStatus: "not_started",
  gradingStatus: "not_requested",
};

/**
 * 진행도 캐시의 수명.
 *
 * 실제 값은 다음 KST 자정까지 남은 시간이라 개발 중에는 몇 시간이 걸린다. 30초로 줄여
 * 만료 → 재조회 흐름을 실제로 걸어볼 수 있게 한다.
 */
const DEV_MOCK_TODAY_EXPIRES_IN_SEC = 30;

/**
 * 오늘 진행도.
 *
 * 세 문항이 `done` · `next` · `locked`로 하나씩 나오게 맞췄다 — 스테이지의 카드 3종을
 * 한 화면에서 다 보지 못하면 목으로서 쓸모가 없다.
 */
export function createDevMockToday(): ChallengeToday {
  return {
    date: DEV_MOCK_CHALLENGE_QUESTION.date,
    expiresInSeconds: DEV_MOCK_TODAY_EXPIRES_IN_SEC,
    dailyStatus: "in_progress",
    totalQuestionCount: DEV_MOCK_CHALLENGE_QUESTION.totalQuestionCount,
    nextQuestionNumber: 2,
    completedQuestionNumbers: [1],
    questions: [
      {
        questionNumber: 1,
        attemptStatus: "submitted",
        gradingStatus: "completed",
        resultAvailable: true,
      },
      {
        questionNumber: 2,
        attemptStatus: "not_started",
        gradingStatus: "not_requested",
        resultAvailable: false,
      },
      {
        questionNumber: 3,
        attemptStatus: "not_started",
        gradingStatus: "not_requested",
        resultAvailable: false,
      },
    ],
  };
}

/** attempt 발급 응답. 제출 유효시간은 명세대로 생성 시각 + 1시간이다. */
export function createDevMockAttempt(
  date: string,
  questionNumber: number,
): ChallengeAttempt {
  return {
    attemptId: `dev-attempt-${date}-${questionNumber}`,
    date,
    questionNumber,
    submissionDeadlineAtMs: Date.now() + 60 * 60 * 1_000,
  };
}

/**
 * 제출 접수 응답.
 *
 * `processing`으로 두는 이유는 결과 화면이 "채점 중"부터 그리게 하기 위해서다.
 * 곧바로 `completed`를 주면 채점 대기 화면을 한 번도 못 보고 지나간다.
 */
export function createDevMockAccepted(
  date: string,
  questionNumber: number,
): ChallengeAnswerAccepted {
  return {
    attemptId: `dev-attempt-${date}-${questionNumber}`,
    date,
    questionNumber,
    gradingStatus: "processing",
    referenceAnswer: DEV_MOCK_REFERENCE_ANSWER,
    feedbackAvailable: true,
  };
}

/** 결과 조회 응답. 폴링이 한 번 돌면 채점이 끝난 것으로 보인다. */
export function createDevMockDayResult(
  date: string,
  questionNumber: number,
): ChallengeDayResult {
  return {
    date,
    solvedQuestionCount: questionNumber,
    question: {
      questionNumber,
      promptKo: DEV_MOCK_PROMPT_KO,
      gradingStatus: "completed",
      referenceAnswer: DEV_MOCK_REFERENCE_ANSWER,
      // 로컬 파일은 제출과 함께 지워지므로 재생할 원본이 없다.
      audioUrl: null,
      hasAiResult: true,
      transcript: DEV_MOCK_TRANSCRIPT,
      feedbackSummary: DEV_MOCK_FEEDBACK_SUMMARY,
      corrections: DEV_MOCK_CORRECTIONS,
      correctedAnswer: DEV_MOCK_CORRECTED_ANSWER,
    },
  };
}

/**
 * 실제 호출을 먼저 시도하되, 정해진 시간 안에 답이 없거나 실패하면 목으로 대신한다.
 *
 * 실패를 기다리지 않고 바로 목으로 넘기는 이유는 서버가 아예 없을 때가 이 분기의
 * 전제이기 때문이다 — 연결 거부는 즉시 떨어지므로 그때까지 기다릴 이유가 없다.
 */
export async function withDevMockFallback<T>(
  load: () => Promise<T>,
  createMock: () => T,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      load().catch(() => createMock()),
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(createMock()), DEV_API_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
