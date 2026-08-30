import type { NavigatorScreenParams } from "@react-navigation/native";

import type { ChallengeInitialResult } from "@/types/challenge";
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
  /**
   * 10초 챌린지 문제 화면. 오늘의 진행도(스테이지) 화면이 자기가 받은 `challengeDate`와
   * 진행할 문제 번호를 넘긴다. 날짜는 앱이 계산한 값이 아니라 서버가 준 값이어야 한다 —
   * 이후 요청의 `X-Challenge-Date`가 되어 자정을 넘긴 화면을 서버가 걸러낸다.
   */
  TenSecondChallenge: { challengeDate?: string; questionNumber: number };
  /**
   * 10초 챌린지 결과 화면. 제출 직후 문제 화면을 replace하며 들어오거나, 스테이지에서
   * 이미 푼 문장을 눌러 들어온다. 두 경로가 같은 화면이라 넘기는 값은 날짜와 문제 번호뿐이고
   * 참고 답안·채점 상태는 전부 결과 조회 API에서 다시 읽는다.
   */
  ChallengeResult: {
    challengeDate: string;
    questionNumber: number;
    /**
     * 제출 접수 응답에서 바로 받은 값. 있으면 결과 화면이 첫 조회를 기다리지 않고
     * 참고 답안까지 그린다. 스테이지에서 들어올 때는 없고, 그때는 결과 조회가 채운다.
     */
    initialResult?: ChallengeInitialResult;
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
