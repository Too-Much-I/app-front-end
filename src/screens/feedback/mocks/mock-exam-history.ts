export type MockExamHistoryTone = "green" | "blue" | "purple" | "orange";

type MockAttemptStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

type MockExamHistoryResponse = {
  isSuccess: true;
  code: "COMMON_200";
  message: string;
  result: {
    latestCompletedExamId: string | null;
    trend: {
      maxScore: number;
      overallAverageScore: number | null;
      points: {
        examId: string;
        completedAt: string;
        score: number;
      }[];
    };
    exams: {
      examId: string;
      title: string;
      totalScore: number;
      maxScore: number;
      levelEstimate: string;
      completedAt: string;
      retriedQuestionCount: number;
    }[];
  };
};

type MockReanswerHistoryResponse = {
  isSuccess: true;
  code: "COMMON_200";
  message: string;
  result: {
    generatedAt: string;
    examId: string;
    questions: {
      partNumber: number;
      questionNumber: number;
      latestRetryCount: number;
      attempts: {
        retryCount: number;
        status: MockAttemptStatus;
        score: number | null;
        maxScore: number;
        completedAt: string | null;
      }[];
    }[];
  };
};

/**
 * 서버 이력 API가 준비되기 전 화면 검증용 fixture.
 *
 * 입력으로 받은 응답에 다음 필드를 보강했다.
 * - 시험 총점의 기준인 `maxScore`
 * - 임의 환산 없이 차트를 그리기 위한 동일 척도의 `trend`
 * - 빈 재답변 CTA가 사용할 `latestCompletedExamId`
 */
export const MOCK_EXAM_HISTORY_RESPONSE = {
  isSuccess: true,
  code: "COMMON_200",
  message: "성공입니다.",
  result: {
    latestCompletedExamId: "ex_005",
    trend: {
      maxScore: 5,
      overallAverageScore: 3.7,
      points: [
        {
          examId: "ex_001",
          completedAt: "2026-07-04T12:30:00Z",
          score: 3.2,
        },
        {
          examId: "ex_002",
          completedAt: "2026-07-11T12:30:00Z",
          score: 3.5,
        },
        {
          examId: "ex_003",
          completedAt: "2026-07-18T12:30:00Z",
          score: 3.7,
        },
        {
          examId: "ex_004",
          completedAt: "2026-07-25T12:30:00Z",
          score: 4,
        },
        {
          examId: "ex_005",
          completedAt: "2026-08-01T12:30:00Z",
          score: 4.3,
        },
      ],
    },
    exams: [
      {
        examId: "ex_005",
        title: "토선생 모의고사 5회",
        totalScore: 176,
        maxScore: 200,
        levelEstimate: "AL",
        completedAt: "2026-08-01T12:30:00Z",
        retriedQuestionCount: 3,
      },
      {
        examId: "ex_004",
        title: "토선생 모의고사 4회",
        totalScore: 164,
        maxScore: 200,
        levelEstimate: "IH",
        completedAt: "2026-07-25T12:30:00Z",
        retriedQuestionCount: 2,
      },
      {
        examId: "ex_003",
        title: "토선생 모의고사 3회",
        totalScore: 150,
        maxScore: 200,
        levelEstimate: "IM3",
        completedAt: "2026-07-18T12:30:00Z",
        retriedQuestionCount: 2,
      },
      {
        examId: "ex_002",
        title: "토선생 모의고사 2회",
        totalScore: 138,
        maxScore: 200,
        levelEstimate: "IM2",
        completedAt: "2026-07-11T12:30:00Z",
        retriedQuestionCount: 1,
      },
      {
        examId: "ex_001",
        title: "토선생 모의고사 1회",
        totalScore: 124,
        maxScore: 200,
        levelEstimate: "IL",
        completedAt: "2026-07-04T12:30:00Z",
        retriedQuestionCount: 1,
      },
    ],
  },
} satisfies MockExamHistoryResponse;

/**
 * 재답변 성과 계산용 fixture.
 *
 * `status`는 채점 대기 회차를 완료 성과와 구분하고, `maxScore`는 만점이 다른 문제끼리
 * 원점수 차이를 잘못 평균하지 않기 위해 필요하다.
 */
export const MOCK_REANSWER_HISTORY_RESPONSE = {
  isSuccess: true,
  code: "COMMON_200",
  message: "성공입니다.",
  result: {
    generatedAt: "2026-08-01T12:30:00Z",
    examId: "ex_005",
    questions: [
      {
        partNumber: 1,
        questionNumber: 1,
        latestRetryCount: 2,
        attempts: [
          {
            retryCount: 0,
            status: "COMPLETED",
            score: 2.1,
            maxScore: 3,
            completedAt: "2026-08-01T12:10:00Z",
          },
          {
            retryCount: 1,
            status: "COMPLETED",
            score: 2.6,
            maxScore: 3,
            completedAt: "2026-08-01T12:20:00Z",
          },
          {
            retryCount: 2,
            status: "COMPLETED",
            score: 2.9,
            maxScore: 3,
            completedAt: "2026-08-01T12:30:00Z",
          },
        ],
      },
      {
        partNumber: 2,
        questionNumber: 3,
        latestRetryCount: 1,
        attempts: [
          {
            retryCount: 0,
            status: "COMPLETED",
            score: 3.2,
            maxScore: 5,
            completedAt: "2026-08-01T12:05:00Z",
          },
          {
            retryCount: 1,
            status: "COMPLETED",
            score: 4.1,
            maxScore: 5,
            completedAt: "2026-08-01T12:35:00Z",
          },
        ],
      },
      {
        partNumber: 3,
        questionNumber: 6,
        latestRetryCount: 2,
        attempts: [
          {
            retryCount: 0,
            status: "COMPLETED",
            score: 2.8,
            maxScore: 5,
            completedAt: "2026-08-01T12:08:00Z",
          },
          {
            retryCount: 1,
            status: "COMPLETED",
            score: 3.6,
            maxScore: 5,
            completedAt: "2026-08-01T12:38:00Z",
          },
          {
            retryCount: 2,
            status: "COMPLETED",
            score: 4.4,
            maxScore: 5,
            completedAt: "2026-08-01T12:45:00Z",
          },
        ],
      },
      {
        partNumber: 5,
        questionNumber: 10,
        latestRetryCount: 1,
        attempts: [
          {
            retryCount: 0,
            status: "COMPLETED",
            score: 3.7,
            maxScore: 5,
            completedAt: "2026-08-01T12:15:00Z",
          },
          {
            retryCount: 1,
            status: "COMPLETED",
            score: 4.2,
            maxScore: 5,
            completedAt: "2026-08-01T12:50:00Z",
          },
        ],
      },
    ],
  },
} satisfies MockReanswerHistoryResponse;

