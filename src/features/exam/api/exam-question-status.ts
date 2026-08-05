import { apiFetchWithAuthRetry } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type { AnswerKey, ExamQuestionPollResult } from "@/types/exam";

/**
 * 문제 하나의 특정 회차 채점이 끝났는지 조회한다.
 *
 * 시험 전체 상태(`/status`)와 달리 재답변한 문제만 본다. 다른 문제의 채점이 남아 있어도
 * 이 회차가 COMPLETED면 새 회차 피드백을 열 수 있다.
 */
export async function getExamQuestionStatus(
  key: AnswerKey,
  signal?: AbortSignal,
): Promise<ExamQuestionPollResult> {
  const { examId, questionNumber, retryCount } = key;
  const { result } = await apiFetchWithAuthRetry<ApiEnvelope<ExamQuestionPollResult>>(
    `/api/v1/exams/${examId}/questions/status?questionNumber=${questionNumber}&retryCount=${retryCount}`,
    { signal },
  );
  return result;
}
