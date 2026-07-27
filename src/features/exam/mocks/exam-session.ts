import { mapExamSession } from "@/features/exam/map-exam-session";
import { PART3_GUIDE_AUDIO_LOGICAL_URL } from "@/features/exam/part-prelude";
import type { ApiEnvelope } from "@/types/api";
import type { ExamSession, ExamTableContext, RawExamSession } from "@/types/exam";

const MOCK_WORKSHOP_CONTEXT: ExamTableContext = {
  title: "Green City Business Workshop",
  location: "Harrison Convention Center, Room 204",
  date: "Friday, August 14",
  fee: "$45",
  items: [
    {
      time: "9:00 A.M.",
      sessionTitle: "Registration and Welcome Coffee",
    },
    {
      time: "9:30 A.M.",
      sessionTitle: "Building a Sustainable Workplace",
      speaker: "Mina Park",
    },
    {
      time: "11:00 A.M.",
      sessionTitle: "Marketing for Small Businesses",
      speaker: "Daniel Lee",
    },
    {
      time: "12:30 P.M.",
      sessionTitle: "Networking Lunch",
      note: "Lunch is included in the registration fee",
    },
  ],
};

/** POST /api/v1/exams 응답과 같은 형태의 UI 확인용 목 데이터. */
export const MOCK_EXAM_SESSION_RESPONSE = {
  isSuccess: true,
  code: "COMMON200",
  message: "요청에 성공했습니다.",
  result: {
    examId: "mock-exam-20260724",
    title: "TOEIC Speaking 모의고사",
    questions: [
      {
        part: 1,
        questionNumber: 1,
        referenceText:
          "Thank you for visiting the Riverside Community Library. The library will close at six o'clock today for a staff training session. Regular hours will resume tomorrow morning at nine.",
      },
      {
        part: 1,
        questionNumber: 2,
        referenceText:
          "Attention passengers. The express train to Central Station will depart from platform four in approximately ten minutes. Please have your tickets ready before boarding.",
      },
      {
        part: 2,
        questionNumber: 3,
        imageUrl:
          "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80",
      },
      {
        part: 2,
        questionNumber: 4,
        imageUrl:
          "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=80",
      },
      {
        part: 3,
        questionNumber: 5,
        partIntroText:
          "Imagine that an English-language magazine is conducting a survey about daily routines. You have agreed to participate in a telephone interview.",
        guideAudioUrl: PART3_GUIDE_AUDIO_LOGICAL_URL,
        text: "How often do you exercise, and where do you usually exercise?",
      },
      {
        part: 3,
        questionNumber: 6,
        text: "What kind of exercise do you enjoy the most? Why?",
      },
      {
        part: 3,
        questionNumber: 7,
        text: "Do you think companies should provide exercise facilities for employees? Why or why not?",
      },
      {
        part: 4,
        questionNumber: 8,
        text: "When and where will the workshop take place?",
        tableContext: MOCK_WORKSHOP_CONTEXT,
      },
      {
        part: 4,
        questionNumber: 9,
        text: "I heard that lunch costs an additional fee. Is that correct?",
        tableContext: MOCK_WORKSHOP_CONTEXT,
      },
      {
        part: 4,
        questionNumber: 10,
        text: "Could you tell me about all the sessions led by guest speakers?",
        tableContext: MOCK_WORKSHOP_CONTEXT,
      },
      {
        part: 5,
        questionNumber: 11,
        text: "Do you agree or disagree with the following statement? Employees should be allowed to work from home whenever they choose. Give specific reasons and examples to support your opinion.",
      },
    ],
  },
} satisfies ApiEnvelope<RawExamSession>;

/** 실제 응답과 동일한 매퍼 경계를 통과시켜 화면에는 안정된 도메인 타입만 전달한다. */
export function createMockExamSession(): ExamSession {
  return mapExamSession(MOCK_EXAM_SESSION_RESPONSE.result);
}
