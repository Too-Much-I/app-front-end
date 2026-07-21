export interface ExamTableItem {
  time: string;
  sessionTitle: string;
  speaker?: string | null;
  note?: string;
}

export interface ExamTableContext {
  title: string;
  location: string;
  date: string;
  fee: string;
  items: ExamTableItem[];
}

export interface RawExamQuestion {
  part: number;
  questionNumber: number;
  referenceText?: string;
  imageUrl?: string;
  text?: string;
  tableContext?: ExamTableContext;
  audioUrl?: string;
  /** Part 3 setup narration text ("Imagine a cooking magazine..."), read once before the part's first question. */
  partIntroText?: string;
  /** Narrated audio for partIntroText. */
  guideAudioUrl?: string;
}

export interface RawExamSession {
  examId: string;
  title: string;
  questions: RawExamQuestion[];
}

export interface ExamQuestion {
  partNumber: number;
  questionNumber: number;
  referenceText?: string;
  imageUrl?: string;
  question?: string;
  audioUrl?: string;
  tableContext?: ExamTableContext;
  /** Part 3 setup narration text ("Imagine a cooking magazine..."), read once before the part's first question. */
  partIntroText?: string;
  /** Narrated audio for partIntroText. */
  guideAudioUrl?: string;
  prepTimeSec: number;
  speakTimeSec: number;
  /** 같은 파트의 첫 문제인지. Part 4의 첫 문제(Q8) 앞에는 정보를 읽는 45초가 별도로 주어진다. */
  isFirstInPart: boolean;
  /** 같은 파트의 마지막 문제인지. Part 4의 마지막 문제(Q10)는 질문 오디오를 두 번 들려준다. */
  isLastInPart: boolean;
}

export interface ExamSession {
  examId: string;
  title: string;
  questions: ExamQuestion[];
}

export interface ExamAttempt {
  id: string;
  status: "in_progress" | "uploading" | "grading" | "completed" | "failed";
  startedAt: string;
}

/** GET /api/v1/exams/{examId}/questions/{questionId}/upload-url 의 result */
export interface ExamAnswerUploadUrl {
  uploadUrl: string;
  fileKey: string;
  expiresIn: number;
}

/** POST /api/v1/exams/{examId}/questions/{questionId}/submit 의 result */
export interface ExamAnswerSubmitResult {
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
}

/** GET /api/v1/exams/{examId}/questions/status (문항별 재시도 채점 진행 상태 폴링)의 result */
export interface ExamQuestionPollResult {
  examId: string;
  questionNumber: number;
  retryCount: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
}

/** GET /api/v1/exams/{examId}/status 의 result */
export interface ExamGradingStatus {
  examId: string;
  overallStatus: "PROCESSING" | "COMPLETED" | "FAILED";
  progressPercent: number;
}

/** AI 채점 에이전트가 파트별로 내려주는 피드백. part1~part5 고정 키. */
export interface RawExamPartFeedback {
  part1: string;
  part2: string;
  part3: string;
  part4: string;
  part5: string;
}

/** 파트별 세부 점수. 채점 대상 파트만 내려온다 (예: 재응시한 파트만 포함). */
export interface ExamPartScores {
  part1?: number;
  part2?: number;
  part3?: number;
  part4?: number;
  part5?: number;
}

/** GET /api/v1/exams/{examId}/summary 의 result */
export interface RawExamSummaryResult {
  examId: string;
  totalScore: number;
  levelEstimate: string;
  /** 중단(terminate)한 응시는 여기까지만 풀렸다 — 앞/뒤로 이동 없이 순서대로 응시하므로,
   * 1부터 이 값까지의 전체 문제 번호(EXAM_PART_QUESTION_NUMBERS 참고)가 곧 풀린 문제다. */
  totalSolvedQuestions: number;
  summary: string;
  overallFeedback: string;
  partFeedback: RawExamPartFeedback;
  /** 다른 AI 채점 필드처럼(RawExamQuestionFeedback 참고) 내용이 없으면 빈 배열 대신 null로
   * 내려올 수 있다 — 특히 중단(terminate)해서 일부 파트만 채점된 경우 관측됨. */
  strengths: string[] | null;
  weaknesses: string[] | null;
  recommendedPractice: string[] | null;
  partScores: ExamPartScores;
}

