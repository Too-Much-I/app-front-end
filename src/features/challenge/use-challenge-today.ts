import { useFocusEffect } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { AppState } from "react-native";

import {
  CHALLENGE_TODAY_QUERY_KEY,
  challengeTodayQueryOptions,
} from "@/features/challenge/challenge-today-queries";

/**
 * 오늘 진행도와, 그것을 다시 읽는 세 계기.
 *
 * 폴링하지 않는다. 하루 세 문장이 바뀌는 계기는 사용자가 하나를 풀었을 때와 날짜가
 * 넘어갔을 때뿐이고, 전자는 제출 훅이 캐시를 무효화해 알려준다.
 *
 * 화면이 아니라 이 훅이 갱신 계기를 소유한다 — 카드는 만료를 알 필요가 없고, 알게 되면
 * 같은 판단이 화면마다 흩어진다.
 */
export function useChallengeToday() {
  const queryClient = useQueryClient();
  const query = useQuery(challengeTodayQueryOptions());
  const { data, dataUpdatedAt, refetch } = query;

  /**
   * 낡은 캐시만 다시 읽는다.
   *
   * `refetch()`가 아니라 `stale: true` 필터를 쓰는 이유는 전자가 `staleTime`을 무시하고
   * 무조건 요청을 보내기 때문이다. 홈과 스테이지를 오가는 동안 진행도는 바뀌지 않으므로
   * 그 왕복마다 요청이 나가서는 안 된다. 제출로 무효화된 캐시는 낡은 것으로 표시돼 있어
   * 이 필터에 걸린다.
   */
  const refetchIfStale = useCallback(() => {
    void queryClient.refetchQueries({
      queryKey: CHALLENGE_TODAY_QUERY_KEY,
      stale: true,
    });
  }, [queryClient]);

  useFocusEffect(
    useCallback(() => {
      // 다른 화면에서 돌아왔을 때. 문제 화면이 진행도 갱신을 요구하며 나온 경우가 여기다.
      refetchIfStale();

      const subscription = AppState.addEventListener("change", (nextState) => {
        // 백그라운드에 있는 동안에는 아래 만료 타이머가 돌지 않으므로 복귀 시 한 번 본다.
        if (nextState === "active") refetchIfStale();
      });

      return () => subscription.remove();
    }, [refetchIfStale]),
  );

  /**
   * 화면을 켜둔 채 자정을 넘기는 경우.
   *
   * 포커스도 `active` 전환도 일어나지 않아 갱신 계기가 없다. 그래서 만료 시각에 한 번만
   * 타이머를 걸고, 여기서는 `refetch()`로 곧바로 읽는다 — 지금 보고 있는 화면이라
   * 낡은 진행도를 남겨둘 이유가 없다.
   */
  useEffect(() => {
    if (data === undefined) return;

    const expiresAtMs = dataUpdatedAt + data.expiresInSeconds * 1_000;
    const timer = setTimeout(
      () => void refetch(),
      Math.max(expiresAtMs - Date.now(), 0),
    );

    return () => clearTimeout(timer);
  }, [data, dataUpdatedAt, refetch]);

  return query;
}
