import {
  challengeTodaySchema,
  mapChallengeToday,
} from "@/features/challenge/map-challenge-today";
import { apiFetchWithAuthRetry } from "@/lib/api/client";
import { parseApiResult } from "@/lib/api/parse-api-result";
import type { ApiEnvelope } from "@/types/api";
import type { ChallengeToday } from "@/types/challenge";

/**
 * 오늘 진행도. 챌린지의 모든 흐름이 여기서 시작한다.
 *
 * 이 응답의 `challengeDate`가 이후 요청의 `X-Challenge-Date`가 되는 유일한 출처다.
 * 앱이 기기 시계로 KST 날짜를 만들면 자정 근처에서 서버와 갈리므로 계산하지 않는다.
 *
 * `result`를 `unknown`으로 받는 이유는 제네릭이 검증이 아니라 주장이기 때문이다.
 * 실제 확인은 `parseApiResult`가 하고, 매퍼는 확인된 값만 받는다.
 */
export async function getChallengeToday(signal?: AbortSignal): Promise<ChallengeToday> {
  const { result } = await apiFetchWithAuthRetry<ApiEnvelope<unknown>>(
    "/api/v1/challenges/today",
    { signal },
  );
  return mapChallengeToday(parseApiResult(challengeTodaySchema, result, "CHALLENGE_TODAY"));
}
