/**
 * 10초 챌린지 도메인 타입.
 *
 * 시험(`exam.ts`)과 파일을 나눈 이유: 두 도메인은 같은 녹음 생명주기를 쓸 뿐
 * 문제 식별자도(`examId` vs `challengeDate`) 채점 흐름도 달라 함께 바뀌지 않는다.
 *
 * 필드는 "10초 영작 챌린지 프론트엔드 API 명세 Draft v0.5"를 따른다.
 */

/**
 * 공개 응시 상태. 서버 내부의 attempt 생성·업로드 중은 `not_started`로,
 * 정상 제출·무음·5분 만료는 모두 `submitted`로 projection된 값이다.
 * 프론트는 이 값만으로 문제 화면과 결과 화면 중 어디로 갈지 정한다.
 */
export type ChallengeAttemptStatus = "not_started" | "submitted";

/** AI 처리 상태. `attemptStatus=submitted`와 별개로 움직인다. */
export type ChallengeGradingStatus =
  | "not_requested"
  | "pending"
  | "processing"
  | "completed"
  | "failed";

/** 하루 진행 상태. `completed`는 세 문제를 다 마쳤다는 뜻일 뿐 참여 조건이 아니다. */
export type ChallengeDailyStatus = "not_started" | "in_progress" | "completed";

/** `GET /api/v1/challenges/today` 의 result. */
export interface RawChallengeToday {
  challengeDate: string;
  /** 현재 서버 KST 날짜가 끝나는 절대 시각(ISO UTC). */
  challengeDateExpiresAt: string;
  /** 응답 생성 시점부터 날짜가 끝날 때까지 서버가 계산한 남은 초. */
  expiresInSeconds: number;
  dailyStatus: ChallengeDailyStatus;
  totalQuestionCount: number;
  /** 서버가 판단한 다음 진행 대상. 모두 끝났으면 `null`. 앱이 순서를 계산하지 않는다. */
  nextQuestionNumber: number | null;
  completedQuestionNumbers: number[];
  questions: {
    questionNumber: number;
    attemptStatus: ChallengeAttemptStatus;
    gradingStatus: ChallengeGradingStatus;
    resultAvailable: boolean;
  }[];
}

export interface ChallengeToday {
  date: string;
  /**
   * 기기 시계와 `challengeDateExpiresAt`을 직접 비교하지 않는다.
   * 서버가 준 남은 초로 타이머를 걸고, 끝나면 진행도를 다시 읽는다.
   */
  expiresInSeconds: number;
  dailyStatus: ChallengeDailyStatus;
  totalQuestionCount: number;
  nextQuestionNumber: number | null;
  completedQuestionNumbers: number[];
  questions: {
    questionNumber: number;
    attemptStatus: ChallengeAttemptStatus;
    gradingStatus: ChallengeGradingStatus;
    resultAvailable: boolean;
  }[];
}

/** `GET /api/v1/challenges/today/questions/{questionNumber}` 의 result. */
export interface RawChallengeQuestion {
  /** 서버 기준 KST 날짜. 자정 경계가 기기 시계와 갈리므로 앱이 계산하지 않는다. */
  challengeDate: string;
  questionNumber: number;
  totalQuestionCount: number;
  /** 10초 안에 영어로 바꿔 말할 한국어 문장. */
  promptKo: string;
  attemptStatus: ChallengeAttemptStatus;
  gradingStatus: ChallengeGradingStatus;
}

export interface ChallengeQuestion {
  /** `challengeDate`를 옮긴 값. 이후 요청의 `X-Challenge-Date`가 되는 값이다. */
  date: string;
  questionNumber: number;
  totalQuestionCount: number;
  promptKo: string;
  attemptStatus: ChallengeAttemptStatus;
  gradingStatus: ChallengeGradingStatus;
}

/** `POST /api/v1/challenges/today/questions/{questionNumber}/attempt` 의 result. */
export interface RawChallengeAttempt {
  attemptId: string;
  challengeDate: string;
  questionNumber: number;
  attemptStatus: ChallengeAttemptStatus;
  /** attempt 생성 시각 + 5분. 업로드·재시도·응답 유실을 수습하는 제출 유효시간이다. */
  submissionDeadlineAt: string;
  upload: {
    method: string;
    url: string;
    expiresAt: string;
    contentType: string;
    maxBytes: number;
  };
}

export interface ChallengeAttempt {
  attemptId: string;
  date: string;
  questionNumber: number;
  /** ISO 문자열을 앱 시계 기준 ms로 옮긴 값. 업로드 재시도 예산 계산에 쓴다. */
  submissionDeadlineAtMs: number;
  upload: {
    url: string;
    expiresAtMs: number;
    /** S3 PUT의 `Content-Type`. 서버가 지정한 값을 그대로 보내야 한다. */
    contentType: string;
    maxBytes: number;
  };
}

/** `POST /api/v1/challenges/today/questions/{questionNumber}/answer` 의 result. */
export interface RawChallengeAnswerAccepted {
  attemptId: string;
  challengeDate: string;
  questionNumber: number;
  attemptStatus: ChallengeAttemptStatus;
  gradingStatus: ChallengeGradingStatus;
  acceptedAt: string;
  /** 접수 즉시 내려오는 참고 답안. AI 피드백을 기다리지 않고 보여줄 수 있다. */
  referenceAnswer: string;
  feedbackAvailable: boolean;
}

export interface ChallengeAnswerAccepted {
  attemptId: string;
  date: string;
  questionNumber: number;
  gradingStatus: ChallengeGradingStatus;
  referenceAnswer: string;
  feedbackAvailable: boolean;
}

/**
 * 결과 화면이 첫 조회를 기다리지 않고 바로 그릴 수 있는 씨앗 값.
 *
 * 제출 직후 진입에만 있다. 스테이지에서 들어오면 없고, 그때는 결과 조회가 채운다.
 * 어디까지나 첫 프레임을 위한 값이라 폴링 결과가 오면 그쪽으로 덮인다.
 */
export interface ChallengeResultSeed {
  questionNumber: number;
  promptKo: string;
  gradingStatus: ChallengeGradingStatus;
  referenceAnswer: string;
}

/** `GET /api/v1/challenges/{challengeDate}/results?questionNumber={n}` 의 result. */
export interface RawChallengeQuestionResult {
  questionNumber: number;
  promptKo: string;
  attemptStatus: ChallengeAttemptStatus;
  gradingStatus: ChallengeGradingStatus;
  submittedAt: string | null;
  gradedAt: string | null;
  audioUrl: string | null;
  referenceAnswer: string | null;
  /**
   * AI 개인화 피드백. 최종 필드가 아직 동결되지 않아(명세 9절) 형태를 확정하지 않는다.
   * 화면은 지금 "있다/없다"만 쓰므로 매퍼가 `hasAiResult`로 좁힌다.
   */
  aiResult: unknown;
}

export interface RawChallengeDayResult {
  challengeDate: string;
  solvedQuestionCount: number;
  /** `questionNumber` 쿼리를 준 경우에만 온다. 그날 그 문제를 풀지 않았으면 `null`. */
  question?: RawChallengeQuestionResult | null;
}

export interface ChallengeQuestionResult {
  questionNumber: number;
  promptKo: string;
  gradingStatus: ChallengeGradingStatus;
  /** 발화가 없었거나 만료된 제출이어도 참고 답안은 유지된다. */
  referenceAnswer: string | null;
  audioUrl: string | null;
  hasAiResult: boolean;
}

export interface ChallengeDayResult {
  date: string;
  solvedQuestionCount: number;
  question: ChallengeQuestionResult | null;
}
