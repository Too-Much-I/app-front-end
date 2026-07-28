import { apiFetch } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";

/** 보관된 답변으로 시험 단위 채점을 한 번 다시 요청한다. */
export async function retryExamGrading(
  examId: string,
  signal?: AbortSignal,
): Promise<void> {
  const { result } = await apiFetch<ApiEnvelope<void>>(
    `/api/v1/exams/${examId}/grading/retry`,
    { method: "POST", signal },
  );
  return result;
}
