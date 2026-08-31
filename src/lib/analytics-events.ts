import type { ExamSessionPhase } from "@/types/exam";

/**
 * 제품 분석 이벤트 카탈로그.
 *
 * Amplitude는 사전 등록 없이 받은 이벤트를 그대로 만들어 주므로, 오타가 나면 새
 * 이벤트가 조용히 하나 더 생기고 아무도 눈치채지 못한다. 이름과 속성을 이 union
 * 하나로 묶어 컴파일 타임에 막는다.
 *
 * 수집 원칙 — `sentry.ts`의 스크러빙 정책과 같은 기준을 쓴다.
 *
 * - `examId` 같은 식별자를 넣지 않는다. Sentry가 redact하는 값을 분석 도구에만
 *   평문으로 보내면 정책이 어긋난다.
 * - 답변 내용과 채점 점수를 넣지 않는다.
 * - 오류의 원인(스택, 메시지)은 Sentry 몫이다. 여기에는 오류가 난 뒤 이용자가
 *   무엇을 했는지만 남긴다.
 *
 * 화면 조회는 `App.tsx`가 라우트 이름으로 자동 전송하므로 여기에 넣지 않는다.
 */
export type AnalyticsEvent =
  // 모의고사 퍼널
  | { name: "exam_started" }
  | { name: "exam_completed" }
  /**
   * 어느 화면이 아니라 어느 `phase`에서 나갔는지가 핵심이다. 안내를 듣다가 나간
   * 것과 답변하다가 나간 것은 대응이 전혀 다르다.
   */
  | {
      name: "exam_abandoned";
      properties: {
        partNumber: number;
        questionNumber: number;
        phase: ExamSessionPhase;
      };
    }

  // 마이크 권한·테스트
  | { name: "mic_permission_denied"; properties: { canAskAgain: boolean } }
  | {
      name: "mic_test_failed";
      properties: { operation: MicrophoneTestFailureStage };
    }
  /**
   * `attemptCount`는 통과할 때까지 테스트를 시작한 횟수다. 1보다 크면 음성 판정
   * 임계값을 다시 볼 근거가 된다.
   */
  | { name: "mic_test_passed"; properties: { attemptCount: number } }

  // 채점 대기
  | { name: "grading_wait_exceeded" }
  | { name: "grading_retry_requested" }
  /** `elapsedMs`는 진행률 UI를 얼마나 버티게 만들어야 하는지의 근거다. */
  | {
      name: "grading_wait_abandoned";
      properties: { elapsedMs: number; gradedPartCount: number };
    }
  | { name: "grading_completed" }

  // 피드백·재답변
  | { name: "feedback_opened"; properties: { scope: "summary" | "question" } }
  | { name: "feedback_load_slow"; properties: { elapsedMs: number } }
  | { name: "reanswer_started"; properties: { retryCount: number } }
  | { name: "reanswer_submitted"; properties: { retryCount: number } }
  | { name: "reanswer_abandoned"; properties: { retryCount: number } }

  // 그 밖의 마찰 신호
  /** 어느 화면에서 가로로 돌리려 하는지. 태블릿 가로 지원 판단의 근거다. */
  | { name: "portrait_notice_shown"; properties: { routeName: string } }
  /** 이탈을 가장 강하게 예고하는 행동이라 결과가 아니라 요청 시점에 남긴다. */
  | { name: "learning_record_delete_requested" }
  | { name: "optional_consent_decided"; properties: { consented: boolean } };

/**
 * 마이크 테스트가 깨진 단계. 어느 단계에서 막히는지가 안내 문구 개선의 근거다.
 *
 * 앞의 여섯 개는 `use-microphone-test.ts`의 `MicrophoneTestFailureOperation`을
 * 그대로 담을 수 있도록 상위 집합으로 두었다. 값을 잃지 않고 넘기기 위함이다.
 */
export type MicrophoneTestFailureStage =
  | "permission-check"
  | "permission-request"
  | "playback-pause"
  | "audio-mode"
  | "recorder-prepare"
  | "record-start"
  | "stop-recording"
  | "playback-attach"
  | "playback"
  | "permission-recheck";
