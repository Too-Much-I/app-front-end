import * as Crypto from "expo-crypto";
import { useCallback, useEffect, useRef, useState } from "react";

import { submitChallengeAnswer } from "@/features/challenge/api/challenge-answer";
import { createChallengeAttempt } from "@/features/challenge/api/challenge-attempt";
import {
  getChallengeErrorCode,
  isAttemptAlreadyTerminal,
  isProgressRefreshRequired,
} from "@/features/challenge/challenge-error-codes";
import {
  ANSWER_AUDIO_CONTENT_TYPE,
  AnswerAudioUploadError,
  getValidAnswerAudioFile,
  uploadAnswerAudio,
} from "@/features/exam/upload-answer-audio";
import type { ChallengeAnswerAccepted, ChallengeAttempt } from "@/types/challenge";

export type ChallengeSubmissionStatus = "idle" | "submitting" | "failed";

const SUBMIT_FAILURE_MESSAGE = "제출 중 문제가 생겼어요. 다시 시도해 주세요.";
const AUDIO_TOO_LARGE_MESSAGE = "녹음 파일이 너무 커서 올릴 수 없어요. 다시 녹음해 주세요.";
const DEADLINE_PASSED_MESSAGE = "제출 가능한 시간이 지났어요.";

interface UseChallengeSubmissionInput {
  challengeDate: string;
  questionNumber: number;
  /**
   * 서버가 답변을 접수했다. 화면은 녹음 파일을 정리하고 결과 화면으로 넘어간다.
   *
   * 접수 응답에는 참고 답안이 들어 있어 결과 화면이 첫 조회를 기다리지 않아도 된다.
   * 다만 이미 끝난 응시로 판명돼 넘어가는 경로에는 응답이 없으므로 `null`이 온다.
   */
  onSubmitted: (accepted: ChallengeAnswerAccepted | null) => void;
  /** 날짜가 바뀌었거나 순서가 어긋났다. 오늘 진행도부터 다시 읽어야 한다. */
  onProgressStale: () => void;
}

/**
 * 챌린지 답변 한 건의 attempt 발급 → S3 PUT → 접수 통지.
 *
 * 채점 대기는 여기 없다. 통지가 성공하면 로컬 파일로 할 수 있는 일이 끝나고, 그 뒤의
 * 실패(AI 지연·실패)는 녹음본을 다시 올려서 고칠 수 있는 문제가 아니다. 그래서 대기와
 * 재확인은 날짜·문제 번호만으로 서버에 다시 물을 수 있는 결과 화면이 가져간다.
 *
 * 재시도할 때 새 응시를 소비하지 않게 하는 장치가 둘이다. attempt는 서버가 제출 전
 * attempt를 복구해 주므로 몇 번을 불러도 같은 `attemptId`고, 접수 통지는 같은
 * `Idempotency-Key`를 성공할 때까지 붙들고 있다가 그대로 다시 보낸다.
 */
