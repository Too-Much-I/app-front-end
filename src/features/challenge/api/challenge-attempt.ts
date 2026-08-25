import { mapChallengeAttempt } from "@/features/challenge/map-challenge-question";
import { apiFetch } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type { ChallengeAttempt, RawChallengeAttempt } from "@/types/challenge";

/**
 * attempt를 만들고 S3 Presigned PUT URL을 받는다.
 *
 * 같은 문제에서 다시 호출해도 새 attempt를 만들지 않는다 — 제출 전 attempt가 남아 있으면
 * 서버가 같은 `attemptId`에 새 URL만 붙여 돌려준다. 그래서 업로드 URL이 만료됐을 때
 * 앱이 할 일은 "새 attempt 만들기"가 아니라 이 API를 다시 부르는 것이다.
 */
export async function createChallengeAttempt(
  challengeDate: string,
  questionNumber: number,
  signal?: AbortSignal,
): Promise<ChallengeAttempt> {
  const { result } = await apiFetch<ApiEnvelope<RawChallengeAttempt>>(
    `/api/v1/challenges/today/questions/${questionNumber}/attempt`,
    {
      method: "POST",
      headers: { "X-Challenge-Date": challengeDate },
      signal,
    },
  );
  return mapChallengeAttempt(result);
}
