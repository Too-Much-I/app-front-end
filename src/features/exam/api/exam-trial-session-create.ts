import { mapExamSession } from "@/features/exam/map-exam-session";
import { apiFetch } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type { ExamSession, RawExamSession } from "@/types/exam";

/** Part 1의 1번 문제만으로 구성된 맛보기 세션을 생성한다. */
export async function createTrialExamSession(): Promise<ExamSession> {
  const { result } = await apiFetch<ApiEnvelope<RawExamSession>>(
    "/api/v1/exams/trial",
    { method: "POST" },
  );
  return mapExamSession(result);
}
