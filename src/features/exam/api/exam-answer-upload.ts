import { apiFetch } from "@/lib/api/client";
import type { ExamAnswerSubmitResult, ExamAnswerUploadUrl } from "@/types/exam";

interface ApiEnvelope<T> {
  isSuccess: boolean;
  code: string;
  message: string;
  result: T;
}

/** S3 presigned upload URL을 발급받는다. retryCount별로 고유한 주소가 나오므로 반드시 실제 회차를 넘겨야 한다. */
async function getAnswerUploadUrl(
  examId: string,
  questionId: string,
  retryCount: number,
): Promise<ExamAnswerUploadUrl> {
  const { result } = await apiFetch<ApiEnvelope<ExamAnswerUploadUrl>>(
    `/api/v1/exams/${examId}/questions/${questionId}/upload-url?retryCount=${retryCount}`,
  );
  return result;
}

/** 한 번의 PUT 시도가 무한 대기하지 않도록 거는 타임아웃(ms). */
const PUT_TIMEOUT_MS = 15_000;

/** 발급받은 presigned URL로 녹음 파일을 S3에 직접 업로드한다. */
async function putAnswerAudioToS3(uploadUrl: string, audioBlob: Blob): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PUT_TIMEOUT_MS);

  try {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": audioBlob.type || "audio/wav" },
      body: audioBlob,
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`S3 업로드에 실패했습니다. (status: ${res.status})`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

/** S3 업로드 완료를 서버에 알리고 AI 채점을 요청한다. */
async function submitAnswerForGrading(
  examId: string,
  questionId: string,
  fileKey: string,
  retryCount: number,
): Promise<ExamAnswerSubmitResult> {
  const { result } = await apiFetch<ApiEnvelope<ExamAnswerSubmitResult>>(
    `/api/v1/exams/${examId}/questions/${questionId}/submit?retryCount=${retryCount}`,
    {
      method: "POST",
      body: JSON.stringify({ fileKey }),
    },
  );
  return result;
}

/** 재시도 사이 대기 시간(ms). 1s → 2s → 4s → 8s → 16s, 총 5회 재시도(최대 6번 시도). */
const UPLOAD_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * S3 PUT 업로드를 지수 백오프로 재시도한다. presigned URL은 재발급받지 않고 재사용하므로,
 * 서버가 응답한 실제 만료 시각(deadline)을 넘기면 재시도 횟수가 남아있어도 즉시 포기한다
 * (만료된 URL로는 S3가 어차피 거부하기 때문).
 */
async function putAnswerAudioToS3WithRetry(
  uploadUrl: string,
  audioBlob: Blob,
  deadline: number,
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    if (Date.now() >= deadline) {
      throw new Error("presigned URL이 만료되어 S3 업로드를 재시도할 수 없습니다.");
    }

    try {
      return await putAnswerAudioToS3(uploadUrl, audioBlob);
    } catch (err) {
      if (attempt >= UPLOAD_RETRY_DELAYS_MS.length) throw err;

      const delay = UPLOAD_RETRY_DELAYS_MS[attempt];
      if (Date.now() + delay >= deadline) throw err;

      await wait(delay);
    }
  }
}

/**
 * uploadExamAnswer가 어느 단계에서 실패했는지 호출부가 구분할 수 있도록 하는 에러.
 * "upload": presigned URL 발급 또는 S3 PUT 업로드 실패 (아직 서버에 파일이 없는 상태)
 * "grading": S3 업로드는 성공했지만 채점 요청(submit) 실패 (파일은 이미 S3에 있는 상태)
 */
export class ExamAnswerUploadError extends Error {
  constructor(
    public readonly stage: "upload" | "grading",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ExamAnswerUploadError";
  }
}

/**
 * 녹음이 끝난 답변 오디오를 업로드하고 AI 채점을 요청하는 전체 흐름.
 * 1) presigned URL 발급 → 2) S3에 PUT 업로드(실패 시 지수 백오프로 재시도) → 3) 업로드 완료 알림 + 채점 요청
 *
 * 호출부가 이 Promise를 기다리지 않는 fire-and-forget 방식이라 재시도 타이머는
 * React 라이프사이클과 무관하게 끝까지 진행된다.
 *
 * S3 업로드 단계와 채점 요청 단계의 실패는 사용자에게 서로 다른 의미를 가지므로(전자는
 * 재녹음이 필요할 수 있고, 후자는 파일이 이미 서버에 있어 재시도만 하면 됨)
 * ExamAnswerUploadError.stage로 구분해서 던진다.
 */
export async function uploadExamAnswer(
  examId: string,
  questionId: string,
  audioBlob: Blob,
  retryCount: number,
): Promise<ExamAnswerSubmitResult> {
  let fileKey: string;
  try {
    const uploadUrlResult = await getAnswerUploadUrl(examId, questionId, retryCount);
    const deadline = Date.now() + uploadUrlResult.expiresIn * 1000;
    await putAnswerAudioToS3WithRetry(uploadUrlResult.uploadUrl, audioBlob, deadline);
    fileKey = uploadUrlResult.fileKey;
  } catch (err) {
    throw new ExamAnswerUploadError("upload", "답변 업로드에 실패했어요.", { cause: err });
  }

  try {
    return await submitAnswerForGrading(examId, questionId, fileKey, retryCount);
  } catch (err) {
    throw new ExamAnswerUploadError("grading", "채점 요청에 실패했어요.", { cause: err });
  }
}
