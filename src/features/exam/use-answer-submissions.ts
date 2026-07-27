import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { AppState } from "react-native";

import { submitAnswerForGrading } from "@/features/exam/api/exam-answer-submit";
import { getAnswerUploadUrl } from "@/features/exam/api/exam-answer-upload-url";
import { getExamQuestionStatus } from "@/features/exam/api/exam-question-status";
import {
  AnswerAudioUploadError,
  deleteAnswerAudioFile,
  getValidAnswerAudioFile,
  uploadAnswerAudio,
} from "@/features/exam/upload-answer-audio";
import { ApiError } from "@/lib/api/client";
import type {
  AnswerKey,
  AnswerSubmissionFailure,
  AnswerSubmissionJob,
  AnswerSubmissionStage,
  AnswerSubmissionSummary,
  FinalizedAnswer,
} from "@/types/exam";

type SubmissionRegistry = Record<string, AnswerSubmissionJob>;

type RegistryAction =
  | { type: "register"; id: string; job: AnswerSubmissionJob }
  | { type: "patch"; id: string; patch: Partial<AnswerSubmissionJob> };

interface RegisterAnswerResult {
  accepted: boolean;
  reason?: "disposed" | "invalid-file" | "uri-conflict";
}

const RETRY_DELAYS_MS = [1_000, 2_000, 4_000] as const;
const ACCEPTED_STATUSES = new Set(["PENDING", "PROCESSING", "COMPLETED"]);

function serializeAnswerKey(key: AnswerKey): string {
  return JSON.stringify([key.examId, key.questionNumber, key.retryCount]);
}

function registryReducer(state: SubmissionRegistry, action: RegistryAction): SubmissionRegistry {
  if (action.type === "register") {
    if (state[action.id]) return state;
    return { ...state, [action.id]: action.job };
  }

  const current = state[action.id];
  if (!current) return state;
  return { ...state, [action.id]: { ...current, ...action.patch } };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function isRetryableRequestError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }
  return !(error instanceof AnswerAudioUploadError) || error.retryable;
}

function failure(
  stage: AnswerSubmissionFailure["stage"],
  message: string,
  retryable: boolean,
): AnswerSubmissionFailure {
  return { stage, message, retryable };
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const timeoutId = setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolve();
    }, ms);
    const handleAbort = () => {
      clearTimeout(timeoutId);
      signal.removeEventListener("abort", handleAbort);
      reject(signal.reason);
    };
    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

function isPendingStage(stage: AnswerSubmissionStage): boolean {
  return !["succeeded", "failed", "cancelled"].includes(stage);
}

