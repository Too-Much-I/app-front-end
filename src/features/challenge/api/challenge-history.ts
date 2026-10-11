import {
  challengeHistorySchema,
  mapChallengeHistory,
} from '@/features/challenge/map-challenge-history';
import { apiFetchWithAuthRetry } from '@/lib/api/client';
import { parseApiResult } from '@/lib/api/parse-api-result';
import type { ApiEnvelope } from '@/types/api';
import type { ChallengeHistory } from '@/types/challenge';

/**
 * 한 달의 날짜별 풀이 수.
 *
 * `yearMonth`를 빼면 서버가 이번 달(KST)을 고른다. 앱은 기기 시계로 이번 달을 만들지 않고
 * 이 응답의 `yearMonth`를 이번 달로 쓴다 — 미래 달을 요청하면 400이 온다.
 */
export async function getChallengeHistory(
  yearMonth: string | undefined,
  signal?: AbortSignal,
): Promise<ChallengeHistory> {
  const query = yearMonth === undefined ? '' : `?yearMonth=${yearMonth}`;
  const { result } = await apiFetchWithAuthRetry<ApiEnvelope<unknown>>(
    `/api/v1/challenges/history${query}`,
    { signal },
  );
  return mapChallengeHistory(parseApiResult(challengeHistorySchema, result, 'CHALLENGE_HISTORY'));
}