export interface ExamPartFeedback {
  partNumber: number;
  feedback: string;
}

export interface ExamGradingResult {
  examId: string;
  totalScore: number;
  maxScore: number;
  levelEstimate: string;
  totalSolvedQuestions: number;
  summary: string;
  overallFeedback: string;
  partFeedback: ExamPartFeedback[];
  strengths: string[];
  weaknesses: string[];
  recommendedPractice: string[];
  partScores: ExamPartScores;
}

/** 문장/구간 단위 첨삭 항목. correctionItems, offTopicItems가 이 모양을 공유한다. */
export interface RawExamCorrectionItem {
  type: string;
  original: string;
  issue: string;
  explanation: string;
  suggested: string;
  /** AI 채점 결과라 어휘가 고정돼 있지 않다 — "high"/"medium"/"low"뿐 아니라 "major"/"minor" 등
   * 다른 값도 실측으로 확인됐다. 문자열 그대로 두고 소비하는 쪽에서 정규화한다. */
  severity: string;
}

/**
 * Azure Pronunciation Assessment 세부 지표 하나. 실측 응답에서 배열의 각 원소가 4개 키
 * (accuracy_score/fluency_score/completeness_score/prosody_score) 중 딱 하나만 담은
 * 채로 내려온다 — 예: [{accuracy_score: 94.7}, {fluency_score: 93.3}, ...]. 원소 순서나
 * 개수가 보장되지 않아 매퍼(map-exam-question-feedback.ts)에서 하나의 객체로 합친다.
 */
export type RawExamDetailedScoreItem = Partial<
  Record<
    "accuracy_score" | "fluency_score" | "completeness_score" | "prosody_score",
    number
  >
>;

/**
 * GET /api/v1/exams/{examId}/questions/{questionNumber} 의 result.question.feedback.
 * 스웨거 스펙(v3/api-docs)에는 이 안이 snake_case로 문서화돼 있지만,
 * 실제 서버 응답은 camelCase로 내려온다 — 스펙이 실제 구현과 어긋나 있으니
 * 필드명은 실측(콘솔 로그) 기준으로 맞춘다.
 */
export interface RawExamQuestionFeedback {
  summary: string;
  level: string;
  /** 다른 항목처럼 값이 없으면 빈 배열 대신 null로 내려올 수 있다. */
  strengths: string[] | null;
  weaknesses: string[] | null;
  pronunciation: string;
  fluency: string;
  content: string;
  /** Azure Pronunciation Assessment 세부 지표(정확도/유창성/완전성/운율), 0~100점. */
  detailedScores?: RawExamDetailedScoreItem[] | null;
  /** Part 1(낭독)에는 내용 적합성 개념이 없어 null로 내려온다. */
  contentRelevanceScore: number | null;
  grammarVocabulary: string;
  actionItems: string[] | null;
  /** 채점 항목에 문제가 없으면 빈 배열이 아니라 null로 내려오기도 한다. */
  correctionItems: RawExamCorrectionItem[] | null;
  offTopicItems: string[] | null;
  /** "모범답안" 탭에 대응. */
  correctedAnswer: string | null;
  /** "추천답안" 탭에 대응. */
  recommendedAnswer: string | null;
  nextStrategy: string | null;
}

/**
 * Azure Pronunciation Assessment 기반 단어별 발음 채점. Part 1(낭독)에서만 내려오며,
 * word는 실제로 인식된(발화된) 단어 순서라 transcript(정제된 참고 답안)와 1:1로 대응하지 않는다.
 * 스웨거 스펙은 snake_case로 문서화돼 있지만 실제 응답은 camelCase다 (feedback과 동일한 불일치).
 */
export interface RawSpokenWord {
  index: number;
  segmentIndex: number;
  wordIndex: number;
  word: string;
  offset: number;
  duration: number;
  accuracyScore: number;
  pronunciationScore: number;
  /** Azure 오류 태그. "None"이면 정상, 그 외(Mispronunciation/Omission/Insertion 등)는 오류. */
  errorType: string;
}

