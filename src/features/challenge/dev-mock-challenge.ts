import type {
  ChallengeAnswerAccepted,
  ChallengeDayResult,
  ChallengeQuestion,
} from "@/types/challenge";

/**
 * 백엔드가 붙기 전까지 챌린지 화면을 끝까지 걸어보기 위한 임시 목 데이터.
 *
 * 전부 `__DEV__` 안에서만 쓰이고, 서버가 준비되면 이 파일과 아래 세 곳의 분기를
 * 함께 지우면 원래 흐름으로 돌아온다.
 *
 * - `use-challenge-question.ts`   문제 조회 — 목으로 바로 대체
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

const DEV_MOCK_REFERENCE_ANSWER =
  "I drink a glass of water as soon as I wake up every morning.";

export const DEV_MOCK_CHALLENGE_QUESTION: ChallengeQuestion = {
  date: "2026-08-25",
  questionNumber: 1,
  totalQuestionCount: 3,
  promptKo: "나는 매일 아침 일어나자마자 물 한 잔을 마셔.",
  attemptStatus: "not_started",
  gradingStatus: "not_requested",
};

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
      promptKo: DEV_MOCK_CHALLENGE_QUESTION.promptKo,
      gradingStatus: "completed",
      referenceAnswer: DEV_MOCK_REFERENCE_ANSWER,
      // 로컬 파일은 제출과 함께 지워지므로 재생할 원본이 없다.
      audioUrl: null,
      hasAiResult: true,
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
