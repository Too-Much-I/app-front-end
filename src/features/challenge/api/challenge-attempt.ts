import { mapChallengeAttempt } from "@/features/challenge/map-challenge-question";
import { apiFetch } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type { ChallengeAttempt, RawChallengeAttempt } from "@/types/challenge";

/**
 * 녹음을 시작하기 전에 attempt를 만든다(명세 6.3).
 *
 * 이 응답에는 업로드 URL이 없다. presigned URL은 수명이 짧아서 리뷰하는 동안 시계를
 * 태우기 때문에, 녹음이 끝난 뒤 `issueChallengeUploadUrl`로 따로 받는다.
 *
 * 날짜 검사는 여기 한 번뿐이다. `X-Challenge-Date`가 서버의 현재 날짜와 다르면
 * `CHALLENGE_DATE_CHANGED`가 오고 attempt가 만들어지지 않는다. 반대로 한 번 만들어지면
 * 그 뒤의 요청은 `attemptId`만 쓰므로 자정을 넘겨도 `submissionDeadlineAt`까지는
 * 원래 날짜의 제출로 처리된다.
 *
 * 같은 문제에서 다시 호출해도 새 attempt를 만들지 않는다 — 제출 전 attempt가 남아 있으면
 * 서버가 같은 `attemptId`와 같은 `submissionDeadlineAt`을 돌려준다. 그래서 화면이
 * 다시 마운트되거나 네트워크 재시도가 걸려도 응시를 두 번 소비하지 않는다.
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
