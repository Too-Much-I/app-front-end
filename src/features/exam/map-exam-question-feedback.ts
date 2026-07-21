import type {
  ExamDetailedScores,
  ExamQuestionDetail,
  RawExamDetailedScoreItem,
  RawExamQuestionDetailResult,
} from "@/types/exam";

/**
 * detailedScores는 원소마다 4개 키(accuracy_score/fluency_score/completeness_score/
 * prosody_score) 중 하나만 담은 채로 내려온다 — 순서·개수가 보장되지 않으므로 하나의
 * 객체로 합친 뒤 도메인 필드명으로 옮긴다. 누락된 키는 null로 취급한다.
 */
function mapDetailedScores(
  raw: RawExamDetailedScoreItem[] | null | undefined,
): ExamDetailedScores {
  const merged = (raw ?? []).reduce<RawExamDetailedScoreItem>(
    (acc, item) => ({ ...acc, ...item }),
    {},
  );
  return {
    accuracyScore: merged.accuracy_score ?? null,
    fluencyScore: merged.fluency_score ?? null,
    completenessScore: merged.completeness_score ?? null,
    prosodyScore: merged.prosody_score ?? null,
  };
}

export function mapExamQuestionDetail(
  raw: RawExamQuestionDetailResult,
): ExamQuestionDetail {
  const { question } = raw;

  return {
    examId: raw.examId,
    partNumber: question.partNumber,
    questionNumber: question.questionNumber,
    retryCount: question.retryCount,
    totalRetryCount: question.totalRetryCount,
    audioUrl: question.audioUrl,
    score: question.score,
    maxScore: question.maxScore,
    transcript: question.transcript,
    feedback: {
      summary: question.feedback.summary,
      level: question.feedback.level,
      strengths: question.feedback.strengths ?? [],
      weaknesses: question.feedback.weaknesses ?? [],
      pronunciation: question.feedback.pronunciation,
      fluency: question.feedback.fluency,
      content: question.feedback.content,
      detailedScores: mapDetailedScores(question.feedback.detailedScores),
      contentRelevanceScore: question.feedback.contentRelevanceScore,
      grammarVocabulary: question.feedback.grammarVocabulary,
      actionItems: question.feedback.actionItems ?? [],
      correctionItems: (question.feedback.correctionItems ?? []).map(
        (item) => ({
          type: item.type,
          original: item.original,
          issue: item.issue,
          explanation: item.explanation,
          suggested: item.suggested,
          severity: item.severity,
        }),
      ),
      offTopicItems: question.feedback.offTopicItems ?? [],
      correctedAnswer: question.feedback.correctedAnswer,
      recommendedAnswer: question.feedback.recommendedAnswer,
      nextStrategy: question.feedback.nextStrategy,
    },
    spokenWordSequence: (question.spokenWordSequence ?? []).map((word) => ({
      segmentIndex: word.segmentIndex,
      word: word.word,
      accuracyScore: word.accuracyScore,
      errorType: word.errorType,
      offset: word.offset,
      duration: word.duration,
    })),
    questionInfo: {
      partNumber: question.questionInfo.part,
      questionNumber: question.questionInfo.questionNumber,
      text: question.questionInfo.text,
      referenceText: question.questionInfo.referenceText,
      partIntroText: question.questionInfo.partIntroText,
      audioUrl: question.questionInfo.audioUrl,
      guideAudioUrl: question.questionInfo.guideAudioUrl,
      imageUrl: question.questionInfo.imageUrl,
      tableContext: question.questionInfo.tableContext,
      prepTimeSec: question.questionInfo.prepTimeSec,
      speakTimeSec: question.questionInfo.speakTimeSec,
    },
  };
}
