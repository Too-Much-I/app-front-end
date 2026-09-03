import { useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useCallback, useEffect, useRef, useState } from "react";

import { submitChallengeAnswer } from "@/features/challenge/api/challenge-answer";
import { CHALLENGE_TODAY_QUERY_KEY } from "@/features/challenge/challenge-today-queries";
import { issueChallengeUploadUrl } from "@/features/challenge/api/challenge-upload-url";
import {
  createDevMockAccepted,
  DEV_SUBMIT_DELAY_MS,
} from "@/features/challenge/dev-mock-challenge";
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
import type {
  ChallengeAnswerAccepted,
  ChallengeAttempt,
  ChallengeUploadUrl,
} from "@/types/challenge";

export type ChallengeSubmissionStatus = "idle" | "submitting" | "failed";

const SUBMIT_FAILURE_MESSAGE = "제출 중 문제가 생겼어요. 다시 시도해 주세요.";
const AUDIO_TOO_LARGE_MESSAGE = "녹음 파일이 너무 커서 올릴 수 없어요. 다시 녹음해 주세요.";
const DEADLINE_PASSED_MESSAGE = "제출 가능한 시간이 지났어요.";

interface UseChallengeSubmissionInput {
  /**
   * 녹음 시작 전에 발급받아 둔 attempt. 아직 없으면 제출을 시작할 수 없다.
   *
   * 여기에 날짜와 문제 번호가 이미 들어 있어 제출 경로는 날짜를 따로 받지 않는다.
   * 자정이 지나도 이 attempt가 정한 날짜로 처리되는 것이 이 설계의 요점이다.
   */
  attempt: ChallengeAttempt | null;
  /**
   * 서버가 답변을 접수했다. 화면은 녹음 파일을 정리하고 결과 화면으로 넘어간다.
   *
   * 접수 응답에는 참고 답안이 들어 있어 결과 화면이 첫 조회를 기다리지 않아도 된다.
   * 다만 이미 끝난 응시로 판명돼 넘어가는 경로에는 응답이 없으므로 `null`이 온다.
   */
  onSubmitted: (accepted: ChallengeAnswerAccepted | null) => void;
  /** 순서가 어긋났거나 attempt를 찾을 수 없다. 오늘 진행도부터 다시 읽어야 한다. */
  onProgressStale: () => void;
}

/**
 * 녹음 한 건의 업로드 URL 발급 → S3 PUT → 접수 통지.
 *
 * attempt는 여기서 만들지 않는다. 녹음을 시작하기 전에 이미 발급돼 있어야 하고, 이 훅은
 * 그 `attemptId`를 받아 쓰기만 한다. 그래서 이 경로 전체가 날짜를 보내지 않으며 사용자가
 * 녹음을 들어보다 자정을 넘겨도 제출이 막히지 않는다.
 *
 * 채점 대기는 여기 없다. 통지가 성공하면 로컬 파일로 할 수 있는 일이 끝나고, 그 뒤의
 * 실패(AI 지연·실패)는 녹음본을 다시 올려서 고칠 수 있는 문제가 아니다. 그래서 대기와
 * 재확인은 날짜·문제 번호만으로 서버에 다시 물을 수 있는 결과 화면이 가져간다.
 *
 * 재시도할 때 새 응시를 소비하지 않게 하는 장치가 둘이다. URL 재발급은 attempt에 고정된
 * 같은 S3 key로만 이뤄지고, 접수 통지는 같은 `Idempotency-Key`를 성공할 때까지 붙들고
 * 있다가 그대로 다시 보낸다.
 */
