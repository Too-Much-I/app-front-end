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
  /**
   * 신규 Guest 동의 또는 서버가 요구한 기존 사용자 재동의를 받는 인증 게이트.
   * 현재 AuthBootstrapState에 따라 controller가 이 route의 노출을 결정한다.
   */
  Consent: undefined;
  /** 앱 시작 인증 복구가 실패했을 때 실패한 작업만 다시 실행하는 화면. */
  AuthRecovery: undefined;
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
  /** 설정 화면. 탭이 아니라 홈 화면 헤더 아이콘으로 진입하는 루트 스택 push 화면이다. */
  Settings: undefined;
  /** 알림 화면. 설정과 마찬가지로 홈 화면 헤더 아이콘(벨)으로 진입하는 루트 스택 push 화면이다. */
  Notifications: undefined;
  /**
   * 설정 화면에서 여는 범용 정적 페이지 웹뷰(개인정보 처리방침, 이용약관, 문의하기 등).
   * `path`는 `EXPO_PUBLIC_WEB_BASE_URL` 뒤에 그대로 붙는 쿼리 파라미터 없는 경로다.
   */
  SettingsWebView: { path: string; title: string };
};
