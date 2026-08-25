import { mapChallengeDayResult } from "@/features/challenge/map-challenge-question";
import { apiFetchWithAuthRetry } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type { ChallengeDayResult, RawChallengeDayResult } from "@/types/challenge";

/**
 * 특정 날짜의 문제 하나에 대한 풀이 결과를 가져온다.
 *
 * 오늘 전용이 아니라 날짜로 조회한다 — 결과 화면은 방금 제출하고 넘어올 때도, 지난
 * 날짜를 이력에서 열 때도 같은 이 API를 쓴다. AI가 아직이면 200에 `gradingStatus`가
 * `pending|processing`이고 `aiResult`가 `null`로 온다(오류가 아니다).
 */
export async function getChallengeDayResult(
  challengeDate: string,
  questionNumber: number,
  signal?: AbortSignal,
): Promise<ChallengeDayResult> {
  const { result } = await apiFetchWithAuthRetry<ApiEnvelope<RawChallengeDayResult>>(
    `/api/v1/challenges/${challengeDate}/results?questionNumber=${questionNumber}`,
    { signal },
  );
  return mapChallengeDayResult(result);
}
