import { createStore } from "zustand/vanilla";

import { getExamPartDirections } from "@/features/exam/part-directions";
import { decidePartPrelude } from "@/features/exam/part-prelude";
import { getPlayableQuestionAudioUrl } from "@/features/exam/question-audio";
import { reportOperationalError } from "@/lib/operational-error-reporting";
import { emitExamBreadcrumb } from "@/lib/sentry";
import type {
  ExamPartPrelude,
  ExamQuestion,
  ExamSession,
  ExamSessionPhase,
  FinalizedAnswer,
} from "@/types/exam";

function getQuestionStartPhase(partNumber: number | undefined): ExamSessionPhase {
  return partNumber !== undefined && getExamPartDirections(partNumber)
    ? "directions"
    : "preparation-cue";
}

export function getPartPrelude(
  partPreludes: ExamPartPrelude[],
  partNumber: number | undefined,
): ExamPartPrelude | undefined {
  return partPreludes.find((prelude) => prelude.partNumber === partNumber);
}

/**
 * 시험 진행 중 바뀌는 값. 지금 컨트롤러가 state와 ref 두 벌로 들고 있는 것들이며,
 * 여기서는 한 벌만 존재한다. 판단은 `get()`으로 직접 읽고 화면은 구독으로 따라온다.
 */
interface ExamSessionState {
  phase: ExamSessionPhase;
  currentIndex: number;
  preparationRemainingMs: number;
  readingRemainingMs: number;
  isReadingTableReady: boolean;
  /** registry 등록에 실패해 재시도를 기다리는 답변. 복구 화면이 이 값으로 버튼을 살린다. */
  pendingFinalizedAnswer: FinalizedAnswer | null;
}

/**
 * 밖으로 노출하는 것은 도메인 사건뿐이다. `setPhase` 같은 원시 조작을 열면
 * 호출부가 "무엇이 일어났는지"가 아니라 "무엇을 대입하는지"로 읽혀 이름이
 * 흐름을 설명하는 효과가 사라진다.
 */
interface ExamSessionActions {
  completeDirections: () => void;
  completePart3Intro: () => void;
  completePart4Reading: () => void;
  completeQuestionCue: () => void;
  completePreparationCue: () => void;
  markPart4TableReady: () => void;
  beginResponse: () => void;
  retryRecording: () => void;

  /** 타이머가 100ms마다 부른다. 남은 시간이 0이면 다음 단계로 넘긴다. */
  tickPreparation: (remainingMs: number) => void;
  tickReading: (remainingMs: number) => void;

  /** 타이머가 걷힐 때 남은 시간을 보존한다. 화면 갱신은 필요 없다. */
  suspendPreparation: (remainingMs: number) => void;
  suspendReading: (remainingMs: number) => void;

  /**
   * 녹음·제출은 훅이 수행하고, 스토어는 그 결과만 기록한다. 이름 규칙이 두 가지다.
   *
   * - `begin*`: 훅이 "시작해도 되나"를 묻는다. 지금 단계가 맞지 않으면 `false`를
   *   돌려주고 아무것도 바꾸지 않는다.
   * - 과거형: 이미 일어난 일을 알린다. 거절하지 않는다.
   */
  beginRecordingAttempt: () => boolean;
  recordingStarted: () => void;
  recordingInterrupted: () => void;
  recordingFailed: () => void;

  beginFinalizing: () => boolean;
  answerRegistered: () => void;
  answerRegistrationFailed: (answer: FinalizedAnswer) => void;
  answerFileInvalid: () => void;

  examCompleted: () => void;

  /** 답변이 registry에 받아들여진 뒤 다음 문항으로 넘어간다. */
  advanceAfterRegistration: () => void;
}

export type ExamSessionStore = ExamSessionState & ExamSessionActions;

