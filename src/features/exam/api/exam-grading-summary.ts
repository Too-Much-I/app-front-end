import { mapExamGradingResult } from "@/features/exam/map-exam-grading-result";
import { apiFetchWithAuthRetry } from "@/lib/api/client";
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
  const { result } = await apiFetchWithAuthRetry<ApiEnvelope<RawExamSummaryResult>>(
    gradingSummaryPath(examId),
    { signal },
  );
  return mapExamGradingResult(result);
}

/**
 * 웹뷰 브리지 전용 — 앱 도메인 타입으로 매핑하지 않고 서버 원본 result를 그대로 돌려준다.
 *
 * 웹은 자신의 매퍼와 렌더 타입을 따로 갖고 있다. 앱이 매핑해서 넘기면 두 도메인 타입이
 * 영원히 동기화돼야 하므로, 앱은 인증만 책임지고 매핑은 웹에 맡긴다.
 */
export async function getRawExamGradingSummary(
  examId: string,
): Promise<RawExamSummaryResult> {
  const { result } = await apiFetchWithAuthRetry<ApiEnvelope<RawExamSummaryResult>>(
    gradingSummaryPath(examId),
  );
  return result;
}
