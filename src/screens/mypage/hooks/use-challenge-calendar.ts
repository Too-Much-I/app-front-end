import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import {
  CHALLENGE_HISTORY_QUERY_KEY,
  challengeHistoryQueryOptions,
} from '@/features/challenge/challenge-history-queries';
import {
  shiftYearMonth,
  toChallengeCalendarState,
  type ChallengeCalendarState,
} from '@/screens/mypage/challenge-calendar';

/**
 * 달력의 이력 조회와 달 이동.
 *
 * 마이페이지에 들어올 때마다 다시 읽는다(2026-10-11 결정). 제출할 때만 지우면 다른 기기에서
 * 푼 문제가 반영되지 않는다. 자동 재시도는 하지 않는다 — 저장소 규칙(`query-client.ts`)이다.
 * 이번 달을 읽지 못하면 달력을 숨긴 채 다음 진입을 기다린다.
 *
 * 다른 달로 넘길 때는 그 달을 먼저 받아 본 뒤에 넘긴다. 받지 못하면 보던 달을 그대로 두고
 * 넘길 수 없다는 안내를 띄운다(2026-10-11 결정) — 넘긴 뒤에 실패하면 달력이 이동 버튼과 함께
 * 사라져 돌아갈 방법이 없었다.
 */
export function useChallengeCalendar(): {
  state: ChallengeCalendarState;
  /** 다른 달을 받는 중. 그동안 이동 버튼을 막아 요청이 겹치지 않게 한다. */
  isChangingMonth: boolean;
  isMonthChangeFailed: boolean;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  dismissMonthChangeFailure: () => void;
} {
  const queryClient = useQueryClient();
  /** `undefined`는 서버가 정한 이번 달. 이번 달로 돌아오면 다시 `undefined`가 된다. */
  const [viewingYearMonth, setViewingYearMonth] = useState<string | undefined>(undefined);
  const [isChangingMonth, setChangingMonth] = useState(false);
  const [isMonthChangeFailed, setMonthChangeFailed] = useState(false);

  const currentMonth = useQuery(challengeHistoryQueryOptions(undefined));
  const viewingMonth = useQuery({
    ...challengeHistoryQueryOptions(viewingYearMonth),
    enabled: viewingYearMonth !== undefined,
  });

  useFocusEffect(
    useCallback(() => {
      // 처음 마운트될 때는 위 조회가 이미 나가 있다. `cancelRefetch: false`로 그 요청을 끊지 않고 합친다.
      void queryClient.refetchQueries(
        { queryKey: CHALLENGE_HISTORY_QUERY_KEY, type: 'active' },
        { cancelRefetch: false },
      );
    }, [queryClient]),
  );

  const currentYearMonth = currentMonth.data?.yearMonth;

  /**
   * `target` 달을 받은 뒤에만 넘긴다. `undefined`(이번 달)는 이미 받아 둔 달이다.
   *
   * 이미 받아 둔 달은 다시 기다리지 않는다(`ensureQueryData`). 넘긴 뒤 화면의 조회가
   * 낡은 캐시를 뒤에서 새로 읽고, 그게 실패해도 갖고 있던 달력을 지우지 않는다.
   */
  const changeMonth = useCallback(
    async (target: string | undefined) => {
      if (target === undefined) {
        setViewingYearMonth(undefined);
        return;
      }
      setChangingMonth(true);
      try {
        await queryClient.ensureQueryData(challengeHistoryQueryOptions(target));
        setViewingYearMonth(target);
      } catch {
        setMonthChangeFailed(true);
      } finally {
        setChangingMonth(false);
      }
    },
    [queryClient],
  );

  const goToPreviousMonth = useCallback(() => {
    const from = viewingYearMonth ?? currentYearMonth;
    if (from === undefined || isChangingMonth) return;
    void changeMonth(shiftYearMonth(from, -1));
  }, [changeMonth, currentYearMonth, isChangingMonth, viewingYearMonth]);

  const goToNextMonth = useCallback(() => {
    if (viewingYearMonth === undefined || isChangingMonth) return;
    const next = shiftYearMonth(viewingYearMonth, 1);
    void changeMonth(next === currentYearMonth ? undefined : next);
  }, [changeMonth, currentYearMonth, isChangingMonth, viewingYearMonth]);

  const dismissMonthChangeFailure = useCallback(() => setMonthChangeFailed(false), []);

  return {
    state: toChallengeCalendarState(currentMonth, viewingMonth, viewingYearMonth),
    isChangingMonth,
    isMonthChangeFailed,
    goToPreviousMonth,
    goToNextMonth,
    dismissMonthChangeFailure,
  };
}
