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

/**
 * `POST /api/v1/challenges/today/questions/{questionNumber}/attempt` 의 result.
 *
 * 명세 6.3. 업로드 URL은 여기 없다 — 녹음이 끝난 뒤 6.4에서 따로 받는다.
 */
export interface RawChallengeAttempt {
  attemptId: string;
  challengeDate: string;
  questionNumber: number;
  attemptStatus: ChallengeAttemptStatus;
  /**
   * attempt 생성 시각 + 1시간.
   *
   * 자정을 지나도 이때까지는 attempt가 속한 원래 `challengeDate`의 제출로 처리된다.
   * 앱이 녹음을 들어보고 다시 녹음하는 동안 날짜가 넘어가도 제출이 막히지 않는 근거다.
   */
  submissionDeadlineAt: string;
}

export interface ChallengeAttempt {
  attemptId: string;
  date: string;
  questionNumber: number;
  /** ISO 문자열을 앱 시계 기준 ms로 옮긴 값. */
  submissionDeadlineAtMs: number;
}

/**
 * `POST /api/v1/challenges/attempts/{attemptId}/upload-url` 의 result.
 *
 * 명세 6.4. 녹음이 끝난 뒤 같은 attempt에 연결된 presigned PUT URL을 받는다. 재발급해도
 * 새 응시로 계산되지 않고 attempt에 고정된 같은 S3 object key로만 발급된다.
 */
export interface RawChallengeUploadUrl {
  attemptId: string;
  submissionDeadlineAt: string;
  upload: {
    method: string;
    url: string;
    expiresAt: string;
    contentType: string;
    maxBytes: number;
  };
}

export interface ChallengeUploadUrl {
  url: string;
  expiresAtMs: number;
  /** S3 PUT의 `Content-Type`. 서버가 지정한 값을 그대로 보내야 한다. */
  contentType: string;
  maxBytes: number;
  /**
   * 발급 시점에 서버가 다시 알려준 제출 유효시각.
   *
   * attempt 생성 응답에도 같은 값이 있지만 이쪽이 최신이라 업로드 예산은 이 값으로 잰다.
   * 명세상 `upload.expiresAt`은 이 시각을 넘지 않는다.
   */
  submissionDeadlineAtMs: number;
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
 * 결과 화면이 첫 조회를 기다리지 않고 바로 그릴 수 있는 초기 결과.
 *
 * 제출 직후 진입에만 있다. 스테이지에서 들어오면 없고, 그때는 결과 조회가 채운다.
 * 어디까지나 첫 프레임을 위한 값이라 폴링 결과가 오면 그쪽으로 덮인다.
 */
export interface ChallengeInitialResult {
  questionNumber: number;
  promptKo: string;
  gradingStatus: ChallengeGradingStatus;
  referenceAnswer: string;
}

/**
 * 첨삭 항목 하나 — 내가 말한 문장에서 고칠 부분 하나에 대응한다.
 *
 * 서버는 같은 값을 camelCase와 snake_case로 **둘 다** 내려준다(`correctionItems`와
 * `correction_items`). 앱은 camelCase만 정본으로 읽고 스네이크 쪽은 선언하지 않는다 —
 * 매퍼가 모르는 키는 버려지므로 여기 없는 것으로 충분하다.
 */
export interface RawChallengeCorrectionItem {
  /** `GRAMMAR` / `EXPRESSION` / `VOCABULARY` / `CONTENT` 등. 대문자로 온다. */
  type: string;
  /** 문장에서 고칠 부분. 문자 위치는 주지 않으므로 앱이 transcript에서 찾아야 한다. */
  original: string;
  issue: string;
  explanation: string;
  suggested: string;
  /** AI 채점이라 어휘가 고정돼 있지 않다(시험 도메인에서 `major`/`minor`도 실측됐다).
   * 문자열 그대로 두고 화면 직전에 정규화한다 — `normalizeCorrectionSeverity`. */
  severity: string;
}

/**
 * 도메인 쪽 첨삭 항목. 필드가 Raw와 같은 이유는 이 응답에 정규화할 것이 없기 때문이다 —
 * `severity`와 `type`의 흔들림은 값의 문제라 타입이 아니라 화면 직전에 흡수한다.
 */
export type ChallengeCorrectionItem = RawChallengeCorrectionItem;

/**
 * `aiResult` 안에서 확인된 모양.
 *
 * 명세 9절이 형태를 동결하지 않아 `aiResult`는 `unknown`으로 받고, 매퍼가 런타임에
 * 하나씩 확인해 이 모양으로 좁힌다. 그래서 여기 필드는 전부 선택값이다 —
 * 타입 선언은 "이렇게 오면 읽는다"는 뜻이지 보장이 아니다.
 *
 * 서버가 같은 값을 스네이크(`correction_items`)로도 함께 주지만 선언하지 않는다.
 */
export interface RawChallengeAiResult {
  /** STT가 옮긴 내 발화. */
  transcript?: string | null;
  feedback?: {
    /** 화면의 "토선생의 한마디". */
    summary?: string | null;
    correctionItems?: unknown;
    /** 지적이 없으면 `null`이 아니라 빈 문자열로 온다. 매퍼가 `null`로 좁힌다. */
    correctedAnswer?: string | null;
  } | null;
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
   * `aiResult` 안에 있는 것이 확인됐지만, 형제 필드로도 오는지가 아직 확정되지 않았다.
   * 매퍼가 양쪽을 다 보므로 어느 쪽으로 와도 화면은 같다.
   */
  transcript?: string | null;
  /**
   * AI 개인화 피드백. 최종 필드가 아직 동결되지 않아(명세 9절) 형태를 확정하지 않는다.
   * 매퍼가 `RawChallengeAiResult`로 좁힌다.
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
  /**
   * STT가 옮긴 내 발화. 무음으로 제출됐거나 인식하지 못하면 `null`이다 —
   * 그때는 밑줄을 그을 문장 자체가 없다.
   */
  transcript: string | null;
  /** 화면 맨 위 "토선생의 한마디". */
  feedbackSummary: string | null;
  /** 지적할 것이 없으면 빈 배열이다. 그때는 첨삭 영역 자체를 그리지 않는다. */
  corrections: ChallengeCorrectionItem[];
  /** 내 문장을 고친 결과. 서버가 주는 빈 문자열은 매퍼가 `null`로 좁힌다. */
  correctedAnswer: string | null;
}

export interface ChallengeDayResult {
  date: string;
  solvedQuestionCount: number;
  question: ChallengeQuestionResult | null;
}