export function useChallengeSubmission({
  attempt,
  onSubmitted,
  onProgressStale,
}: UseChallengeSubmissionInput) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ChallengeSubmissionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef({ attempt, onSubmitted, onProgressStale });
  /** 이 녹음 한 건의 멱등 키. 접수에 성공하거나 다시 녹음할 때만 새로 만든다. */
  const idempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    inputRef.current = { attempt, onSubmitted, onProgressStale };
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

  /**
   * 진행도가 바뀌었다고 스테이지에 알린다.
   *
   * 만료를 기다리지 않는다 — `staleTime`이 다음 자정까지라, 방금 푼 문장이 스테이지에
   * 반영되려면 캐시를 낡은 것으로 표시해야 한다. `invalidateQueries`는 `staleTime`을
   * 무시하므로 스테이지가 포커스를 되찾는 순간 다시 읽는다.
   *
   * 여기서 다시 조회하지는 않는다. 지금 화면은 결과로 넘어가는 중이고, 보이지 않는
   * 화면을 위해 요청을 미리 보낼 이유가 없다. 그래서 `refetchType: "none"`이 필요하다 —
   * 기본값 `"active"`는 표시에 그치지 않고 곧바로 요청을 낸다. 스테이지는 스택 아래에
   * 마운트된 채라 observer가 살아 있어서, 보이지 않는 화면의 요청이 실제로 나간다.
   */
  const markProgressStale = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: CHALLENGE_TODAY_QUERY_KEY,
      refetchType: "none",
    });
  }, [queryClient]);

  const run = useCallback(
    async (audioFileUri: string) => {
      const { attempt: target } = inputRef.current;
      // 화면이 attempt 없이는 제출 버튼을 띄우지 않는다. 여기 오면 순서가 어긋난 것이다.
      if (!target) {
        fail(SUBMIT_FAILURE_MESSAGE);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus("submitting");
      setErrorMessage(null);

      /*
       * 임시: 백엔드가 붙기 전까지 실제로 올리지 않고 접수된 것처럼 넘어간다.
       * URL 발급과 S3 PUT이 모두 실패하는 동안에는 결과 화면에 닿을 수 없다.
       * 서버가 준비되면 이 분기와 `dev-mock-challenge`를 함께 지운다.
       */
      if (__DEV__) {
        await new Promise((resolve) => setTimeout(resolve, DEV_SUBMIT_DELAY_MS));
        if (controller.signal.aborted || !mountedRef.current) return;
        setStatus("idle");
        markProgressStale();
        inputRef.current.onSubmitted(
          createDevMockAccepted(target.date, target.questionNumber),
        );
        return;
      }

      idempotencyKeyRef.current ??= Crypto.randomUUID();
      let accepted: ChallengeAnswerAccepted | null = null;

      try {
        let upload = await issueChallengeUploadUrl(target.attemptId, controller.signal);
        assertUploadableSize(audioFileUri, upload);

        try {
          await putRecording(audioFileUri, upload, controller.signal);
        } catch (error) {
          if (controller.signal.aborted || !isExpiredUploadUrl(error)) throw error;
          // 만료된 건 URL뿐이다. 다시 발급받아도 같은 attempt의 같은 S3 key를 가리킨다.
          upload = await issueChallengeUploadUrl(target.attemptId, controller.signal);
          await putRecording(audioFileUri, upload, controller.signal);
        }

        accepted = await submitChallengeAnswer(
          target.questionNumber,
          target.attemptId,
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
          markProgressStale();
          inputRef.current.onSubmitted(null);
          return;
        }
        if (isProgressRefreshRequired(code)) {
          idempotencyKeyRef.current = null;
          markProgressStale();
          inputRef.current.onProgressStale();
          return;
        }

        fail(resolveFailureMessage(error));
        return;
      }

      if (controller.signal.aborted || !mountedRef.current) return;
      idempotencyKeyRef.current = null;
      setStatus("idle");
      markProgressStale();
      inputRef.current.onSubmitted(accepted);
    },
    [fail, markProgressStale],
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

function assertUploadableSize(audioFileUri: string, upload: ChallengeUploadUrl): void {
  const file = getValidAnswerAudioFile(audioFileUri);
  if (upload.maxBytes > 0 && file.size > upload.maxBytes) {
    throw new AnswerAudioUploadError(AUDIO_TOO_LARGE_MESSAGE, false, 413);
  }
}

function putRecording(
  audioFileUri: string,
  upload: ChallengeUploadUrl,
  signal: AbortSignal,
): Promise<void> {
  if (upload.contentType !== ANSWER_AUDIO_CONTENT_TYPE) {
    // 녹음 형식과 presigned URL이 서명한 형식이 다르면 S3가 415로 거절한다.
    // 명세는 `audio/mp4` 고정이므로 어긋나면 계약이 바뀐 것이다.
    console.warn(
      `[Challenge] 서버가 요구한 Content-Type(${upload.contentType})이 녹음 형식(${ANSWER_AUDIO_CONTENT_TYPE})과 다릅니다.`,
    );
  }

  // 업로드 예산은 URL 만료와 제출 유효시간 중 먼저 오는 쪽까지다. 명세상 URL 만료가
  // 항상 더 이르지만, 둘 다 서버가 주는 값이라 앱은 어느 쪽이든 먼저 오는 것을 따른다.
  const deadlineMs = Math.min(upload.expiresAtMs, upload.submissionDeadlineAtMs);
  if (deadlineMs <= Date.now()) {
    throw new AnswerAudioUploadError(DEADLINE_PASSED_MESSAGE, false, 403);
  }

  return uploadAnswerAudio(
    upload.url,
    audioFileUri,
    deadlineMs,
    signal,
    upload.contentType,
  );
}

/** presigned URL이 만료돼 실패했는가 — 다시 발급받으면 회복되는 유일한 경우. */
function isExpiredUploadUrl(error: unknown): boolean {
  return (
    error instanceof AnswerAudioUploadError && !error.retryable && error.status === 403
  );
}

function resolveFailureMessage(error: unknown): string {
  if (error instanceof AnswerAudioUploadError) return error.message;
  return SUBMIT_FAILURE_MESSAGE;
}
