import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getExamPartDirections } from "@/features/exam/part-directions";
import { getPlayableQuestionAudioUrl } from "@/features/exam/question-audio";
import {
  AnswerRecordingError,
  useAnswerRecorder,
} from "@/features/exam/use-answer-recorder";
import { useAnswerSubmissions } from "@/features/exam/use-answer-submissions";
import { trackEvent } from "@/lib/amplitude";
import { reportOperationalError } from "@/lib/operational-error-reporting";
import type {
  ExamPartPrelude,
  ExamQuestion,
  ExamSession,
  FinalizedAnswer,
} from "@/types/exam";

export type ExamSessionPhase =
  | "directions"
  | "part3-intro"
  | "part4-reading"
  | "part-prelude-error"
  | "question-cue"
  | "preparation-cue"
  | "preparation"
  | "response-cue"
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
    : "preparation-cue";
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
  const [isReadingTableReady, setIsReadingTableReady] = useState(false);
  const [pendingFinalizedAnswer, setPendingFinalizedAnswer] =
    useState<FinalizedAnswer | null>(null);
  const phaseRef = useRef(phase);
  const currentIndexRef = useRef(currentIndex);
  const transitionPromiseRef = useRef<Promise<void> | null>(null);
  const beginResponseRef = useRef<() => void>(() => undefined);
  const preparationRemainingMsRef = useRef(
    (session.questions[0]?.prepTimeSec ?? 0) * 1_000,
  );
  const readingRemainingMsRef = useRef(0);
  const isReadingTableReadyRef = useRef(false);
  const completedPartPreludesRef = useRef(new Set<number>());
  const isExamActiveRef = useRef(isExamActive);
  const recordingAttemptRef = useRef(0);
  const reportedPreludesRef = useRef(new Set<number>());
  const hasTrackedCompletionRef = useRef(false);
  // 언마운트 cleanup은 첫 렌더의 props를 붙잡으므로 최신 문항 배열을 ref로 읽는다.
  const questionsRef = useRef(session.questions);
  questionsRef.current = session.questions;
  const recorder = useAnswerRecorder();
  const submissions = useAnswerSubmissions(session.questions.length);
  const question = session.questions[currentIndex];
  const partPrelude = getPartPrelude(session.partPreludes, question?.partNumber);
  // 화면과 컨트롤러가 같은 값을 보게 한다. 이 값이 없으면 question-cue로 진입하지 않는다.
  const questionAudioUrl = question ? getPlayableQuestionAudioUrl(question) : undefined;

  const updatePhase = useCallback((nextPhase: ExamSessionPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const enterPreparationCue = useCallback(
    (activeQuestion: ExamQuestion) => {
      const durationMs = activeQuestion.prepTimeSec * 1_000;
      preparationRemainingMsRef.current = durationMs;
      setPreparationRemainingMs(durationMs);
      updatePhase("preparation-cue");
    },
    [updatePhase],
  );

  /**
   * 문항 진입 지점. 재생할 질문 오디오가 있으면 준비 안내보다 먼저 듣게 한다.
   * Part 1·2는 항상 undefined라 기존 흐름 그대로 준비 안내로 간다.
   */
  const enterQuestionStart = useCallback(
    (activeQuestion: ExamQuestion) => {
      if (getPlayableQuestionAudioUrl(activeQuestion)) {
        updatePhase("question-cue");
        return;
      }
      enterPreparationCue(activeQuestion);
    },
    [enterPreparationCue, updatePhase],
  );

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    isExamActiveRef.current = isExamActive;
  }, [isExamActive]);

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
    if (nextQuestion.partNumber !== currentQuestion.partNumber) {
      setPreparationRemainingMs(nextQuestion.prepTimeSec * 1_000);
      updatePhase(getQuestionStartPhase(nextQuestion.partNumber));
    } else {
      enterQuestionStart(nextQuestion);
    }
  }, [enterQuestionStart, session.questions, updatePhase]);

  const registerFinalizedAnswer = useCallback(
    (answer: FinalizedAnswer) => {
      try {
        const result = submissions.register(answer);
        if (!result.accepted) {
          if (result.reason === "invalid-file") {
            reportOperationalError({
              code: "ANSWER_RECORDING_FAILED",
              surface: "live",
              stage: "file-validation",
              questionNumber: answer.key.questionNumber,
              retryCount: answer.key.retryCount,
              attempt: recordingAttemptRef.current,
            });
            recorder.resetForRetry();
            setPendingFinalizedAnswer(null);
            updatePhase("recording-recovery");
          } else {
            setPendingFinalizedAnswer(answer);
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
          if (
            !(error instanceof AnswerRecordingError) ||
            (error.stage !== "interruption" && error.stage !== "permission")
          ) {
            const activeQuestion = session.questions[currentIndexRef.current];
            if (activeQuestion) {
              reportOperationalError({
                code: "ANSWER_RECORDING_FAILED",
                surface: "live",
                stage:
                  error instanceof AnswerRecordingError &&
                  error.stage !== "permission" &&
                  error.stage !== "interruption"
                    ? error.stage
                    : "stop",
                questionNumber: activeQuestion.questionNumber,
                retryCount: 0,
                attempt: recordingAttemptRef.current,
              });
            }
          }
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
    [recorder, registerFinalizedAnswer, session.questions, updatePhase],
  );

  const startResponseRecording = useCallback(() => {
    if (phaseRef.current !== "response-cue") return Promise.resolve();
    const activeQuestion = session.questions[currentIndexRef.current];
    if (!activeQuestion) return Promise.resolve();

    recorder.resetForRetry();
    recordingAttemptRef.current += 1;
    const recordingAttempt = recordingAttemptRef.current;
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
        else {
          if (result.reason === "error") {
            reportOperationalError({
              code: "ANSWER_RECORDING_FAILED",
              surface: "live",
              stage:
                result.error?.stage === "stop" ||
                result.error?.stage === "file-validation"
                  ? result.error.stage
                  : "prepare",
              ...(result.error?.operation ? { operation: result.error.operation } : {}),
              ...(typeof result.error?.permissionGranted === "boolean"
                ? { permissionGranted: result.error.permissionGranted }
                : {}),
              questionNumber: activeQuestion.questionNumber,
              retryCount: 0,
              attempt: recordingAttempt,
            });
          }
          updatePhase("recording-recovery");
        }
      })
      .catch((error: unknown) => {
        console.error("[ExamSession] 답변 녹음 시작 실패", error);
        reportOperationalError({
          code: "ANSWER_RECORDING_FAILED",
          surface: "live",
          stage:
            error instanceof AnswerRecordingError &&
            (error.stage === "stop" || error.stage === "file-validation")
              ? error.stage
              : "prepare",
          ...(error instanceof AnswerRecordingError && error.operation
            ? { operation: error.operation }
            : {}),
          ...(error instanceof AnswerRecordingError &&
          typeof error.permissionGranted === "boolean"
            ? { permissionGranted: error.permissionGranted }
            : {}),
          questionNumber: activeQuestion.questionNumber,
          retryCount: 0,
          attempt: recordingAttempt,
        });
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

  const beginResponse = useCallback(() => {
    const allowedPhases: ExamSessionPhase[] = [
      "preparation",
      "interrupted",
      "recording-recovery",
    ];
    if (!allowedPhases.includes(phaseRef.current) || transitionPromiseRef.current) {
      return transitionPromiseRef.current ?? Promise.resolve();
    }
    updatePhase("response-cue");
    return Promise.resolve();
  }, [updatePhase]);
  beginResponseRef.current = () => {
    void beginResponse();
  };

  const completeDirections = useCallback(() => {
    if (phaseRef.current !== "directions" || !question) return;

    if (!completedPartPreludesRef.current.has(question.partNumber)) {
      if ((question.partNumber === 3 || question.partNumber === 4) && !partPrelude) {
        if (!reportedPreludesRef.current.has(question.partNumber)) {
          reportedPreludesRef.current.add(question.partNumber);
          reportOperationalError({
            code: "EXAM_PRELUDE_FAILED",
            partNumber: question.partNumber,
            reason: "missing-prelude",
          });
        }
        updatePhase("part-prelude-error");
        return;
      }
      if (partPrelude?.kind === "invalid") {
        if (!reportedPreludesRef.current.has(partPrelude.partNumber)) {
          reportedPreludesRef.current.add(partPrelude.partNumber);
          reportOperationalError({
            code: "EXAM_PRELUDE_FAILED",
            partNumber: partPrelude.partNumber,
            reason: partPrelude.reason,
          });
        }
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
        isReadingTableReadyRef.current = false;
        setIsReadingTableReady(false);
        updatePhase("part4-reading");
        return;
      }
    }

    enterQuestionStart(question);
  }, [enterQuestionStart, partPrelude, question, updatePhase]);

  const completePart3Intro = useCallback(() => {
    if (phaseRef.current !== "part3-intro" || !question) return;
    completedPartPreludesRef.current.add(question.partNumber);
    enterQuestionStart(question);
  }, [enterQuestionStart, question]);

  const completePart4Reading = useCallback(() => {
    if (
      phaseRef.current !== "part4-reading" ||
      !isReadingTableReadyRef.current ||
      !question
    ) {
      return;
    }
    completedPartPreludesRef.current.add(question.partNumber);
    readingRemainingMsRef.current = 0;
    setReadingRemainingMs(0);
    enterQuestionStart(question);
  }, [enterQuestionStart, question]);

  const completeQuestionCue = useCallback(() => {
    if (phaseRef.current !== "question-cue" || !question) return;
    enterPreparationCue(question);
  }, [enterPreparationCue, question]);

  const completePreparationCue = useCallback(() => {
    if (phaseRef.current !== "preparation-cue" || !question) return;
    const durationMs = question.prepTimeSec * 1_000;
    preparationRemainingMsRef.current = durationMs;
    setPreparationRemainingMs(durationMs);
    updatePhase("preparation");
  }, [question, updatePhase]);

  const completeResponseCue = useCallback(() => {
    void startResponseRecording();
  }, [startResponseRecording]);

  const markPart4TableReady = useCallback(() => {
    if (phaseRef.current !== "part4-reading") return;
    isReadingTableReadyRef.current = true;
    setIsReadingTableReady(true);
  }, []);

  const retryRegistration = useCallback(() => {
    if (!pendingFinalizedAnswer) return;
    registerFinalizedAnswer(pendingFinalizedAnswer);
  }, [pendingFinalizedAnswer, registerFinalizedAnswer]);

  const retryRecording = useCallback(() => {
    void beginResponse();
  }, [beginResponse]);

  useEffect(() => {
    if (phase !== "preparation" || !question || !isExamActive) return;

    const deadline = Date.now() + preparationRemainingMsRef.current;
    const tick = () => {
      if (phaseRef.current !== "preparation" || !isExamActiveRef.current) return;
      const remaining = Math.max(0, deadline - Date.now());
      preparationRemainingMsRef.current = remaining;
      setPreparationRemainingMs(remaining);
      if (remaining === 0) beginResponseRef.current();
    };
    const intervalId = setInterval(tick, TIMER_UPDATE_INTERVAL_MS);
    tick();
    return () => {
      clearInterval(intervalId);
      if (phaseRef.current === "preparation") {
        preparationRemainingMsRef.current = Math.max(0, deadline - Date.now());
      }
    };
  }, [currentIndex, isExamActive, phase, question]);

  useEffect(() => {
    if (phase !== "part4-reading" || !isReadingTableReady || !isExamActive) return;

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
  }, [completePart4Reading, isExamActive, isReadingTableReady, phase]);

  useEffect(() => {
    // generation이 정리되면 remainingMs가 0으로 떨어지므로 녹음 중일 때만 만료로 본다.
    if (phase === "response" && recorder.status === "recording" && recorder.remainingMs <= 0) {
      void finishResponse("native-timeout");
    }
  }, [finishResponse, phase, recorder.remainingMs, recorder.status]);

  useEffect(() => {
    if (
      (phase === "response" || phase === "starting-response") &&
      recorder.status === "interrupted"
    ) {
      updatePhase("interrupted");
    }
  }, [phase, recorder.status, updatePhase]);

  /**
   * 시험 시작과 이탈을 남긴다. 이탈은 어느 화면이 아니라 어느 `phase`에서 끊겼는지가
   * 중요하다. 안내를 듣다 나간 것과 답변하다 나간 것은 대응이 전혀 다르기 때문이다.
   */
  useEffect(() => {
    trackEvent({ name: "exam_started" });

    return () => {
      if (hasTrackedCompletionRef.current) return;

      const abandonedQuestion = questionsRef.current[currentIndexRef.current];
      trackEvent({
        name: "exam_abandoned",
        properties: {
          partNumber: abandonedQuestion?.partNumber ?? 0,
          questionNumber: abandonedQuestion?.questionNumber ?? 0,
          phase: phaseRef.current,
        },
      });
    };
  }, []);

  useEffect(() => {
    if (phase === "submission-barrier" && submissions.summary.isComplete) {
      hasTrackedCompletionRef.current = true;
      trackEvent({ name: "exam_completed" });
      updatePhase("completed");
    }
  }, [phase, submissions.summary.isComplete, updatePhase]);

  const remainingSeconds = useMemo(() => {
    if (phase === "part4-reading") return readingRemainingMs / 1_000;
    if (phase === "response-cue" || phase === "starting-response") {
      return question?.speakTimeSec ?? 0;
    }
    if (phase === "response" || phase === "finalizing") {
      return recorder.remainingMs / 1_000;
    }
    return preparationRemainingMs / 1_000;
  }, [phase, preparationRemainingMs, question, readingRemainingMs, recorder.remainingMs]);

  return {
    currentIndex,
    question,
    partPrelude,
    isReadingTableReady,
    questionAudioUrl,
    phase,
    remainingSeconds,
    recorder,
    submissions,
    completeDirections,
    completePart3Intro,
    completePart4Reading,
    completeQuestionCue,
    completePreparationCue,
    completeResponseCue,
    markPart4TableReady,
    beginResponse,
    finishResponse,
    retryRecording,
    retryRegistration,
  };
}
