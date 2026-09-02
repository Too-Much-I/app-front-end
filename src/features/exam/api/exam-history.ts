import {
  examHistorySchema,
  mapExamHistory,
  type ExamHistoryItem,
} from "@/features/exam/map-exam-history";
import { apiFetchWithAuthRetry } from "@/lib/api/client";
import { reportApiResultMismatch } from "@/lib/api/parse-api-result";
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
  // 관찰 전용 1단계 — 값을 바꾸지도 던지지도 않는다. 이미 운영 중인 응답이라
  // 새 스키마를 바로 켜면 지금까지 매퍼가 흡수하던 응답이 화면 오류로 바뀐다.
  // Sentry가 조용해지면 `parseApiResult`로 바꾸고 `RawExamHistoryResult`를 지운다.
  reportApiResultMismatch(examHistorySchema, result, "EXAM_HISTORY");
  return mapExamHistory(result);
}
