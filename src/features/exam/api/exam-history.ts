import {
  mapExamHistory,
  type ExamHistoryItem,
} from "@/features/exam/map-exam-history";
import { apiFetchWithAuthRetry } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type { RawExamHistoryResult } from "@/types/exam";

/**
 * 현재 사용자의 완료 모의고사 이력을 조회한다.
 *
 * 서버는 completedAt이 기록된 완료 시험만 내려주며, 종합 결과가 없는 시험
 * (summaryAvailable=false)도 포함한다. 페이지네이션은 아직 제공되지 않는다.
 */
export async function getExamHistory(
  signal?: AbortSignal,
): Promise<ExamHistoryItem[]> {
  const { result } = await apiFetchWithAuthRetry<ApiEnvelope<RawExamHistoryResult>>(
    "/api/v1/exams/history",
    { signal },
  );
  if (__DEV__) {
    console.log("[ExamHistory] raw API result", result);
  }
  return mapExamHistory(result);
}
