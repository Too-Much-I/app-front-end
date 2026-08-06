import { useCallback, useEffect, useRef, useState } from "react";

import { notifyAnswerUploadComplete } from "@/features/exam/api/exam-answer-submit";
import { getAnswerUploadUrl } from "@/features/exam/api/exam-answer-upload-url";
import { getExamQuestionStatus } from "@/features/exam/api/exam-question-status";
import { AnswerAudioUploadError, uploadAnswerAudio } from "@/features/exam/upload-answer-audio";
import type { AnswerKey } from "@/types/exam";

export type ReanswerSubmissionStatus = "idle" | "submitting" | "grading" | "failed";

/** 실패가 제출에서 났는지 채점 확인에서 났는지 — 화면이 내줄 복구 행동이 다르다. */
export type ReanswerFailureStage = "submit" | "grading";

/** 웹의 재답변 폴링과 같은 주기. 이전 요청이 끝난 뒤에 다음 요청을 예약한다. */
const POLL_INTERVAL_MS = 3_000;

/** 채점을 기다리는 상한. 넘기면 무한 대기 대신 안내를 띄우고 피드백으로 돌려보낸다. */
const GRADING_TIMEOUT_MS = 60_000;

/**
 * 11번 문제만 상한이 2분이다. Part 5(의견 제시)는 답변이 60초로 가장 길어서 채점도
 * 그만큼 오래 걸린다 — 같은 1분을 적용하면 정상 채점을 실패로 끊어 버린다.
 */
const LONG_ANSWER_QUESTION_NUMBER = 11;
const LONG_ANSWER_GRADING_TIMEOUT_MS = 120_000;

function getGradingTimeoutMs(questionNumber: number): number {
  return questionNumber === LONG_ANSWER_QUESTION_NUMBER
    ? LONG_ANSWER_GRADING_TIMEOUT_MS
    : GRADING_TIMEOUT_MS;
}

const SUBMIT_FAILURE_MESSAGE = "제출 중 문제가 생겼어요. 다시 시도해 주세요.";
const SUBMIT_PROCESSING_FAILURE_MESSAGE =
  "서버가 답변을 처리하지 못했어요. 피드백 화면에서 다시 시작해 주세요.";
const GRADING_FAILURE_MESSAGE = "채점 결과를 확인하지 못했어요.";
const GRADING_TIMEOUT_MESSAGE = "채점이 예상보다 오래 걸리고 있어요.";

interface UseReanswerSubmissionInput {
  key: AnswerKey;
  /** 새 회차 채점이 끝났을 때. 화면은 이 시점에 문제별 피드백으로 돌아간다. */
  onGraded: () => void;
}

/**
 * 재답변 한 건의 업로드 → 접수 → 채점 확인.
 *
 * 응시 흐름의 `use-answer-submissions`는 여러 문제의 제출을 큐로 관리하지만, 재답변은
 * 언제나 한 문제의 한 회차뿐이라 큐 없이 직렬로 처리한다. 대신 화면을 벗어나면 폴링이
 * 남지 않도록 언마운트에서 반드시 정리한다.
 *
 * 재시도는 두지 않는다. 실패하면 화면이 안내를 띄우고 사용자를 문제별 피드백으로
 * 돌려보낸다 — 재답변은 언제든 다시 시작할 수 있으므로, 같은 녹음본을 붙들고 재시도
 * 상태를 관리하는 것보다 흐름을 끊고 원래 자리로 보내는 편이 단순하고 안전하다.
 */
export function useReanswerSubmission({ key, onGraded }: UseReanswerSubmissionInput) {
  const [status, setStatus] = useState<ReanswerSubmissionStatus>("idle");
  const [failureStage, setFailureStage] = useState<ReanswerFailureStage | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onGradedRef = useRef(onGraded);
  const keyRef = useRef(key);

  useEffect(() => {
    onGradedRef.current = onGraded;
    keyRef.current = key;
  });

  const clearPollTimer = useCallback(() => {
    if (pollTimeoutRef.current === null) return;
    clearTimeout(pollTimeoutRef.current);
    pollTimeoutRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      clearPollTimer();
    };
  }, [clearPollTimer]);

  const fail = useCallback((stage: ReanswerFailureStage, message: string) => {
    if (!mountedRef.current) return;
    setStatus("failed");
    setFailureStage(stage);
    setErrorMessage(message);
  }, []);

  const startPolling = useCallback(
    (signal: AbortSignal) => {
      const deadline = Date.now() + getGradingTimeoutMs(keyRef.current.questionNumber);

      const check = async () => {
        if (signal.aborted || !mountedRef.current) return;

        try {
          const result = await getExamQuestionStatus(keyRef.current, signal);
          if (signal.aborted || !mountedRef.current) return;

          if (result.status === "COMPLETED") {
            onGradedRef.current();
            return;
          }
          if (result.status === "FAILED") {
            fail("grading", GRADING_FAILURE_MESSAGE);
            return;
          }
        } catch (error) {
          if (signal.aborted || !mountedRef.current) return;
          // 일시적인 네트워크 오류로 보고 상한까지는 조용히 다시 물어본다 —
          // 제출은 이미 성공했으므로 잠깐 끊겼다고 실패로 만들 이유가 없다.
          console.error("[Reanswer] 회차 채점 상태 조회 실패", error);
        }

        if (Date.now() >= deadline) {
          fail("grading", GRADING_TIMEOUT_MESSAGE);
          return;
        }

        pollTimeoutRef.current = setTimeout(() => void check(), POLL_INTERVAL_MS);
      };

      void check();
    },
    [fail],
  );

  const run = useCallback(
    async (audioFileUri: string) => {
      abortRef.current?.abort();
      clearPollTimer();

      const controller = new AbortController();
      abortRef.current = controller;

      setStatus("submitting");
      setFailureStage(null);
      setErrorMessage(null);

      try {
        const uploadTarget = await getAnswerUploadUrl(keyRef.current, controller.signal);
        await uploadAnswerAudio(
          uploadTarget.uploadUrl,
          audioFileUri,
          Date.now() + uploadTarget.expiresIn * 1_000,
          controller.signal,
        );
        let submitResult = await notifyAnswerUploadComplete(keyRef.current, controller.signal);
        if (submitResult.status === "FAILED") {
          submitResult = await notifyAnswerUploadComplete(keyRef.current, controller.signal);
        }
        if (submitResult.status === "FAILED") {
          fail("submit", SUBMIT_PROCESSING_FAILURE_MESSAGE);
          return;
        }
      } catch (error) {
        if (controller.signal.aborted || !mountedRef.current) return;
        console.error("[Reanswer] 답변 제출 실패", error);
        fail(
          "submit",
          error instanceof AnswerAudioUploadError ? error.message : SUBMIT_FAILURE_MESSAGE,
        );
        return;
      }

      if (controller.signal.aborted || !mountedRef.current) return;
      setStatus("grading");
      startPolling(controller.signal);
    },
    [clearPollTimer, fail, startPolling],
  );

  const submit = useCallback((audioFileUri: string) => void run(audioFileUri), [run]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    clearPollTimer();
    setStatus("idle");
    setFailureStage(null);
    setErrorMessage(null);
  }, [clearPollTimer]);

  return { status, failureStage, errorMessage, submit, reset };
}