export function useAnswerSubmissions(expectedAnswerCount: number) {
  const [registry, dispatch] = useReducer(registryReducer, {});
  const registryRef = useRef<SubmissionRegistry>({});
  const mountedRef = useRef(true);
  const disposedRef = useRef(false);
  const appIsActiveRef = useRef(AppState.currentState === "active");
  const runnersRef = useRef(new Map<string, Promise<void>>());
  const runnerControllersRef = useRef(new Map<string, AbortController>());
  const startRunnerRef = useRef<(id: string) => void>(() => undefined);

  const applyAction = useCallback((action: RegistryAction) => {
    registryRef.current = registryReducer(registryRef.current, action);
    if (mountedRef.current) dispatch(action);
  }, []);

  const patchJob = useCallback(
    (id: string, patch: Partial<AnswerSubmissionJob>) => {
      applyAction({ type: "patch", id, patch });
    },
    [applyAction],
  );

  const markSucceeded = useCallback(
    (id: string, acceptedStatus: "PENDING" | "PROCESSING" | "COMPLETED") => {
      const job = registryRef.current[id];
      if (!job) return;
      try {
        deleteAnswerAudioFile(job.audioFileUri);
      } catch (error) {
        console.error("[AnswerSubmissions] 성공한 답변 파일 삭제 실패", error);
      }
      patchJob(id, {
        stage: "succeeded",
        acceptedStatus,
        stageAttempt: 0,
        nextRetryAt: null,
        lastError: null,
      });
    },
    [patchJob],
  );

  const markFailed = useCallback(
    (id: string, lastError: AnswerSubmissionFailure) => {
      patchJob(id, {
        stage: "failed",
        nextRetryAt: null,
        lastError,
      });
    },
    [patchJob],
  );

  const waitForRetry = useCallback(
    async (
      id: string,
      targetStage: "uploading" | "reconciling",
      attempt: number,
      signal: AbortSignal,
      lastError: AnswerSubmissionFailure,
    ) => {
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined) return false;
      patchJob(id, {
        stage: "retry-wait",
        stageAttempt: attempt + 1,
        nextRetryAt: Date.now() + delay,
        lastError,
      });
      await wait(delay, signal);
      patchJob(id, { stage: targetStage, nextRetryAt: null });
      return true;
    },
    [patchJob],
  );

  const reconcileSubmission = useCallback(
    async (id: string, signal: AbortSignal) => {
      const job = registryRef.current[id];
      if (!job?.fileKey) return;

      for (let attempt = 0; ; attempt += 1) {
        patchJob(id, {
          stage: "reconciling",
          stageAttempt: attempt,
          nextRetryAt: null,
          lastError: null,
        });
        try {
          const result = await getExamQuestionStatus(
            job.key.examId,
            job.key.questionNumber,
            job.key.retryCount,
            signal,
          );
          if (ACCEPTED_STATUSES.has(result.status)) {
            markSucceeded(id, result.status as "PENDING" | "PROCESSING" | "COMPLETED");
          } else {
            markFailed(
              id,
              failure("submit", "서버가 답변 처리 실패를 반환했어요.", false),
            );
          }
          return;
        } catch (error) {
          if (signal.aborted) throw error;
          const lastError = failure(
            "reconcile",
            "답변 접수 여부를 확인하지 못했어요.",
            true,
          );
          if (!isRetryableRequestError(error)) {
            patchJob(id, { stage: "submission-unknown", lastError });
            return;
          }
          const willRetry = await waitForRetry(
            id,
            "reconciling",
            attempt,
            signal,
            lastError,
          );
          if (!willRetry) {
            patchJob(id, { stage: "submission-unknown", lastError, nextRetryAt: null });
            return;
          }
        }
      }
    },
    [markFailed, markSucceeded, patchJob, waitForRetry],
  );

  const runSubmission = useCallback(
    async (id: string, signal: AbortSignal) => {
      let job = registryRef.current[id];
      if (!job) return;

      if (job.stage === "submission-unknown" || job.stage === "reconciling") {
        await reconcileSubmission(id, signal);
        return;
      }

      if (!job.fileKey) {
        let uploadedFileKey: string | null = null;
        for (let attempt = 0; ; attempt += 1) {
          patchJob(id, {
            stage: "uploading",
            stageAttempt: attempt,
            nextRetryAt: null,
            lastError: null,
          });
          try {
            const uploadTarget = await getAnswerUploadUrl(job.key, signal);
            const expiresAt = Date.now() + uploadTarget.expiresIn * 1_000;
            await uploadAnswerAudio(
              uploadTarget.uploadUrl,
              job.audioFileUri,
              expiresAt,
              signal,
            );
            uploadedFileKey = uploadTarget.fileKey;
            break;
          } catch (error) {
            if (signal.aborted) throw error;
            const retryable = isRetryableRequestError(error);
            const uploadFailure = failure("upload", "답변 파일을 업로드하지 못했어요.", retryable);
            const shouldRenewExpiredUrl =
              error instanceof AnswerAudioUploadError && error.status === 403;
            const failedBeforePut = !(error instanceof AnswerAudioUploadError);
            if (!retryable || (!shouldRenewExpiredUrl && !failedBeforePut)) {
              markFailed(id, uploadFailure);
              return;
            }
            const willRetry = await waitForRetry(
              id,
              "uploading",
              attempt,
              signal,
              uploadFailure,
            );
            if (!willRetry) {
              markFailed(id, uploadFailure);
              return;
            }
          }
        }

        if (!uploadedFileKey) return;
        patchJob(id, {
          fileKey: uploadedFileKey,
          stage: "queued-submit",
          stageAttempt: 0,
          nextRetryAt: null,
          lastError: null,
        });
        job = registryRef.current[id];
      }

      if (!job?.fileKey) return;
      patchJob(id, {
        stage: "submitting",
        stageAttempt: 0,
        nextRetryAt: null,
        lastError: null,
      });
      try {
        const result = await submitAnswerForGrading(job.key, job.fileKey, signal);
        if (result.status === "FAILED") {
          markFailed(id, failure("submit", "서버가 답변 처리 실패를 반환했어요.", false));
          return;
        }
        markSucceeded(id, result.status);
      } catch (error) {
        if (signal.aborted && !appIsActiveRef.current) {
          patchJob(id, {
            stage: "submission-unknown",
            lastError: failure("reconcile", "답변 접수 여부를 다시 확인하고 있어요.", true),
          });
          return;
        }
        if (signal.aborted) throw error;

        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          markFailed(id, failure("submit", "채점 요청이 거부됐어요.", false));
          return;
        }

        patchJob(id, {
          stage: "submission-unknown",
          lastError: failure("reconcile", "답변 접수 여부를 확인하고 있어요.", true),
        });
        await reconcileSubmission(id, signal);
      }
    },
    [markFailed, markSucceeded, patchJob, reconcileSubmission, waitForRetry],
  );

  const startRunner = useCallback(
    (id: string) => {
      if (disposedRef.current || !appIsActiveRef.current || runnersRef.current.has(id)) return;
      const job = registryRef.current[id];
      if (!job || !isPendingStage(job.stage)) return;

      const controller = new AbortController();
      runnerControllersRef.current.set(id, controller);
      const runner = runSubmission(id, controller.signal)
        .catch((error: unknown) => {
          if (controller.signal.aborted || isAbortError(error)) return;
          const current = registryRef.current[id];
          if (!current) return;
          markFailed(
            id,
            failure(
              current.fileKey ? "submit" : "upload",
              current.fileKey
                ? "채점 요청을 처리하지 못했어요."
                : "답변 파일을 업로드하지 못했어요.",
              true,
            ),
          );
        })
        .finally(() => {
          runnerControllersRef.current.delete(id);
          runnersRef.current.delete(id);
          const current = registryRef.current[id];
          if (
            !disposedRef.current &&
            appIsActiveRef.current &&
            current &&
            ["queued-upload", "queued-submit", "reconciling"].includes(current.stage)
          ) {
            queueMicrotask(() => startRunnerRef.current(id));
          }
        });
      runnersRef.current.set(id, runner);
    },
    [markFailed, runSubmission],
  );
  startRunnerRef.current = startRunner;

  const register = useCallback(
    (answer: FinalizedAnswer): RegisterAnswerResult => {
      if (disposedRef.current) return { accepted: false, reason: "disposed" };

      const id = serializeAnswerKey(answer.key);
      const existing = registryRef.current[id];
      if (existing) {
        return existing.audioFileUri === answer.audioFileUri
          ? { accepted: true }
          : { accepted: false, reason: "uri-conflict" };
      }

      try {
        getValidAnswerAudioFile(answer.audioFileUri);
      } catch {
        return { accepted: false, reason: "invalid-file" };
      }

      const job: AnswerSubmissionJob = {
        key: { ...answer.key },
        audioFileUri: answer.audioFileUri,
        fileKey: null,
        stage: "queued-upload",
        stageAttempt: 0,
        nextRetryAt: null,
        lastError: null,
        acceptedStatus: null,
      };
      applyAction({ type: "register", id, job });
      queueMicrotask(() => startRunner(id));
      return { accepted: true };
    },
    [applyAction, startRunner],
  );

  const retry = useCallback(
    (key: AnswerKey) => {
      const id = serializeAnswerKey(key);
      const job = registryRef.current[id];
      if (!job || job.stage === "succeeded" || job.stage === "cancelled") return;
      const nextStage = job.stage === "submission-unknown"
        ? "reconciling"
        : job.fileKey
          ? "queued-submit"
          : "queued-upload";
      patchJob(id, {
        stage: nextStage,
        stageAttempt: 0,
        nextRetryAt: null,
        lastError: null,
      });
      startRunner(id);
    },
    [patchJob, startRunner],
  );

  const resumePending = useCallback(() => {
    for (const [id, job] of Object.entries(registryRef.current)) {
      if (isPendingStage(job.stage)) startRunner(id);
    }
  }, [startRunner]);

  const pausePending = useCallback(() => {
    appIsActiveRef.current = false;
    for (const controller of runnerControllersRef.current.values()) controller.abort();
  }, []);

  const dispose = useCallback(() => {
    if (disposedRef.current) return;
    disposedRef.current = true;
    mountedRef.current = false;
    for (const [id, controller] of runnerControllersRef.current.entries()) {
      controller.abort();
      patchJob(id, { stage: "cancelled", nextRetryAt: null });
    }
    const runners = [...runnersRef.current.values()];
    void Promise.allSettled(runners).then(() => {
      for (const job of Object.values(registryRef.current)) {
        if (job.stage === "succeeded") continue;
        try {
          deleteAnswerAudioFile(job.audioFileUri);
        } catch (error) {
          console.error("[AnswerSubmissions] 화면 이탈 파일 삭제 실패", error);
        }
      }
    });
  }, [patchJob]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        appIsActiveRef.current = true;
        resumePending();
      } else {
        pausePending();
      }
    });
    return () => subscription.remove();
  }, [pausePending, resumePending]);

  useEffect(() => {
    mountedRef.current = true;
    disposedRef.current = false;
    return dispose;
  }, [dispose]);

  const jobs = useMemo(() => Object.values(registry), [registry]);
  const summary = useMemo<AnswerSubmissionSummary>(() => {
    const registeredCount = jobs.length;
    const succeededCount = jobs.filter((job) => job.stage === "succeeded").length;
    const failedCount = jobs.filter((job) => job.stage === "failed").length;
    const pendingCount = jobs.filter((job) => isPendingStage(job.stage)).length;
    return {
      registeredCount,
      pendingCount,
      failedCount,
      succeededCount,
      isComplete:
        registeredCount === expectedAnswerCount &&
        succeededCount === expectedAnswerCount &&
        pendingCount === 0 &&
        failedCount === 0,
    };
  }, [expectedAnswerCount, jobs]);

  return {
    jobs,
    summary,
    register,
    retry,
    resumePending,
    dispose,
  };
}
