import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { AppState } from "react-native";

import { notifyAnswerUploadComplete } from "@/features/exam/api/exam-answer-submit";
import { getAnswerUploadUrl } from "@/features/exam/api/exam-answer-upload-url";
import {
  AnswerAudioUploadError,
  deleteAnswerAudioFile,
  getEqualJitterDelayMs,
  getValidAnswerAudioFile,
  uploadAnswerAudio,
} from "@/features/exam/upload-answer-audio";
import { ApiError } from "@/lib/api/client";
import { reportOperationalError } from "@/lib/operational-error-reporting";
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

const NOTIFICATION_RETRY_DELAYS_MS = [1_000, 2_000, 4_000] as const;

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
  kind: AnswerSubmissionFailure["kind"] = "request",
): AnswerSubmissionFailure {
  return { stage, kind, message, retryable };
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
  const reportingAttemptsRef = useRef(new Map<string, number>());
  const reportedFailureAttemptsRef = useRef(new Map<string, number>());

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
    (id: string, lastError: AnswerSubmissionFailure, cause?: unknown) => {
      const job = registryRef.current[id];
      const attempt = reportingAttemptsRef.current.get(id) ?? 0;
      if (job && reportedFailureAttemptsRef.current.get(id) !== attempt) {
        reportedFailureAttemptsRef.current.set(id, attempt);
        reportOperationalError({
          code: "ANSWER_SUBMISSION_FAILED",
          stage: lastError.stage,
          reason: lastError.kind,
          retryable: lastError.retryable,
          questionNumber: job.key.questionNumber,
          retryCount: job.key.retryCount,
          attempt,
          cause,
        });
      }
      patchJob(id, {
        stage: "failed",
        nextRetryAt: null,
        lastError,
      });
    },
    [patchJob],
  );

  const runSubmission = useCallback(
    async (id: string, signal: AbortSignal) => {
      let job = registryRef.current[id];
      if (!job) return;

      if (!job.uploadUrl || job.uploadExpiresAt === null || !job.fileKey) {
        patchJob(id, {
          stage: "uploading",
          stageAttempt: 0,
          nextRetryAt: null,
          lastError: null,
        });
        try {
          const uploadTarget = await getAnswerUploadUrl(job.key, signal);
          patchJob(id, {
            uploadUrl: uploadTarget.uploadUrl,
            uploadExpiresAt: Date.now() + uploadTarget.expiresIn * 1_000,
            fileKey: uploadTarget.fileKey,
          });
          job = registryRef.current[id];
        } catch (error) {
          if (signal.aborted && !appIsActiveRef.current) {
            patchJob(id, { stage: "queued-upload", nextRetryAt: null });
            return;
          }
          if (signal.aborted) throw error;
          markFailed(
            id,
            failure(
              "upload",
              "답변 업로드 정보를 준비하지 못했어요.",
              isRetryableRequestError(error),
            ),
            error,
          );
          return;
        }
      }

      if (!job?.uploadUrl || job.uploadExpiresAt === null || !job.fileKey) {
        markFailed(id, failure("upload", "답변 업로드 정보가 올바르지 않아요.", false));
        return;
      }

      if (!job.uploadCompleted) {
        patchJob(id, {
          stage: "uploading",
          stageAttempt: 0,
          nextRetryAt: null,
          lastError: null,
        });
        try {
          await uploadAnswerAudio(
            job.uploadUrl,
            job.audioFileUri,
            job.uploadExpiresAt,
            signal,
          );
        } catch (error) {
          if (signal.aborted && !appIsActiveRef.current) {
            patchJob(id, { stage: "queued-upload", nextRetryAt: null });
            return;
          }
          if (signal.aborted) throw error;
          markFailed(
            id,
            failure(
              "upload",
              error instanceof AnswerAudioUploadError
                ? error.message
                : "답변 파일을 업로드하지 못했어요.",
              isRetryableRequestError(error),
            ),
            error,
          );
          return;
        }

        patchJob(id, {
          uploadCompleted: true,
          stage: "queued-notify",
          stageAttempt: 0,
          nextRetryAt: null,
          lastError: null,
        });
        try {
          deleteAnswerAudioFile(job.audioFileUri);
        } catch (error) {
          console.error("[AnswerSubmissions] S3 업로드 완료 파일 삭제 실패", error);
        }
        job = registryRef.current[id];
      }

      if (!job?.uploadCompleted || !job.fileKey) {
        markFailed(id, failure("notify", "답변 업로드 정보가 올바르지 않아요.", false));
        return;
      }

      let retriedFailedStatus = false;
      for (let attempt = 0; ; attempt += 1) {
        patchJob(id, {
          stage: "notifying",
          stageAttempt: attempt,
          nextRetryAt: null,
          lastError: null,
        });
        try {
          let result = await notifyAnswerUploadComplete(job.key, signal);
          if (result.status === "FAILED" && !retriedFailedStatus) {
            retriedFailedStatus = true;
            result = await notifyAnswerUploadComplete(job.key, signal);
          }
          if (result.status === "FAILED") {
            markFailed(
              id,
              failure(
                "notify",
                "서버가 답변을 처리하지 못했어요.",
                false,
                "server-processing",
              ),
            );
            return;
          }
          markSucceeded(id, result.status);
          return;
        } catch (error) {
          if (signal.aborted && !appIsActiveRef.current) {
            patchJob(id, { stage: "queued-notify", nextRetryAt: null });
            return;
          }
          if (signal.aborted) throw error;

          const retryable = isRetryableRequestError(error);
          const notificationFailure = failure(
            "notify",
            retryable
              ? "답변 업로드 사실을 서버에 알리지 못했어요."
              : "서버가 답변 업로드 고지를 거부했어요.",
            retryable,
          );
          const baseDelay = NOTIFICATION_RETRY_DELAYS_MS[attempt];
          if (!retryable || baseDelay === undefined) {
            markFailed(id, notificationFailure, error);
            return;
          }

          const delay = getEqualJitterDelayMs(baseDelay);
          patchJob(id, {
            stage: "retry-wait",
            stageAttempt: attempt + 1,
            nextRetryAt: Date.now() + delay,
            lastError: notificationFailure,
          });
          try {
            await wait(delay, signal);
          } catch (waitError) {
            if (signal.aborted && !appIsActiveRef.current) {
              patchJob(id, { stage: "queued-notify", nextRetryAt: null });
              return;
            }
            throw waitError;
          }
        }
      }
    },
    [markFailed, markSucceeded, patchJob],
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
              current.uploadCompleted ? "notify" : "upload",
              current.uploadCompleted
                ? "답변 업로드 사실을 서버에 알리지 못했어요."
                : "답변 파일을 업로드하지 못했어요.",
              true,
            ),
            error,
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
            ["queued-upload", "queued-notify"].includes(current.stage)
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
        uploadUrl: null,
        uploadExpiresAt: null,
        fileKey: null,
        uploadCompleted: false,
        stage: "queued-upload",
        stageAttempt: 0,
        nextRetryAt: null,
        lastError: null,
        acceptedStatus: null,
      };
      applyAction({ type: "register", id, job });
      reportingAttemptsRef.current.set(id, 0);
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
      if (job.lastError && !job.lastError.retryable) return;
      reportingAttemptsRef.current.set(
        id,
        (reportingAttemptsRef.current.get(id) ?? 0) + 1,
      );
      const nextStage = job.uploadCompleted ? "queued-notify" : "queued-upload";
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