/** GET /api/v1/exams/{examId}/questions/{questionNumber} 의 result.question.questionInfo — 문제 원문. */
export interface RawExamQuestionInfo {
  part: number;
  questionNumber: number;
  text?: string;
  referenceText?: string;
  partIntroText?: string;
  audioUrl?: string;
  guideAudioUrl?: string;
  imageUrl?: string;
  tableContext?: ExamTableContext;
  prepTimeSec: number;
  speakTimeSec: number;
}

/** GET /api/v1/exams/{examId}/questions/{questionNumber} 의 result.question */
export interface RawExamQuestionDetail {
  partNumber: number;
  questionNumber: number;
  /** 지금 조회 중인 회차. 최초 응시가 0-base 인덱스 0이고, 재답변마다 1씩 늘어난다. */
  retryCount: number;
  /**
   * 최초 응시를 포함한 전체 시도 "횟수"(1부터 시작 — 실제 응답으로 확인됨: 재시도가 전혀
   * 없는 문제도 1로 내려온다). retryCount가 0-base 인덱스이므로 유효한 마지막 인덱스는
   * totalRetryCount - 1이다.
   */
  totalRetryCount: number;
  audioUrl: string;
  score: number;
  maxScore: number;
  transcript: string;
  feedback: RawExamQuestionFeedback;
  spokenWordSequence?: RawSpokenWord[];
  questionInfo: RawExamQuestionInfo;
}

/** GET /api/v1/exams/{examId}/questions/{questionNumber} 의 result */
export interface RawExamQuestionDetailResult {
  examId: string;
  question: RawExamQuestionDetail;
}

export interface ExamCorrectionItem {
  type: string;
  original: string;
  issue: string;
  explanation: string;
  suggested: string;
  /** AI 채점 결과라 어휘가 고정돼 있지 않다 — "high"/"medium"/"low"뿐 아니라 "major"/"minor" 등
   * 다른 값도 실측으로 확인됐다. 문자열 그대로 두고 소비하는 쪽에서 정규화한다. */
  severity: string;
}

/**
 * Azure Pronunciation Assessment 세부 지표(0~100점). completeness는 Part 1(낭독)에만
 * 의미가 있어 파트 2 이후 화면에서는 값이 있어도 표시하지 않는다 —
 * src/components/exam/exam-question-feedback-screen.tsx 참고.
 */
export interface ExamDetailedScores {
  accuracyScore: number | null;
  fluencyScore: number | null;
  completenessScore: number | null;
  prosodyScore: number | null;
}

export interface ExamQuestionFeedback {
  summary: string;
  level: string;
  strengths: string[];
  weaknesses: string[];
  pronunciation: string;
  fluency: string;
  content: string;
  detailedScores: ExamDetailedScores;
  contentRelevanceScore: number | null;
  grammarVocabulary: string;
  actionItems: string[];
  correctionItems: ExamCorrectionItem[];
  offTopicItems: string[];
  correctedAnswer: string | null;
  recommendedAnswer: string | null;
  nextStrategy: string | null;
}

export interface SpokenWord {
  segmentIndex: number;
  word: string;
  accuracyScore: number;
  errorType: string;
  /** Azure Pronunciation Assessment 기준 100ns 단위(tick). 오디오 상 발화 시작 위치. */
  offset: number;
  /** Azure Pronunciation Assessment 기준 100ns 단위(tick). 발화 지속 시간. */
  duration: number;
}

/** 문제별 피드백 화면에서 쓰는 문제 원문 — 라이브 응시 화면의 ExamQuestion과 구조는 비슷하지만
 * isFirstInPart/isLastInPart처럼 응시 흐름 전용인 필드는 없다. */
export interface ExamQuestionInfo {
  partNumber: number;
  questionNumber: number;
  text?: string;
  referenceText?: string;
  partIntroText?: string;
  audioUrl?: string;
  guideAudioUrl?: string;
  imageUrl?: string;
  tableContext?: ExamTableContext;
  prepTimeSec: number;
  speakTimeSec: number;
}

export interface ExamQuestionDetail {
  examId: string;
  partNumber: number;
  questionNumber: number;
  retryCount: number;
  totalRetryCount: number;
  audioUrl: string;
  score: number;
  maxScore: number;
  transcript: string;
  feedback: ExamQuestionFeedback;
  spokenWordSequence: SpokenWord[];
  questionInfo: ExamQuestionInfo;
}