export function useChallengeSubmission({
  challengeDate,
  questionNumber,
  onSubmitted,
  onProgressStale,
}: UseChallengeSubmissionInput) {
  const [status, setStatus] = useState<ChallengeSubmissionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef({ challengeDate, questionNumber, onSubmitted, onProgressStale });
  /** 이 녹음 한 건의 멱등 키. 접수에 성공하거나 다시 녹음할 때만 새로 만든다. */
  const idempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    inputRef.current = { challengeDate, questionNumber, onSubmitted, onProgressStale };
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const fail = useCallback((message: string) => {
    if (!mountedRef.current) return;
    setStatus("failed");
    setErrorMessage(message);
  }, []);

  const run = useCallback(
    async (audioFileUri: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const { challengeDate: date, questionNumber: target } = inputRef.current;

      setStatus("submitting");
      setErrorMessage(null);
      idempotencyKeyRef.current ??= Crypto.randomUUID();
      let accepted: ChallengeAnswerAccepted | null = null;

      try {
        let attempt = await createChallengeAttempt(date, target, controller.signal);
        assertUploadableSize(audioFileUri, attempt);

        try {
          await putRecording(audioFileUri, attempt, controller.signal);
        } catch (error) {
          if (controller.signal.aborted || !isExpiredUploadUrl(error)) throw error;
          // 만료된 건 URL뿐이다. attempt를 다시 부르면 같은 응시에 새 URL이 붙어 온다.
          attempt = await createChallengeAttempt(date, target, controller.signal);
          await putRecording(audioFileUri, attempt, controller.signal);
        }

        accepted = await submitChallengeAnswer(
          target,
          attempt.attemptId,
          idempotencyKeyRef.current,
          controller.signal,
        );
      } catch (error) {
        if (controller.signal.aborted || !mountedRef.current) return;
        console.error("[Challenge] 답변 제출 실패", error);

        const code = getChallengeErrorCode(error);
        if (isAttemptAlreadyTerminal(code)) {
          // 서버는 이미 이 문제를 끝난 것으로 본다. 다시 녹음시키지 않고 결과로 보낸다.
          idempotencyKeyRef.current = null;
          inputRef.current.onSubmitted(null);
          return;
        }
        if (isProgressRefreshRequired(code)) {
          idempotencyKeyRef.current = null;
          inputRef.current.onProgressStale();
          return;
        }

        fail(resolveFailureMessage(error));
        return;
      }

      if (controller.signal.aborted || !mountedRef.current) return;
      idempotencyKeyRef.current = null;
      setStatus("idle");
      inputRef.current.onSubmitted(accepted);
    },
    [fail],
  );

  const submit = useCallback((audioFileUri: string) => void run(audioFileUri), [run]);

  /** 다시 녹음할 때. 다른 녹음본은 다른 제출이므로 멱등 키도 버린다. */
  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    idempotencyKeyRef.current = null;
    setStatus("idle");
    setErrorMessage(null);
  }, []);

  return { status, errorMessage, submit, reset };
}

function assertUploadableSize(audioFileUri: string, attempt: ChallengeAttempt): void {
  const file = getValidAnswerAudioFile(audioFileUri);
  if (attempt.upload.maxBytes > 0 && file.size > attempt.upload.maxBytes) {
    throw new AnswerAudioUploadError(AUDIO_TOO_LARGE_MESSAGE, false, 413);
  }
}

function putRecording(
  audioFileUri: string,
  attempt: ChallengeAttempt,
  signal: AbortSignal,
): Promise<void> {
  if (attempt.upload.contentType !== ANSWER_AUDIO_CONTENT_TYPE) {
    // 녹음 형식과 presigned URL이 서명한 형식이 다르면 S3가 415로 거절한다.
    // 최종 audio 계약(명세 9절)이 동결되기 전까지는 눈에 띄게 남겨둔다.
    console.warn(
      `[Challenge] 서버가 요구한 Content-Type(${attempt.upload.contentType})이 녹음 형식(${ANSWER_AUDIO_CONTENT_TYPE})과 다릅니다.`,
    );
  }

  // 업로드 예산은 URL 만료와 제출 유효시간 중 먼저 오는 쪽까지다.
  const deadlineMs = Math.min(attempt.upload.expiresAtMs, attempt.submissionDeadlineAtMs);
  if (deadlineMs <= Date.now()) {
    throw new AnswerAudioUploadError(DEADLINE_PASSED_MESSAGE, false, 403);
  }

  return uploadAnswerAudio(
    attempt.upload.url,
    audioFileUri,
    deadlineMs,
    signal,
    attempt.upload.contentType,
  );
}

/** presigned URL이 만료돼 실패했는가 — attempt를 다시 부르면 회복되는 유일한 경우. */
function isExpiredUploadUrl(error: unknown): boolean {
  return (
    error instanceof AnswerAudioUploadError && !error.retryable && error.status === 403
  );
}

function resolveFailureMessage(error: unknown): string {
  if (error instanceof AnswerAudioUploadError) return error.message;
  return SUBMIT_FAILURE_MESSAGE;
}
