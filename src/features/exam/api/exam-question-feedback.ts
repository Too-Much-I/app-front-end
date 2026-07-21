import { mapExamQuestionDetail } from "@/features/exam/map-exam-question-feedback";
import { apiFetch } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type { ExamQuestionDetail, RawExamQuestionDetailResult } from "@/types/exam";

/**
 * 특정 문제의 특정 회차 채점 결과 및 상세 피드백을 조회한다.
 * 최초 응시는 retryCount=0.
 */
export async function getExamQuestionFeedback(
  examId: string,
  questionNumber: number,
  retryCount: number,
): Promise<ExamQuestionDetail> {
  const { result } = await apiFetch<ApiEnvelope<RawExamQuestionDetailResult>>(
    `/api/v1/exams/${examId}/questions?questionNumber=${questionNumber}&retryCount=${retryCount}`,
  );
  return mapExamQuestionDetail(result);
}
