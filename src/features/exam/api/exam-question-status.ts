import { apiFetch } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type { ExamQuestionPollResult } from "@/types/exam";

/** 특정 문제의 특정 회차(retryCount) 재시도 채점이 완료됐는지 폴링한다. */
export async function getExamQuestionStatus(
  examId: string,
  questionNumber: number,
  retryCount: number,
): Promise<ExamQuestionPollResult> {
  const { result } = await apiFetch<ApiEnvelope<ExamQuestionPollResult>>(
    `/api/v1/exams/${examId}/questions/status?questionNumber=${questionNumber}&retryCount=${retryCount}`,
  );
  return result;
}
