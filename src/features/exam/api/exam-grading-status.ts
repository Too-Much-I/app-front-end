import { apiFetch } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type { ExamGradingStatus } from "@/types/exam";

/** 채점 진행 상태를 조회한다. */
export async function getExamGradingStatus(examId: string): Promise<ExamGradingStatus> {
  const { result } = await apiFetch<ApiEnvelope<ExamGradingStatus>>(
    `/api/v1/exams/${examId}/status`,
  );
  return result;
}
