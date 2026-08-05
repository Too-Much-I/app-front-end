import { apiFetchWithAuthRetry } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type { AnswerKey, ExamAnswerUploadUrl } from "@/types/exam";

export async function getAnswerUploadUrl(
  key: AnswerKey,
  signal?: AbortSignal,
): Promise<ExamAnswerUploadUrl> {
  const { examId, questionNumber, retryCount } = key;
  const { result } = await apiFetchWithAuthRetry<ApiEnvelope<ExamAnswerUploadUrl>>(
    `/api/v1/exams/${examId}/questions/${questionNumber}/upload-url?retryCount=${retryCount}`,
    { signal },
  );
  return result;
}
