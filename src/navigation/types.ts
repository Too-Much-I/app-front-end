import type { NavigatorScreenParams } from "@react-navigation/native";

import type { ExamSession } from "@/types/exam";

export type MainTabParamList = {
  Home: undefined;
  MockExam: undefined;
  /**
   * 피드백 웹뷰. `examId`만 있으면 종합 피드백을, `questionNumber`가 함께 오면 해당 문제의
   * 문제별 피드백을 연다. 최초 답변은 회차를 생략하고 재답변 결과는 `retryCount`로 특정한다.
   */
  Feedback:
    | { examId?: string; questionNumber?: number; retryCount?: number }
    | undefined;
  MyPage: undefined;
};

export type MockExamStackParamList = {
  MockExamReady: undefined;
  ExamPartGuide: undefined;
  MicrophoneTest: undefined;
  SoundTest: undefined;
  ExamSession: { session: ExamSession };
  GradingWait: { examId: string };
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  /**
   * 재답변 녹음 화면. 웹 문제별 피드백의 `REANSWER_REQUESTED`가 준 값을 그대로 받는다.
   * `nextRetryCount`는 0-base 회차 인덱스이며 앱이 다시 계산하지 않는다.
   *
   * 피드백은 탭 화면(웹뷰)이고 이 화면은 탭 위를 덮어야 하므로 루트 스택에 둔다.
   */
  Reanswer: {
    examId: string;
    questionNumber: number;
    nextRetryCount: number;
  };
};
