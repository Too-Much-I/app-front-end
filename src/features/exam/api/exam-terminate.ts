import { apiFetch } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type { ExamAnswerSubmitResult } from "@/types/exam";

/**
 * 응시 중인 시험을 중단하고, 그때까지 제출된 답변만으로 채점을 요청한다.
 * questionNumber는 실제로 답변까지 마친 문제 수(마지막으로 제출 완료된 문제 번호)이며,
 * 진행 중이던(아직 제출되지 않은) 문제는 포함하지 않는다.
 */
export async function terminateExam(
  examId: string,
  questionNumber: number,
): Promise<ExamAnswerSubmitResult> {
  console.log("[terminateExam] request query", { examId, questionNumber });
  const { result } = await apiFetch<ApiEnvelope<ExamAnswerSubmitResult>>(
    `/api/v1/exams/${examId}/terminate?questionNumber=${questionNumber}`,
    { method: "POST" },
  );
  return result;
}
