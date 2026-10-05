import { queryOptions } from '@tanstack/react-query';

import { getChallengeToday } from '@/features/challenge/api/challenge-today';

/**
 * 오늘 진행도의 쿼리 키.
 *
 * 제출이 접수되면 이 키를 무효화한다. 진행도가 바뀐 것은 아는데 만료 시각은 아직
 * 멀었으므로, 캐시를 낡은 것으로 표시해야 스테이지가 돌아오는 순간 다시 읽는다.
 */
export const CHALLENGE_TODAY_QUERY_KEY = ['challenge', 'today'] as const;

/**
 * 스테이지와, 진입 날짜를 모르는 문제 화면이 함께 쓰는 조회.
 *
 * `staleTime`을 서버가 준 `expiresInSeconds`로 잡는다 — 이 값이 다음 KST 자정까지
 * 남은 시간이라, 만료 전에는 포커스를 몇 번 오가도 요청이 나가지 않고 자정을 넘긴
 * 뒤에는 첫 접근에서 반드시 다시 읽힌다. 기기 시계로 자정을 계산하지 않는 이유는
 * 시간대 설정이 서버 기준과 어긋날 수 있어서다.
 */
export function challengeTodayQueryOptions() {
  return queryOptions({
    queryKey: CHALLENGE_TODAY_QUERY_KEY,
    queryFn: ({ signal }) => getChallengeToday(signal),
    staleTime: (query) => (query.state.data?.expiresInSeconds ?? 0) * 1_000,
  });
}
