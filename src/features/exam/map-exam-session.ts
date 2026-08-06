import { getExamPartTiming } from "@/features/exam/part-meta";
import { normalizeExamPartPreludes } from "@/features/exam/part-prelude";
import { assertQuestionAudioAvailable } from "@/features/exam/question-audio";
import type {
  ExamSession,
  RawExamQuestion,
  RawExamSession,
} from "@/types/exam";

export function mapExamSession(raw: RawExamSession): ExamSession {
  // 파트 사전 정보 판정보다 먼저 본다. 질문 오디오 누락은 특정 파트가 아니라
  // 응시 자체를 막는 조건이라, 응시자가 답변을 시작하기 전에 걸러야 한다.
  assertQuestionAudioAvailable(raw);

  if (__DEV__) {
    console.log(
      "[ExamSession] Part 4 raw response",
      raw.questions
        .filter((question) => question.part === 4)
        .map((question) => ({
          questionNumber: question.questionNumber,
          keys: Object.keys(question),
          imageFields: Object.fromEntries(
            Object.entries(question).filter(([key]) => /image|table/i.test(key)),
          ),
        })),
    );
  }

  const { partPreludes, canonicalPart4ImageUrl } = normalizeExamPartPreludes(raw.questions);
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
      tableImageUrl: q.part === 4 ? canonicalPart4ImageUrl : q.tableImageUrl,
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
    partPreludes,
  };
}
