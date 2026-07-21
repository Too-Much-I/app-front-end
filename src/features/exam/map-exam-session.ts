import { getExamPartTiming } from "@/features/exam/part-meta";
import type {
  ExamSession,
  RawExamQuestion,
  RawExamSession,
} from "@/types/exam";

export function mapExamSession(raw: RawExamSession): ExamSession {
  const partGroups = new Map<number, RawExamQuestion[]>();
  for (const q of raw.questions) {
    const group = partGroups.get(q.part) ?? [];
    group.push(q);
    partGroups.set(q.part, group);
  }

  const questions = raw.questions.map((q) => {
    const group = partGroups.get(q.part) ?? [q];
    const positionInPart = group.indexOf(q);

    const isFirstInPart = positionInPart === 0;
    const isLastInPart = positionInPart === group.length - 1;

    return {
      partNumber: q.part,
      questionNumber: q.questionNumber,
      referenceText: q.referenceText,
      imageUrl: q.imageUrl,
      question: q.text,
      audioUrl: q.audioUrl,
      tableContext: q.tableContext,
      partIntroText: q.partIntroText,
      guideAudioUrl: q.guideAudioUrl,
      isFirstInPart,
      isLastInPart,
      ...getExamPartTiming(q.part, isLastInPart),
    };
  });

  return {
    examId: raw.examId,
    title: raw.title,
    questions,
  };
}
