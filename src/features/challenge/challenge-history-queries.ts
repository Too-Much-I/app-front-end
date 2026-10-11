import { queryOptions } from '@tanstack/react-query';

import { getChallengeHistory } from '@/features/challenge/api/challenge-history';

/** 모든 달을 한 번에 다시 읽을 때 쓰는 앞부분. */
export const CHALLENGE_HISTORY_QUERY_KEY = ['challenge', 'history'] as const;

/**
 * 한 달의 이력 조회. `undefined`는 "서버가 정한 이번 달"이다.
 *
 * 이번 달을 따로 키로 두는 이유는 앱이 이번 달이 언제인지 모르기 때문이다. 이 조회의
 * 응답이 알려 준다. 같은 달을 `YYYY-MM`으로 한 번 더 받으면 요청이 겹치지만, 이번 달로
 * 돌아올 때는 `undefined`를 다시 쓰므로 그런 일이 없다.
 */
export function challengeHistoryQueryOptions(yearMonth: string | undefined) {
  return queryOptions({
    queryKey: [...CHALLENGE_HISTORY_QUERY_KEY, yearMonth ?? 'current'],
    queryFn: ({ signal }) => getChallengeHistory(yearMonth, signal),
  });
}
