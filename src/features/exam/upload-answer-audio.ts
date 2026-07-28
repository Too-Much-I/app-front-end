import { File, UploadType } from "expo-file-system";

const ANSWER_AUDIO_CONTENT_TYPE = "audio/mp4";
const PUT_TIMEOUT_MS = 15_000;
const PUT_RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000] as const;

export function getEqualJitterDelayMs(baseDelayMs: number): number {
  const minimumDelayMs = Math.ceil(baseDelayMs / 2);
  return minimumDelayMs + Math.floor(Math.random() * (baseDelayMs - minimumDelayMs + 1));
}

export class AnswerAudioUploadError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly status: number | null = null,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AnswerAudioUploadError";
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }

    const timeoutId = setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, ms);
    const handleAbort = () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", handleAbort);
      reject(signal?.reason);
    };
    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

function createAttemptSignal(signal?: AbortSignal): {
  signal: AbortSignal;
  didTimeout: () => boolean;
  cleanup: () => void;
} {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, PUT_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort(signal?.reason);

  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener("abort", abortFromCaller, { once: true });

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", abortFromCaller);
    },
  };
}

export function getValidAnswerAudioFile(audioFileUri: string): File {
  const file = new File(audioFileUri);
  if (!file.exists || file.size <= 0) {
    throw new AnswerAudioUploadError("유효한 답변 파일을 찾지 못했어요.", false);
  }
  return file;
}

async function putAnswerAudio(
  file: File,
  uploadUrl: string,
  signal?: AbortSignal,
): Promise<void> {
  const attempt = createAttemptSignal(signal);
  try {
    const result = await file.upload(uploadUrl, {
      httpMethod: "PUT",
      uploadType: UploadType.BINARY_CONTENT,
      headers: { "Content-Type": ANSWER_AUDIO_CONTENT_TYPE },
      mimeType: ANSWER_AUDIO_CONTENT_TYPE,
      sessionType: "foreground",
      signal: attempt.signal,
    });

    if (result.status < 200 || result.status >= 300) {
      throw new AnswerAudioUploadError(
        `답변 업로드에 실패했어요. (status: ${result.status})`,
        isRetryableStatus(result.status),
        result.status,
      );
    }
  } catch (error) {
    if (error instanceof AnswerAudioUploadError) throw error;
    if (signal?.aborted) throw error;
    if (attempt.didTimeout() || isAbortError(error)) {
      throw new AnswerAudioUploadError("답변 업로드 시간이 초과됐어요.", true, null, {
        cause: error,
      });
    }
    throw new AnswerAudioUploadError("답변 업로드 중 네트워크 오류가 발생했어요.", true, null, {
      cause: error,
    });
  } finally {
    attempt.cleanup();
  }
}

export async function uploadAnswerAudio(
  uploadUrl: string,
  audioFileUri: string,
  expiresAt: number,
  signal?: AbortSignal,
): Promise<void> {
  const file = getValidAnswerAudioFile(audioFileUri);

  for (let attempt = 0; ; attempt += 1) {
    if (Date.now() >= expiresAt) {
      throw new AnswerAudioUploadError("답변 업로드 주소가 만료됐어요.", false, 403);
    }

    try {
      await putAnswerAudio(file, uploadUrl, signal);
      return;
    } catch (error) {
      if (signal?.aborted) throw error;
      if (!(error instanceof AnswerAudioUploadError) || !error.retryable) throw error;

      const baseDelay = PUT_RETRY_DELAYS_MS[attempt];
      if (baseDelay === undefined) throw error;

      const delay = getEqualJitterDelayMs(baseDelay);
      if (Date.now() + delay + PUT_TIMEOUT_MS >= expiresAt) {
        throw new AnswerAudioUploadError(
          "답변 업로드 주소의 남은 시간이 부족해 재시도할 수 없어요.",
          false,
          403,
          { cause: error },
        );
      }
      await wait(delay, signal);
    }
  }
}

export function deleteAnswerAudioFile(audioFileUri: string): void {
  const file = new File(audioFileUri);
  if (file.exists) file.delete();
}
