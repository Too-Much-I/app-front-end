import {
  mapExamRetries,
  type ReanswerQuestionItem,
} from "@/features/exam/map-exam-retries";
import { apiFetchWithAuthRetry } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type { RawExamRetriesResult } from "@/types/exam";

/**
 * 한 시험에서 재답변한 문항과 회차별 점수를 조회한다.
 *
 * 서버는 retryCount 1 이상이 실제로 있는 문항만 내려주고, 비교를 위해 최초 회차도 함께 준다.
 * 사용자 전체 스냅샷 endpoint는 아직 없어 시험 단위로만 조회할 수 있다.
 */
export async function getExamRetries(
  examId: string,
  signal?: AbortSignal,
): Promise<ReanswerQuestionItem[]> {
  const { result } = await apiFetchWithAuthRetry<ApiEnvelope<RawExamRetriesResult>>(
    `/api/v1/exams/${examId}/retries`,
    { signal },
  );
  return mapExamRetries(result);
}