export function createExamSessionStore(session: ExamSession) {
  const firstQuestion = session.questions[0];

  return createStore<ExamSessionStore>()((set, get) => {
    // 클로저 안의 헬퍼는 스토어 표면에 올라가지 않는다 — 위 주석의 "원시 조작 숨기기".
    const currentQuestion = (): ExamQuestion | undefined =>
      session.questions[get().currentIndex];

    /**
     * phase가 바뀐 직후 호출한다. `data`는 enum·숫자만 담는다 — breadcrumb의
     * `message`는 beforeBreadcrumb(sentry.ts)이 항상 지우므로 자유 텍스트를 넣어도
     * 남지 않는다.
     */
    const emitPhaseBreadcrumb = () => {
      const { phase, currentIndex } = get();
      const question = currentQuestion();
      emitExamBreadcrumb("exam.phase", {
        phase,
        currentIndex,
        ...(question ? { partNumber: question.partNumber } : {}),
      });
    };

    const enterPreparationCue = (question: ExamQuestion) => {
      set({
        preparationRemainingMs: question.prepTimeSec * 1_000,
        phase: "preparation-cue",
      });
      emitPhaseBreadcrumb();
    };

    const enterQuestionStart = (question: ExamQuestion) => {
      if (getPlayableQuestionAudioUrl(question)) {
        set({ phase: "question-cue" });
        emitPhaseBreadcrumb();
        return;
      }
      enterPreparationCue(question);
    };

    return {
      phase: getQuestionStartPhase(firstQuestion?.partNumber),
      currentIndex: 0,
      preparationRemainingMs: (firstQuestion?.prepTimeSec ?? 0) * 1_000,
      readingRemainingMs: 0,
      isReadingTableReady: false,
      pendingFinalizedAnswer: null,

      completeDirections: () => {
        // get()은 항상 지금 값이다. phaseRef가 하던 일을 여기가 대신한다.
        if (get().phase !== "directions") return;
        const question = currentQuestion();
        if (!question) return;

        const partPrelude = getPartPrelude(session.partPreludes, question.partNumber);
        const decision = decidePartPrelude(question.partNumber, partPrelude);
        switch (decision.kind) {
          case "none":
            enterQuestionStart(question);
            return;
          case "part3-intro":
            set({ phase: "part3-intro" });
            emitPhaseBreadcrumb();
            return;
          case "part4-reading":
            set({
              readingRemainingMs: decision.durationMs,
              isReadingTableReady: false,
              phase: "part4-reading",
            });
            emitPhaseBreadcrumb();
            return;
          case "failed":
            reportOperationalError({
              code: "EXAM_PRELUDE_FAILED",
              partNumber: decision.partNumber,
              reason: decision.reason,
            });
            set({ phase: "part-prelude-error" });
            emitPhaseBreadcrumb();
            return;
          default: {
            const unhandled: never = decision;
            console.error("[ExamSession] 처리되지 않은 서두 판정", unhandled);
            set({ phase: "part-prelude-error" });
            emitPhaseBreadcrumb();
            return;
          }
        }
      },

      completePart3Intro: () => {
        if (get().phase !== "part3-intro") return;
        const question = currentQuestion();
        if (question) enterQuestionStart(question);
      },

      completePart4Reading: () => {
        const { phase, isReadingTableReady } = get();
        if (phase !== "part4-reading" || !isReadingTableReady) return;
        const question = currentQuestion();
        if (!question) return;
        set({ readingRemainingMs: 0 });
        enterQuestionStart(question);
      },

      completeQuestionCue: () => {
        if (get().phase !== "question-cue") return;
        const question = currentQuestion();
        if (question) enterPreparationCue(question);
      },

      completePreparationCue: () => {
        if (get().phase !== "preparation-cue") return;
        const question = currentQuestion();
        if (!question) return;
        set({
          preparationRemainingMs: question.prepTimeSec * 1_000,
          phase: "preparation",
        });
        emitPhaseBreadcrumb();
      },

      markPart4TableReady: () => {
        if (get().phase !== "part4-reading") return;
        set({ isReadingTableReady: true });
      },

      beginResponse: () => {
        const { phase } = get();
        if (phase !== "preparation" && phase !== "interrupted" && phase !== "recording-recovery") {
          return;
        }
        set({ phase: "response-cue" });
        emitPhaseBreadcrumb();
      },

      retryRecording: () => get().beginResponse(),

      tickPreparation: (remainingMs) => {
        if (get().phase !== "preparation") return;
        set({ preparationRemainingMs: remainingMs });
        if (remainingMs === 0) get().beginResponse();
      },

      tickReading: (remainingMs) => {
        if (get().phase !== "part4-reading") return;
        set({ readingRemainingMs: remainingMs });
        if (remainingMs === 0) get().completePart4Reading();
      },

      suspendPreparation: (remainingMs) => set({ preparationRemainingMs: remainingMs }),
      suspendReading: (remainingMs) => set({ readingRemainingMs: remainingMs }),

      beginRecordingAttempt: () => {
        if (get().phase !== "response-cue") return false;
        set({ phase: "starting-response" });
        emitPhaseBreadcrumb();
        return true;
      },

      recordingStarted: () => {
        set({ phase: "response" });
        emitPhaseBreadcrumb();
      },
      recordingInterrupted: () => {
        set({ phase: "interrupted" });
        emitPhaseBreadcrumb();
      },
      recordingFailed: () => {
        set({ phase: "recording-recovery" });
        emitPhaseBreadcrumb();
      },

      beginFinalizing: () => {
        const { phase } = get();
        if (phase !== "response" && phase !== "finalizing") return false;
        set({ phase: "finalizing" });
        emitPhaseBreadcrumb();
        return true;
      },

      answerRegistered: () => {
        set({ pendingFinalizedAnswer: null });
        get().advanceAfterRegistration();
      },

      answerRegistrationFailed: (answer) => {
        set({ pendingFinalizedAnswer: answer, phase: "registration-recovery" });
        emitPhaseBreadcrumb();
      },

      answerFileInvalid: () => {
        set({ pendingFinalizedAnswer: null, phase: "recording-recovery" });
        emitPhaseBreadcrumb();
      },

      examCompleted: () => {
        if (get().phase !== "submission-barrier") return;
        set({ phase: "completed" });
        emitPhaseBreadcrumb();
      },

      advanceAfterRegistration: () => {
        const activeIndex = get().currentIndex;
        if (activeIndex >= session.questions.length - 1) {
          set({ phase: "submission-barrier" });
          emitPhaseBreadcrumb();
          return;
        }

        const question = session.questions[activeIndex];
        const nextIndex = activeIndex + 1;
        const nextQuestion = session.questions[nextIndex];
        set({ currentIndex: nextIndex });

        if (nextQuestion.partNumber !== question.partNumber) {
          set({
            preparationRemainingMs: nextQuestion.prepTimeSec * 1_000,
            phase: getQuestionStartPhase(nextQuestion.partNumber),
          });
          emitPhaseBreadcrumb();
          return;
        }
        enterQuestionStart(nextQuestion);
      },
    };
  });
}
