import { QueryCache, QueryClient } from '@tanstack/react-query';

import { reportOperationalError, type QueryFailureReport } from '@/lib/operational-error-reporting';

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: { failureReport?: QueryFailureReport };
  }
}

/**
 * 앱 전역 서버 상태 캐시.
 *
 * 도입 목적은 조회 결과를 컴포넌트에서 떼어내는 것이다. `useState`에 담긴 데이터는
 * 컴포넌트와 수명을 같이해 언마운트되면 사라지지만, 여기 담긴 데이터는 화면이 사라져도
 * 남는다. 같은 화면으로 돌아왔을 때 스켈레톤부터 다시 시작하지 않는 이유가 그것이다.
 *
 * 포그라운드 복귀 시 재조회(`refetchOnWindowFocus`)는 기본값이 켜짐이지만 React Native에서는
 * 동작하지 않는다 — 라이브러리 기본 focusManager가 DOM의 `visibilitychange`에 의존한다.
 * 필요해지면 `focusManager.setEventListener`에 `AppState`를 물려야 하며, 그 순간 모든 쿼리의
 * 동작이 바뀌므로 화면 하나의 판단으로 켜지 않는다.
 */
export const queryClient = new QueryClient({
  /*
   * `meta.failureReport`가 있는 조회의 실패를 보고한다. 보여 줄 데이터가 없을 때만 보낸다 —
   * 갖고 있던 데이터를 그대로 둔 채 실패한 뒤쪽 갱신은 사용자 흐름을 막지 않는다.
   */
  queryCache: new QueryCache({
    onError: (error, query) => {
      const report = query.meta?.failureReport;
      if (!report || query.state.data !== undefined) return;
      reportOperationalError({ ...report, cause: error });
    },
  }),
  defaultOptions: {
    queries: {
      /*
       * 자동 재시도를 켜지 않는다.
       *
       * 이 앱의 조회 실패 화면은 재시도로 풀리는 실패와 앱·서버 계약이 어긋난 실패를 구분해
       * 후자에는 재시도 버튼을 주지 않는다. 라이브러리가 뒤에서 세 번 더 시도하면 그 구분이
       * 수 초 늦게 도착하고, 계약 실패처럼 절대 성공하지 않을 요청도 그만큼 반복된다.
       */
      retry: false,
    },
  },
});
