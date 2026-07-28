import { apiFetch } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type { AnswerKey, ExamAnswerSubmitResult } from "@/types/exam";

/** S3 업로드가 끝난 답변의 fileKey를 서버에 알린다. 동일 답변의 반복 고지는 멱등이어야 한다. */
export async function notifyAnswerUploadComplete(
  key: AnswerKey,
  fileKey: string,
  signal?: AbortSignal,
): Promise<ExamAnswerSubmitResult> {
  const { examId, questionNumber, retryCount } = key;
  const { result } = await apiFetch<ApiEnvelope<ExamAnswerSubmitResult>>(
    `/api/v1/exams/${examId}/questions/${questionNumber}/submit?retryCount=${retryCount}`,
    {
      method: "POST",
      body: JSON.stringify({ fileKey }),
      signal,
    },
  );
  return result;
}
