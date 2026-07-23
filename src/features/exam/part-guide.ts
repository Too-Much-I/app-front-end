import type { ImageSourcePropType } from "react-native";

export interface ExamPartGuide {
  part: `Part ${number}`;
  questionNumbers: string;
  questionType: string;
  answerGuide: string;
  prepTime: string;
  answerTime: string;
  mascot: ImageSourcePropType;
}

export const EXAM_PART_GUIDES: readonly ExamPartGuide[] = [
  {
    part: "Part 1",
    questionNumbers: "Q1 ~ Q2",
    questionType: "문장 읽기",
    answerGuide: "지문에 나와 있는 텍스트를 정확한 발음, 억양, 강세로 읽기",
    prepTime: "각 45초",
    answerTime: "각 45초",
    mascot: require("../../../public/mascots/mic_rabbit.png"),
  },
  {
    part: "Part 2",
    questionNumbers: "Q3 ~ Q4",
    questionType: "사진 묘사",
    answerGuide: "사진 속 중심 인물, 주변 상황, 배경, 전체 분위기 묘사하기",
    prepTime: "각 45초",
    answerTime: "각 30초",
    mascot: require("../../../public/mascots/study_turtle.png"),
  },
  {
    part: "Part 3",
    questionNumbers: "Q5 ~ Q7",
    questionType: "듣고 질문에 답하기",
    answerGuide: "일상/취미/쇼핑 관련 질문에 대해 경험이나 의견 답변하기",
    prepTime: "문항당 3초",
    answerTime: "Q5, Q6: 각 15초\nQ7: 30초",
    mascot: require("../../../public/mascots/painting_cat.png"),
  },
  {
    part: "Part 4",
    questionNumbers: "Q8 ~ Q10",
    questionType: "제공된 정보 활용 답변",
    answerGuide: "표/일정표/프로그램 안내문을 보고 물어보는 질문에 답하기",
    prepTime: "지문 읽기 45초\n+ 문항당 3초",
    answerTime: "Q8, Q9: 각 15초\nQ10: 30초",
    mascot: require("../../../public/mascots/music_bird.png"),
  },
  {
    part: "Part 5",
    questionNumbers: "Q11",
    questionType: "의견 제시하기",
    answerGuide: "특정 주제에 대해 자신의 찬/반 입장이나 선호도를 밝히고 이유와 근거 제시",
    prepTime: "45초",
    answerTime: "60초",
    mascot: require("../../../public/mascots/detective_rabbit.png"),
  },
];
