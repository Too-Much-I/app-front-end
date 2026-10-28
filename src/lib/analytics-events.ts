import type { LearningLevel, LearningPart } from '@/features/learning/learning-level';
import type { ExamSessionPhase } from '@/types/exam';

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
 *   평문으로 보내면 정책이 어긋난다. 예외는 사용자 ID로 쓰는 결제용 ID 하나다
 *   (`amplitude.ts`의 `setAnalyticsUserId`, 2026-10-20 결정).
 * - 답변 내용과 채점 점수를 넣지 않는다.
 * - 오류의 원인(스택, 메시지)은 Sentry 몫이다. 여기에는 오류가 난 뒤 이용자가
 *   무엇을 했는지만 남긴다.
 *
 * 화면 조회는 `App.tsx`가 라우트 이름으로 자동 전송하므로 여기에 넣지 않는다.
 */
export type AnalyticsEvent =
  // 모의고사 퍼널
  | { name: 'exam_started' }
  | { name: 'exam_completed' }
  /**
   * 어느 화면이 아니라 어느 `phase`에서 나갔는지가 핵심이다. 안내를 듣다가 나간
   * 것과 답변하다가 나간 것은 대응이 전혀 다르다.
   */
  | {
      name: 'exam_abandoned';
      properties: {
        partNumber: number;
        questionNumber: number;
        phase: ExamSessionPhase;
      };
    }

  // 마이크 권한·테스트
  | { name: 'mic_permission_denied'; properties: { canAskAgain: boolean } }
  | {
      name: 'mic_test_failed';
      properties: { operation: MicrophoneTestFailureStage };
    }
  /**
   * `attemptCount`는 통과할 때까지 테스트를 시작한 횟수다. 1보다 크면 음성 판정
   * 임계값을 다시 볼 근거가 된다.
   */
  | { name: 'mic_test_passed'; properties: { attemptCount: number } }

  // 채점 대기
  | { name: 'grading_wait_exceeded' }
  | { name: 'grading_retry_requested' }
  /** `elapsedMs`는 진행률 UI를 얼마나 버티게 만들어야 하는지의 근거다. */
  | {
      name: 'grading_wait_abandoned';
      properties: { elapsedMs: number; gradedPartCount: number };
    }
  | { name: 'grading_completed' }

  // 피드백·재답변
  | { name: 'feedback_opened'; properties: { scope: 'summary' | 'question' } }
  | { name: 'feedback_load_slow'; properties: { elapsedMs: number } }
  | { name: 'reanswer_started'; properties: { retryCount: number } }
  | { name: 'reanswer_submitted'; properties: { retryCount: number } }
  | { name: 'reanswer_abandoned'; properties: { retryCount: number } }

  // 10초 챌린지 — 문제 단위. 하루에 끝낸 문제 수는 `challenge_submitted`로 센다.
  /**
   * attempt 발급이 성공했다. 제출 전에 나갔다 들어오면 서버가 같은 attempt를 다시 주는데,
   * 그것도 센다 — 시작 시도와 제출의 차이가 곧 중간 이탈이다.
   */
  | { name: 'challenge_started'; properties: ChallengeEventProperties }
  /** 재녹음 버튼. 첫 녹음은 발급 직후 자동으로 켜지므로 세지 않는다. */
  | { name: 'challenge_rerecorded'; properties: ChallengeEventProperties }
  /** 서버가 답변을 접수했다. 이미 끝난 응시로 판명된 제출은 세지 않는다. */
  | { name: 'challenge_submitted'; properties: ChallengeEventProperties }
  /**
   * AI 결과가 화면에 보였다. 볼 때마다 센다. 참고 답안만 보인 순간은 세지 않는다 —
   * AI 결과를 실제로 보는지가 이 기능을 유지할 근거다.
   */
  | {
      name: 'challenge_result_viewed';
      properties: ChallengeEventProperties & { entry: ChallengeResultEntry };
    }

  // 답변 익히기(학습) — 문항 단위(2026-10-28 결정). 퍼즐 → 쉐도잉 → 채점이 문항마다 한 바퀴 돈다.
  | { name: 'learning_puzzle_completed'; properties: LearningEventProperties }
  | { name: 'learning_shadowing_completed'; properties: LearningEventProperties }
  /**
   * 문항의 마지막 단계가 끝났다. Part 2~5는 채점 결과를, 퍼즐·채점이 없는 Part 1은 완료 저장을 같은
   * 이벤트로 보내고 `part`로 나눈다. 점수는 싣지 않는다.
   */
  | {
      name: 'learning_lesson_finished';
      properties: LearningEventProperties & { result: LearningLessonResult };
    }
  /** 유료 세트를 이용권 없이 열어 안내를 봤다. 그 뒤 결제로 이어지는지 퍼널로 본다. */
  | { name: 'learning_pass_required'; properties: LearningEventProperties }

  // 그 밖의 마찰 신호
  /** 어느 화면에서 가로로 돌리려 하는지. 태블릿 가로 지원 판단의 근거다. */
  | { name: 'portrait_notice_shown'; properties: { routeName: string } }
  /** 이탈을 가장 강하게 예고하는 행동이라 결과가 아니라 요청 시점에 남긴다. */
  | { name: 'learning_record_delete_requested' }
  | { name: 'optional_consent_decided'; properties: { consented: boolean } };

/** 세트·문항 ID는 싣지 않는다. 등급 공통인 Part 1도 사용자가 고른 등급을 그대로 싣는다. */
interface LearningEventProperties {
  part: LearningPart;
  level: LearningLevel;
}

/** 채점 상태 중 끝난 셋. Part 1 완료 저장은 `completed`다. */
export type LearningLessonResult = 'completed' | 'no_speech' | 'failed';

interface ChallengeEventProperties {
  questionNumber: number;
  /**
   * attempt가 정한 챌린지 날짜(`YYYY-MM-DD`). 자정을 넘겨 제출해도 시작한 날로 처리되므로
   * 이벤트 시각으로 하루를 나누면 밤 12시 근처의 응시가 다음 날로 넘어간다.
   */
  challengeDate: string;
}

/** 결과 화면에 들어온 길. 제출 직후(`submission`)와 다시 열어 본 것(`stage`)을 나눈다. */
export type ChallengeResultEntry = 'submission' | 'stage';

/**
 * 마이크 테스트가 깨진 단계. 어느 단계에서 막히는지가 안내 문구 개선의 근거다.
 *
 * 앞의 여섯 개는 `use-microphone-test.ts`의 `MicrophoneTestFailureOperation`을
 * 그대로 담을 수 있도록 상위 집합으로 두었다. 값을 잃지 않고 넘기기 위함이다.
 */
export type MicrophoneTestFailureStage =
  | 'permission-check'
  | 'permission-request'
  | 'playback-pause'
  | 'audio-mode'
  | 'recorder-prepare'
  | 'record-start'
  | 'stop-recording'
  | 'playback-attach'
  | 'playback'
  | 'permission-recheck';
