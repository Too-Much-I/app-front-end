export interface ExamPartMeta {
  titleKo: string;
  titleEn: string;
}

export const EXAM_PART_META: Record<number, ExamPartMeta> = {
  1: { titleKo: "지문 읽기", titleEn: "Read a Text Aloud" },
  2: { titleKo: "사진 묘사", titleEn: "Describe a Picture" },
  3: { titleKo: "질문에 답하기", titleEn: "Respond to Questions" },
  4: {
    titleKo: "정보를 활용해 답하기",
    titleEn: "Respond to Questions Using Information Provided",
  },
  5: { titleKo: "의견 제시하기", titleEn: "Express an Opinion" },
};

export function getExamPartMeta(part: number): ExamPartMeta {
  return (
    EXAM_PART_META[part] ?? { titleKo: `Part ${part}`, titleEn: `Part ${part}` }
  );
}

/** 파트별 문제 번호. 토익 스피킹 정규 구성(Part1~2: 2문제, Part3~4: 3문제, Part5: 1문제) 기준. */
export const EXAM_PART_QUESTION_NUMBERS: Record<number, number[]> = {
  1: [1, 2],
  2: [3, 4],
  3: [5, 6, 7],
  4: [8, 9, 10],
  5: [11],
};

export function getExamPartQuestionNumbers(part: number): number[] {
  return EXAM_PART_QUESTION_NUMBERS[part] ?? [];
}

/** questionNumber가 속한 파트 번호를 찾는다. 정규 구성에 없는 번호면 null. */
export function getExamPartNumberByQuestionNumber(
  questionNumber: number,
): number | null {
  for (const [partNumber, questionNumbers] of Object.entries(
    EXAM_PART_QUESTION_NUMBERS,
  )) {
    if (questionNumbers.includes(questionNumber)) return Number(partNumber);
  }
  return null;
}

export interface ExamPartTiming {
  prepTimeSec: number;
  speakTimeSec: number;
}

/** 파트별 준비/답변 시간. 토익 스피킹 정규 구성 기준의 고정값 — 실제 시험 형식이 바뀌기 전엔 변하지 않는다. */
export function getExamPartTiming(
  partNumber: number,
  isLastInPart: boolean,
): ExamPartTiming {
  switch (partNumber) {
    case 1: // Read a Text Aloud
      return { prepTimeSec: 45, speakTimeSec: 45 };
    case 2: // Describe a Picture
      return { prepTimeSec: 45, speakTimeSec: 30 };
    case 3: // Respond to Questions
      return isLastInPart
        ? { prepTimeSec: 3, speakTimeSec: 30 }
        : { prepTimeSec: 3, speakTimeSec: 15 };
    case 4: // Respond to Questions Using Information Provided
      // 첫 문제(Q8) 앞의 45초 정보 읽는 시간은 prepTimeSec이 아니라 별도의
      // reading-time phase(exam-session-screen.tsx)로 처리된다. 오디오 재생 후
      // 준비 시간은 Q8~Q10 모두 3초로 동일하다.
      return {
        prepTimeSec: 3,
        speakTimeSec: isLastInPart ? 30 : 15,
      };
    case 5: // Express an Opinion
      return { prepTimeSec: 45, speakTimeSec: 60 };
    default:
      return { prepTimeSec: 30, speakTimeSec: 30 };
  }
}

/** questionNumber만으로 파트 내 몇 번째 문제인지 판별해 타이밍을 계산한다. */
export function getExamPartTimingByQuestionNumber(
  partNumber: number,
  questionNumber: number,
): ExamPartTiming {
  const questionNumbers = getExamPartQuestionNumbers(partNumber);
  const isLastInPart =
    questionNumbers[questionNumbers.length - 1] === questionNumber;
  return getExamPartTiming(partNumber, isLastInPart);
}
