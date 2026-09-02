import {
  challengeQuestionSchema,
  mapChallengeQuestion,
} from "@/features/challenge/map-challenge-question";
import { apiFetchWithAuthRetry } from "@/lib/api/client";
import { parseApiResult } from "@/lib/api/parse-api-result";
import type { ApiEnvelope } from "@/types/api";
import type { ChallengeQuestion } from "@/types/challenge";

/**
 * 오늘 챌린지의 문제 하나를 가져온다. 조회만으로는 attempt도 응시 횟수도 소비하지 않는다.
 *
 * 날짜를 경로에 넣지 않는다 — "오늘"은 서버가 정한다. 대신 직전 응답에서 받은 날짜를
 * `X-Challenge-Date`로 보내고, 서버의 현재 KST 날짜와 다르면 `CHALLENGE_DATE_CHANGED`가
 * 온다. 자정을 넘겨 든 화면이 어제 문제를 오늘 것처럼 그리는 걸 막는 장치다.
 */
export async function getChallengeTodayQuestion(
  challengeDate: string,
  questionNumber: number,
  signal?: AbortSignal,
): Promise<ChallengeQuestion> {
  const { result } = await apiFetchWithAuthRetry<ApiEnvelope<unknown>>(
    `/api/v1/challenges/today/questions/${questionNumber}`,
    { headers: { "X-Challenge-Date": challengeDate }, signal },
  );
  return mapChallengeQuestion(
    parseApiResult(challengeQuestionSchema, result, "CHALLENGE_QUESTION"),
  );
}
