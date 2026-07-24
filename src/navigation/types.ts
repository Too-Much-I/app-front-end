import type { ExamSession } from "@/types/exam";

export type MainTabParamList = {
  Home: undefined;
  MockExam: undefined;
  Feedback: undefined;
  Study: undefined;
  MyPage: undefined;
};

export type MockExamStackParamList = {
  MockExamReady: undefined;
  ExamPartGuide: undefined;
  MicrophoneTest: undefined;
  SoundTest: undefined;
  ExamSession: { session: ExamSession };
};

export type RootStackParamList = {
  MainTabs: undefined;
};
