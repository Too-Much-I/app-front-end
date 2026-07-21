import { mapExamGradingResult } from "@/features/exam/map-exam-grading-result";
import { apiFetch } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type { ExamGradingResult, RawExamSummaryResult } from "@/types/exam";

/** AI 채점 결과 및 피드백을 조회한다. */
export async function getExamGradingResult(examId: string): Promise<ExamGradingResult> {
  const { result } = await apiFetch<ApiEnvelope<RawExamSummaryResult>>(
    `/api/v1/exams/${examId}/summary`,
  );
  return mapExamGradingResult(result);
}
