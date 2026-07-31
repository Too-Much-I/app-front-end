import { mapExamGradingResult } from "@/features/exam/map-exam-grading-result";
import { apiFetch } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type {
  ExamGradingResult,
  RawExamSummaryResult,
} from "@/types/exam";

const gradingSummaryPath = (examId: string) => `/api/v1/exams/${examId}/summary`;

/** 완료된 시험의 AI 채점 결과 및 피드백을 조회한다. */
export async function getExamGradingResult(
  examId: string,
  signal?: AbortSignal,
): Promise<ExamGradingResult> {
  const { result } = await apiFetch<ApiEnvelope<RawExamSummaryResult>>(
    gradingSummaryPath(examId),
    { signal },
  );
  return mapExamGradingResult(result);
}