export type MockExamHistoryItem = {
  examId: string;
  title: string;
  completedAt: string;
  chartDateLabel: string;
  level: string;
  totalScore: number;
  maxTotalScore: number;
  retriedQuestionCount: number;
  tone: MockExamHistoryTone;
};

export type MockReanswerQuestionItem = {
  examId: string;
  partNumber: number;
  questionNumber: number;
  retryCount: number;
  initialScore: number;
  latestScore: number;
  maxScore: number;
  completedAt: string;
};

function chartDateLabel(completedAt: string): string {
  const date = new Date(completedAt);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function toneForLevel(level: string): MockExamHistoryTone {
  const normalizedLevel = level.trim().toUpperCase();
  if (["AH", "AM", "AL"].includes(normalizedLevel)) return "purple";
  if (normalizedLevel === "IH") return "blue";
  if (["IM3", "IM2", "IM1"].includes(normalizedLevel)) return "green";
  return "orange";
}

export const MOCK_EXAM_HISTORY: readonly MockExamHistoryItem[] =
  MOCK_EXAM_HISTORY_RESPONSE.result.exams.map((exam) => ({
    examId: exam.examId,
    title: exam.title,
    completedAt: exam.completedAt,
    chartDateLabel: chartDateLabel(exam.completedAt),
    level: exam.levelEstimate,
    totalScore: exam.totalScore,
    maxTotalScore: exam.maxScore,
    retriedQuestionCount: exam.retriedQuestionCount,
    tone: toneForLevel(exam.levelEstimate),
  }));

/**
 * 화면이 요약·추이·목록을 모두 시험 총점으로 통일했으므로 평균도 총점에서 낸다.
 *
 * 응답의 `trend`는 5점 척도(파트 평균)라 여기서는 쓰지 않는다. 서버 계약 스냅샷으로만
 * 남겨 두고, 척도를 섞지 않기 위해 `exams`의 총점에서 직접 계산한다.
 */
export const MOCK_EXAM_AVERAGE_TOTAL_SCORE =
  MOCK_EXAM_HISTORY.length === 0
    ? 0
    : MOCK_EXAM_HISTORY.reduce((sum, exam) => sum + exam.totalScore, 0) /
      MOCK_EXAM_HISTORY.length;

export const MOCK_EXAM_MAX_TOTAL_SCORE = Math.max(
  0,
  ...MOCK_EXAM_HISTORY.map((exam) => exam.maxTotalScore),
);

export const MOCK_REANSWER_QUESTIONS: readonly MockReanswerQuestionItem[] =
  MOCK_REANSWER_HISTORY_RESPONSE.result.questions.flatMap((question) => {
    const initialAttempt = question.attempts.find(
      (attempt) => attempt.retryCount === 0 && attempt.status === "COMPLETED",
    );
    const latestAttempt = [...question.attempts]
      .filter(
        (attempt) =>
          attempt.retryCount > 0 &&
          attempt.status === "COMPLETED" &&
          attempt.score !== null,
      )
      .sort((left, right) => right.retryCount - left.retryCount)[0];

    if (
      !initialAttempt ||
      initialAttempt.score === null ||
      !latestAttempt ||
      latestAttempt.score === null ||
      // status가 COMPLETED여도 completedAt은 null로 내려올 수 있다. 카드가 이 값을
      // 그대로 날짜로 포맷하므로, 비어 있으면 항목 자체를 내보내지 않는다.
      latestAttempt.completedAt === null ||
      initialAttempt.maxScore !== latestAttempt.maxScore
    ) {
      return [];
    }

    return [
      {
        examId: MOCK_REANSWER_HISTORY_RESPONSE.result.examId,
        partNumber: question.partNumber,
        questionNumber: question.questionNumber,
        retryCount: latestAttempt.retryCount,
        initialScore: initialAttempt.score,
        latestScore: latestAttempt.score,
        maxScore: latestAttempt.maxScore,
        completedAt: latestAttempt.completedAt,
      },
    ];
  });

const improvedQuestionCount = MOCK_REANSWER_QUESTIONS.filter(
  (question) => question.latestScore > question.initialScore,
).length;
const averageDeltaRatio =
  MOCK_REANSWER_QUESTIONS.length === 0
    ? 0
    : MOCK_REANSWER_QUESTIONS.reduce(
        (sum, question) =>
          sum + (question.latestScore - question.initialScore) / question.maxScore,
        0,
      ) / MOCK_REANSWER_QUESTIONS.length;

export const MOCK_REANSWER_PROGRESS = {
  averageDeltaPercentagePoints: Math.round(averageDeltaRatio * 1_000) / 10,
  improvedQuestionCount,
  comparableQuestionCount: MOCK_REANSWER_QUESTIONS.length,
} as const;
