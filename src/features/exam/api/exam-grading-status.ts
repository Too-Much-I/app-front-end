import { apiFetchWithAuthRetry } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type { ExamGradingStatus } from "@/types/exam";

/** 채점 대기 화면에서 시험 단위 lifecycle 상태를 조회한다. */
export async function getExamGradingStatus(
  examId: string,
  signal?: AbortSignal,
): Promise<ExamGradingStatus> {
  const { result } = await apiFetchWithAuthRetry<ApiEnvelope<ExamGradingStatus>>(
    `/api/v1/exams/${examId}/status`,
    { signal },
  );
  return result;
}
