import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getExamPartDirections } from "@/features/exam/part-directions";
import {
  AnswerRecordingError,
  useAnswerRecorder,
} from "@/features/exam/use-answer-recorder";
import { useAnswerSubmissions } from "@/features/exam/use-answer-submissions";
import type { ExamPartPrelude, ExamSession, FinalizedAnswer } from "@/types/exam";

export type ExamSessionPhase =
  | "directions"
  | "part3-intro"
  | "part4-reading"
  | "part-prelude-error"
  | "preparation"
  | "starting-response"
  | "response"
  | "finalizing"
  | "interrupted"
  | "recording-recovery"
  | "registration-recovery"
  | "submission-barrier"
  | "completed";

const TIMER_UPDATE_INTERVAL_MS = 100;

function getQuestionStartPhase(partNumber: number | undefined): ExamSessionPhase {
  return partNumber !== undefined && getExamPartDirections(partNumber)
    ? "directions"
    : "preparation";
}

function getPartPrelude(
  partPreludes: ExamPartPrelude[],
  partNumber: number | undefined,
): ExamPartPrelude | undefined {
  return partPreludes.find((prelude) => prelude.partNumber === partNumber);
}

export function useExamSessionController(session: ExamSession, isExamActive: boolean) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<ExamSessionPhase>(() =>
    getQuestionStartPhase(session.questions[0]?.partNumber),
  );
  const [preparationRemainingMs, setPreparationRemainingMs] = useState(
    (session.questions[0]?.prepTimeSec ?? 0) * 1_000,
  );
  const [readingRemainingMs, setReadingRemainingMs] = useState(0);
  const [isReadingTableVisible, setIsReadingTableVisible] = useState(false);
  const [pendingFinalizedAnswer, setPendingFinalizedAnswer] =
    useState<FinalizedAnswer | null>(null);
  const phaseRef = useRef(phase);
  const currentIndexRef = useRef(currentIndex);
  const transitionPromiseRef = useRef<Promise<void> | null>(null);
  const beginResponseRef = useRef<() => void>(() => undefined);
  const readingRemainingMsRef = useRef(0);
  const completedPartPreludesRef = useRef(new Set<number>());
  const isExamActiveRef = useRef(isExamActive);
  isExamActiveRef.current = isExamActive;
  const recorder = useAnswerRecorder();
  const submissions = useAnswerSubmissions(session.questions.length);
  const question = session.questions[currentIndex];
  const partPrelude = getPartPrelude(session.partPreludes, question?.partNumber);

  const updatePhase = useCallback((nextPhase: ExamSessionPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const advanceAfterRegistration = useCallback(() => {
    const activeIndex = currentIndexRef.current;
    if (activeIndex >= session.questions.length - 1) {
      updatePhase("submission-barrier");
      return;
    }

    const currentQuestion = session.questions[activeIndex];
    const nextIndex = activeIndex + 1;
    const nextQuestion = session.questions[nextIndex];
    currentIndexRef.current = nextIndex;
    setCurrentIndex(nextIndex);
    setPreparationRemainingMs(nextQuestion.prepTimeSec * 1_000);
    updatePhase(
      nextQuestion.partNumber !== currentQuestion.partNumber
        ? getQuestionStartPhase(nextQuestion.partNumber)
        : "preparation",
    );
  }, [session.questions, updatePhase]);

  const registerFinalizedAnswer = useCallback(
    (answer: FinalizedAnswer) => {
      try {
        const result = submissions.register(answer);
        if (!result.accepted) {
          setPendingFinalizedAnswer(answer);
          if (result.reason === "invalid-file") {
            recorder.resetForRetry();
            setPendingFinalizedAnswer(null);
            updatePhase("recording-recovery");
          } else {
            updatePhase("registration-recovery");
          }
          return false;
        }

        recorder.transferOwnership(answer.audioFileUri);
        setPendingFinalizedAnswer(null);
        advanceAfterRegistration();
        return true;
      } catch (error) {
        console.error("[ExamSession] 답변 registry 등록 실패", error);
        setPendingFinalizedAnswer(answer);
        updatePhase("registration-recovery");
        return false;
      }
    },
    [advanceAfterRegistration, recorder, submissions, updatePhase],
  );

  const finishResponse = useCallback(
    (reason: "user" | "native-timeout" | "fallback-timeout" = "user") => {
      const activePromise = transitionPromiseRef.current;
      if (activePromise) return activePromise;
      if (phaseRef.current !== "response" && phaseRef.current !== "finalizing") {
        return Promise.resolve();
      }

      updatePhase("finalizing");
      const transitionPromise = recorder
        .finish(reason)
        .then((answer) => {
          registerFinalizedAnswer(answer);
        })
        .catch((error: unknown) => {
          console.error("[ExamSession] 답변 확정 실패", error);
          updatePhase(
            error instanceof AnswerRecordingError && error.stage === "interruption"
              ? "interrupted"
              : "recording-recovery",
          );
        })
        .finally(() => {
          if (transitionPromiseRef.current === transitionPromise) {
            transitionPromiseRef.current = null;
          }
        });
      transitionPromiseRef.current = transitionPromise;
      return transitionPromise;
    },
    [recorder, registerFinalizedAnswer, updatePhase],
  );

  const beginResponse = useCallback(() => {
    const allowedPhases: ExamSessionPhase[] = [
      "preparation",
      "interrupted",
      "recording-recovery",
    ];
    if (!allowedPhases.includes(phaseRef.current) || transitionPromiseRef.current) {
      return transitionPromiseRef.current ?? Promise.resolve();
    }
    const activeQuestion = session.questions[currentIndexRef.current];
    if (!activeQuestion) return Promise.resolve();

    recorder.resetForRetry();
    updatePhase("starting-response");
    const transitionPromise = recorder
      .start({
        key: {
          examId: session.examId,
          questionNumber: activeQuestion.questionNumber,
          retryCount: 0,
        },
        maxDurationMs: activeQuestion.speakTimeSec * 1_000,
      })
      .then((result) => {
        if (result.started) {
          updatePhase("response");
          return;
        }
        if (result.reason === "interrupted") updatePhase("interrupted");
        else updatePhase("recording-recovery");
      })
      .catch((error: unknown) => {
        console.error("[ExamSession] 답변 녹음 시작 실패", error);
        updatePhase("recording-recovery");
      })
      .finally(() => {
        if (transitionPromiseRef.current === transitionPromise) {
          transitionPromiseRef.current = null;
        }
      });
    transitionPromiseRef.current = transitionPromise;
    return transitionPromise;
  }, [recorder, session.examId, session.questions, updatePhase]);
  beginResponseRef.current = () => {
    void beginResponse();
  };

  const completeDirections = useCallback(() => {
    if (phaseRef.current !== "directions" || !question) return;

    if (!completedPartPreludesRef.current.has(question.partNumber)) {
      if ((question.partNumber === 3 || question.partNumber === 4) && !partPrelude) {
        updatePhase("part-prelude-error");
        return;
      }
      if (partPrelude?.kind === "invalid") {
        updatePhase("part-prelude-error");
        return;
      }
      if (partPrelude?.kind === "part3-intro") {
        updatePhase("part3-intro");
        return;
      }
      if (partPrelude?.kind === "part4-reading") {
        const durationMs = partPrelude.durationSec * 1_000;
        readingRemainingMsRef.current = durationMs;
        setReadingRemainingMs(durationMs);
        setIsReadingTableVisible(false);
        updatePhase("part4-reading");
        return;
      }
    }

    setPreparationRemainingMs(question.prepTimeSec * 1_000);
    updatePhase("preparation");
  }, [partPrelude, question, updatePhase]);

  const completePart3Intro = useCallback(() => {
    if (phaseRef.current !== "part3-intro" || !question) return;
    completedPartPreludesRef.current.add(question.partNumber);
    setPreparationRemainingMs(question.prepTimeSec * 1_000);
    updatePhase("preparation");
  }, [question, updatePhase]);

  const completePart4Reading = useCallback(() => {
    if (phaseRef.current !== "part4-reading" || !question) return;
    completedPartPreludesRef.current.add(question.partNumber);
    readingRemainingMsRef.current = 0;
    setReadingRemainingMs(0);
    setPreparationRemainingMs(question.prepTimeSec * 1_000);
    updatePhase("preparation");
  }, [question, updatePhase]);

  const markPart4TableVisible = useCallback(() => {
    if (phaseRef.current === "part4-reading") setIsReadingTableVisible(true);
  }, []);

  const retryRegistration = useCallback(() => {
    if (!pendingFinalizedAnswer) return;
    registerFinalizedAnswer(pendingFinalizedAnswer);
  }, [pendingFinalizedAnswer, registerFinalizedAnswer]);

  const retryRecording = useCallback(() => {
    void beginResponse();
  }, [beginResponse]);

  useEffect(() => {
    if (phase !== "preparation" || !question) return;
    const deadline = Date.now() + question.prepTimeSec * 1_000;
    setPreparationRemainingMs(question.prepTimeSec * 1_000);
    const tick = () => {
      const remaining = Math.max(0, deadline - Date.now());
      setPreparationRemainingMs(remaining);
      if (remaining === 0) beginResponseRef.current();
    };
    const intervalId = setInterval(tick, TIMER_UPDATE_INTERVAL_MS);
    tick();
    return () => clearInterval(intervalId);
  }, [currentIndex, phase, question]);

  useEffect(() => {
    if (phase !== "part4-reading" || !isReadingTableVisible || !isExamActive) return;

    const deadline = Date.now() + readingRemainingMsRef.current;
    const tick = () => {
      if (phaseRef.current !== "part4-reading" || !isExamActiveRef.current) return;
      const remaining = Math.max(0, deadline - Date.now());
      readingRemainingMsRef.current = remaining;
      setReadingRemainingMs(remaining);
      if (remaining === 0) completePart4Reading();
    };
    const intervalId = setInterval(tick, TIMER_UPDATE_INTERVAL_MS);
    tick();

    return () => {
      clearInterval(intervalId);
      if (phaseRef.current === "part4-reading") {
        readingRemainingMsRef.current = Math.max(0, deadline - Date.now());
      }
    };
  }, [completePart4Reading, isExamActive, isReadingTableVisible, phase]);

  useEffect(() => {
    if (phase === "response" && recorder.remainingMs <= 0) {
      void finishResponse("native-timeout");
    }
  }, [finishResponse, phase, recorder.remainingMs]);

  useEffect(() => {
    if (
      (phase === "response" || phase === "starting-response") &&
      recorder.status === "interrupted"
    ) {
      updatePhase("interrupted");
    }
  }, [phase, recorder.status, updatePhase]);

  useEffect(() => {
    if (phase === "submission-barrier" && submissions.summary.isComplete) {
      updatePhase("completed");
    }
  }, [phase, submissions.summary.isComplete, updatePhase]);

  const remainingSeconds = useMemo(() => {
    if (phase === "part4-reading") return readingRemainingMs / 1_000;
    if (phase === "response" || phase === "finalizing") {
      return recorder.remainingMs / 1_000;
    }
    return preparationRemainingMs / 1_000;
  }, [phase, preparationRemainingMs, readingRemainingMs, recorder.remainingMs]);

  return {
    currentIndex,
    question,
    partPrelude,
    phase,
    remainingSeconds,
    recorder,
    submissions,
    completeDirections,
    completePart3Intro,
    completePart4Reading,
    markPart4TableVisible,
    beginResponse,
    finishResponse,
    retryRecording,
    retryRegistration,
  };
}
