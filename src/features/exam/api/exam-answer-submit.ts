import { apiFetch } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type { AnswerKey, ExamAnswerSubmitResult } from "@/types/exam";

export async function submitAnswerForGrading(
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
