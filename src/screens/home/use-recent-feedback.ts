import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';

import { appAuthRuntime } from '@/features/auth/app-auth-runtime';

import { getExamHistory } from '@/features/exam/api/exam-history';
import { reportOperationalError } from '@/lib/operational-error-reporting';
import type { ExamHistoryItem } from '@/features/exam/map-exam-history';

export type RecentFeedbackState =
  { status: 'loading' } | { status: 'ready'; item: ExamHistoryItem | null } | { status: 'error' };

/** 홈이 다시 보일 때마다 완료 이력을 갱신하고 최신 한 건만 노출한다. */
export function useRecentFeedback() {
  const [state, setState] = useState<RecentFeedbackState>({ status: 'loading' });
  const [reloadNonce, setReloadNonce] = useState(0);
  const requestVersionRef = useRef(0);
  const hasReadyDataRef = useRef(false);
  const reportingAttemptRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      const requestVersion = reloadNonce;
      reportingAttemptRef.current += 1;
      const reportingAttempt = reportingAttemptRef.current;
      requestVersionRef.current = requestVersion;
      // 이미 그린 카드가 있으면 포커스 재조회 중에도 유지해 홈 레이아웃이 깜빡이지 않게 한다.
      setState((current) => (current.status === 'ready' ? current : { status: 'loading' }));

      getExamHistory(controller.signal)
        .then((items) => {
          if (controller.signal.aborted || requestVersionRef.current !== requestVersion) return;
          hasReadyDataRef.current = true;
          setState({ status: 'ready', item: items[0] ?? null });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || requestVersionRef.current !== requestVersion) return;
          console.error('[Home] 최근 피드백 조회 실패', error);
          if (!hasReadyDataRef.current) {
            reportOperationalError({
              code: 'FEEDBACK_HISTORY_LOAD_FAILED',
              surface: 'home',
              attempt: reportingAttempt,
              cause: error,
            });
          }
          // 이전 성공 데이터가 있다면 일시적인 재조회 실패로 카드를 없애지 않는다.
          setState((current) => (current.status === 'ready' ? current : { status: 'error' }));
        });

      return () => controller.abort();
    }, [reloadNonce]),
  );

  const retry = useCallback(() => {
    setReloadNonce((nonce) => nonce + 1);
  }, []);

  // 병합 직후에는 아직 합쳐지지 않은 기록을 먼저 보여주고, 학습 기록 이전이 끝나면 다시 조회한다.
  const { mergeProgress } = appAuthRuntime;
  const isMergePending = useStore(mergeProgress, (snapshot) => snapshot.status === 'tracking');
  useEffect(
    () =>
      mergeProgress.subscribe((next, previous) => {
        if (next.status === 'completed' && previous.status !== 'completed') retry();
      }),
    [mergeProgress, retry],
  );

  return { state, retry, isMergePending };
}
