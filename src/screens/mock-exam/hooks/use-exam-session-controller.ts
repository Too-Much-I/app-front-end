import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";

import { AudioRecordingError } from "@/features/audio/use-timed-audio-recorder";
import { useAnswerRecorder } from "@/features/exam/use-answer-recorder";
import { useAnswerSubmissions } from "@/features/exam/use-answer-submissions";
import { trackEvent } from "@/lib/amplitude";
import { reportOperationalError } from "@/lib/operational-error-reporting";
import { getPlayableQuestionAudioUrl } from "@/features/exam/question-audio";
import {
  createExamSessionStore,
  getPartPrelude,
} from "@/screens/mock-exam/hooks/exam-session-store";
import type { ExamSession, FinalizedAnswer } from "@/types/exam";

export type { ExamSessionPhase } from "@/screens/mock-exam/hooks/exam-session-store";

const TIMER_UPDATE_INTERVAL_MS = 100;

export function useExamSessionController(session: ExamSession, isExamActive: boolean) {
  // 화면과 수명을 같이한다. 다시 들어오면 새 스토어라 초기화가 저절로 된다.
  const [store] = useState(() => createExamSessionStore(session));

  // 액션은 스토어가 만들어질 때 한 번 정의되고 이후 신원이 바뀌지 않는다.
  const {
    completeDirections,
    completePart3Intro,
    completePart4Reading,
    completeQuestionCue,
    completePreparationCue,
    markPart4TableReady,
    beginResponse,
    retryRecording,
    tickPreparation,
    tickReading,
    suspendPreparation,
    suspendReading,
    beginRecordingAttempt,
    recordingStarted,
    recordingInterrupted,
    recordingFailed,
    beginFinalizing,
    answerRegistered,
    answerRegistrationFailed,
    answerFileInvalid,
    examCompleted,
  } = store.getState();

  // 셀렉터를 쓰므로 이 값이 바뀔 때만 리렌더된다.
  const phase = useStore(store, (state) => state.phase);
  const currentIndex = useStore(store, (state) => state.currentIndex);
  const isReadingTableReady = useStore(store, (state) => state.isReadingTableReady);
  const preparationRemainingMs = useStore(store, (state) => state.preparationRemainingMs);
  const readingRemainingMs = useStore(store, (state) => state.readingRemainingMs);

  const isExamActiveRef = useRef(isExamActive);
  const recordingAttemptRef = useRef(0);
  const hasTrackedCompletionRef = useRef(false);
  const transitionPromiseRef = useRef<Promise<void> | null>(null);
  // 언마운트 cleanup은 첫 렌더의 props를 붙잡으므로 최신 문항 배열을 ref로 읽는다.
  const questionsRef = useRef(session.questions);
  questionsRef.current = session.questions;

  const recorder = useAnswerRecorder();
  const submissions = useAnswerSubmissions(session.questions.length);
  const question = session.questions[currentIndex];
  const partPrelude = getPartPrelude(session.partPreludes, question?.partNumber);
  // 화면과 컨트롤러가 같은 값을 보게 한다. 이 값이 없으면 question-cue로 진입하지 않는다.
  const questionAudioUrl = question ? getPlayableQuestionAudioUrl(question) : undefined;

  useEffect(() => {
    isExamActiveRef.current = isExamActive;
  }, [isExamActive]);

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
            answerFileInvalid();
          } else {
            answerRegistrationFailed(answer);
          }
          return false;
        }

        recorder.transferOwnership(answer.audioFileUri);
        answerRegistered();
        return true;
      } catch (error) {
        console.error("[ExamSession] 답변 registry 등록 실패", error);
        answerRegistrationFailed(answer);
        return false;
      }
    },
    [
      answerFileInvalid,
      answerRegistered,
      answerRegistrationFailed,
      recorder,
      submissions,
    ],
  );

  const finishResponse = useCallback(
    (reason: "user" | "native-timeout" | "fallback-timeout" = "user") => {
      const activePromise = transitionPromiseRef.current;
      if (activePromise) return activePromise;
      if (!beginFinalizing()) return Promise.resolve();

      const transitionPromise = recorder
        .finish(reason)
        .then((answer) => {
          registerFinalizedAnswer(answer);
        })
        .catch((error: unknown) => {
          console.error("[ExamSession] 답변 확정 실패", error);
          const isRecordingError = error instanceof AudioRecordingError;
          if (
            !isRecordingError ||
            (error.stage !== "interruption" && error.stage !== "permission")
          ) {
            const activeQuestion = session.questions[store.getState().currentIndex];
            if (activeQuestion) {
              reportOperationalError({
                code: "ANSWER_RECORDING_FAILED",
                surface: "live",
                stage:
                  isRecordingError &&
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
          if (isRecordingError && error.stage === "interruption") {
            recordingInterrupted();
          } else {
            recordingFailed();
          }
        })
        .finally(() => {
          if (transitionPromiseRef.current === transitionPromise) {
            transitionPromiseRef.current = null;
          }
        });
      transitionPromiseRef.current = transitionPromise;
      return transitionPromise;
    },
    [
      beginFinalizing,
      recorder,
      recordingFailed,
      recordingInterrupted,
      registerFinalizedAnswer,
      session.questions,
      store,
    ],
  );

  const startResponseRecording = useCallback(() => {
    const activeQuestion = session.questions[store.getState().currentIndex];
    if (!activeQuestion) return Promise.resolve();
    if (!beginRecordingAttempt()) return Promise.resolve();

    recorder.resetForRetry();
    recordingAttemptRef.current += 1;
    const recordingAttempt = recordingAttemptRef.current;

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
          recordingStarted();
          return;
        }
        if (result.reason === "interrupted") {
          recordingInterrupted();
          return;
        }
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
        recordingFailed();
      })
      .catch((error: unknown) => {
        console.error("[ExamSession] 답변 녹음 시작 실패", error);
        const isRecordingError = error instanceof AudioRecordingError;
        reportOperationalError({
          code: "ANSWER_RECORDING_FAILED",
          surface: "live",
          stage:
            isRecordingError &&
            (error.stage === "stop" || error.stage === "file-validation")
              ? error.stage
              : "prepare",
          ...(isRecordingError && error.operation ? { operation: error.operation } : {}),
          ...(isRecordingError && typeof error.permissionGranted === "boolean"
            ? { permissionGranted: error.permissionGranted }
            : {}),
          questionNumber: activeQuestion.questionNumber,
          retryCount: 0,
          attempt: recordingAttempt,
        });
        recordingFailed();
      })
      .finally(() => {
        if (transitionPromiseRef.current === transitionPromise) {
          transitionPromiseRef.current = null;
        }
      });
    transitionPromiseRef.current = transitionPromise;
    return transitionPromise;
  }, [
    beginRecordingAttempt,
    recorder,
    recordingFailed,
    recordingInterrupted,
    recordingStarted,
    session.examId,
    session.questions,
    store,
  ]);

  const completeResponseCue = useCallback(() => {
    void startResponseRecording();
  }, [startResponseRecording]);

  const retryRegistration = useCallback(() => {
    const pending = store.getState().pendingFinalizedAnswer;
    if (!pending) return;
    registerFinalizedAnswer(pending);
  }, [registerFinalizedAnswer, store]);

  useEffect(() => {
    if (phase !== "preparation" || !question || !isExamActive) return;

    const deadline = Date.now() + store.getState().preparationRemainingMs;
    const tick = () => {
      if (!isExamActiveRef.current) return;
      tickPreparation(Math.max(0, deadline - Date.now()));
    };
    const intervalId = setInterval(tick, TIMER_UPDATE_INTERVAL_MS);
    tick();
    return () => {
      clearInterval(intervalId);
      if (store.getState().phase === "preparation") {
        suspendPreparation(Math.max(0, deadline - Date.now()));
      }
    };
  }, [currentIndex, isExamActive, phase, question, store, suspendPreparation, tickPreparation]);

  useEffect(() => {
    if (phase !== "part4-reading" || !isReadingTableReady || !isExamActive) return;

    const deadline = Date.now() + store.getState().readingRemainingMs;
    const tick = () => {
      if (!isExamActiveRef.current) return;
      tickReading(Math.max(0, deadline - Date.now()));
    };
    const intervalId = setInterval(tick, TIMER_UPDATE_INTERVAL_MS);
    tick();

    return () => {
      clearInterval(intervalId);
      if (store.getState().phase === "part4-reading") {
        suspendReading(Math.max(0, deadline - Date.now()));
      }
    };
  }, [isExamActive, isReadingTableReady, phase, store, suspendReading, tickReading]);

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
      recordingInterrupted();
    }
  }, [phase, recorder.status, recordingInterrupted]);

  /**
   * 시험 시작과 이탈을 남긴다. 이탈은 어느 화면이 아니라 어느 `phase`에서 끊겼는지가
   * 중요하다. 안내를 듣다 나간 것과 답변하다 나간 것은 대응이 전혀 다르기 때문이다.
   */
  useEffect(() => {
    trackEvent({ name: "exam_started" });

    return () => {
      if (hasTrackedCompletionRef.current) return;

      const { currentIndex: abandonedIndex, phase: abandonedPhase } = store.getState();
      const abandonedQuestion = questionsRef.current[abandonedIndex];
      trackEvent({
        name: "exam_abandoned",
        properties: {
          partNumber: abandonedQuestion?.partNumber ?? 0,
          questionNumber: abandonedQuestion?.questionNumber ?? 0,
          phase: abandonedPhase,
        },
      });
    };
  }, [store]);

  useEffect(() => {
    if (phase === "submission-barrier" && submissions.summary.isComplete) {
      hasTrackedCompletionRef.current = true;
      trackEvent({ name: "exam_completed" });
      examCompleted();
    }
  }, [examCompleted, phase, submissions.summary.isComplete]);

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
