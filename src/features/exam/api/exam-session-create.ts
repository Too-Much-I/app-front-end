import { mapExamSession } from "@/features/exam/map-exam-session";
import { apiFetch } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type { ExamSession, RawExamSession } from "@/types/exam";

/** 새 모의고사 세션을 생성하고 문제 목록을 받아온다. */
export async function createExamSession(): Promise<ExamSession> {
  const { result } = await apiFetch<ApiEnvelope<RawExamSession>>("/api/v1/exams", {
    method: "POST",
  });
  return mapExamSession(result);
}
