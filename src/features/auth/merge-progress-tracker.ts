import { createStore } from 'zustand/vanilla';

import type { MergeProgress } from '@/features/auth/api/get-merge-progress';
import { classifyAuthRecovery } from '@/features/auth/auth-recovery';
import type { RequestAuthSnapshot } from '@/features/auth/types';

// 병합 직후 학습 기록 이전을 기다리는 상한. 넘으면 조회를 멈추고 받은 기록만 보여준다(2026-10-05 결정).
const MAX_WAIT_MS = 5 * 60_000;
// 서버가 다음 조회 간격을 주지 않거나 일시 오류일 때의 간격.
const FALLBACK_POLL_MS = 3_000;

/**
 * idle: 기다리는 병합 없음 / tracking: 학습 기록을 옮기는 중
 * completed: 이전 완료 — 기록을 다시 조회할 때 / ended: 완료를 확인하지 못하고 조회를 멈춤
 */
export type MergeProgressTrackingStatus = 'idle' | 'tracking' | 'completed' | 'ended';

interface MergeProgressTrackerDependencies {
  getProgress: (
    mergeId: string,
    accessToken: string,
    signal?: AbortSignal,
  ) => Promise<MergeProgress>;
  /** 병합으로 받은 MEMBER 세션의 Access Token. */
  prepareRequest: () => Promise<RequestAuthSnapshot>;
  now?: () => number;
}

/**
 * 병합 뒤 학습 기록 이전을 화면과 상관없이 조회한다. 홈은 상태를 읽기만 한다.
 * 앱을 다시 켜면 이어서 조회하지 않는다(상한 시간을 넘는 것으로 본다).
 */
export function createMergeProgressTracker(dependencies: MergeProgressTrackerDependencies) {
  const now = dependencies.now ?? Date.now;
  const store = createStore<{ status: MergeProgressTrackingStatus }>(() => ({ status: 'idle' }));
  let timer: ReturnType<typeof setTimeout> | null = null;
  let abort: AbortController | null = null;
  // 새 추적이나 초기화가 시작되면 올라간다. 이전 조회의 늦은 결과를 버리는 기준이다.
  let generation = 0;

  function stop(): void {
    generation += 1;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    abort?.abort();
    abort = null;
  }

  function scheduleNext(current: number, mergeId: string, deadline: number, delay: number): void {
    if (now() + delay > deadline) {
      store.setState({ status: 'ended' });
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      void poll(current, mergeId, deadline);
    }, delay);
  }

  async function poll(current: number, mergeId: string, deadline: number): Promise<void> {
    abort = new AbortController();
    try {
      const snapshot = await dependencies.prepareRequest();
      if (current !== generation) return;
      const progress = await dependencies.getProgress(mergeId, snapshot.accessToken, abort.signal);
      if (current !== generation) return;
      if (progress.status === 'COMPLETED') {
        store.setState({ status: 'completed' });
        return;
      }
      // ACTION_REQUIRED: 자동 진행이 막혀 운영 확인이 필요하다(2026-10-05 서버 답). 더 기다려도 바뀌지 않는다.
      if (progress.status === 'ACTION_REQUIRED') {
        store.setState({ status: 'ended' });
        return;
      }
      scheduleNext(current, mergeId, deadline, progress.nextPollAfterMs ?? FALLBACK_POLL_MS);
    } catch (error) {
      if (current !== generation) return;
      // 연결·서버 오류(429·503 포함)는 상한 안에서 다시 조회한다. 나머지는 더 기다려도 바뀌지 않는다.
      if (classifyAuthRecovery(error).action === 'retry')
        scheduleNext(current, mergeId, deadline, FALLBACK_POLL_MS);
      else store.setState({ status: 'ended' });
    }
  }

  /** 병합 응답의 mergeId로 조회를 시작한다. 이전 추적은 버린다. */
  function track(mergeId: string): void {
    stop();
    const current = generation;
    store.setState({ status: 'tracking' });
    void poll(current, mergeId, now() + MAX_WAIT_MS);
  }

  /** 계정이 바뀌면 이전 계정의 병합을 더 기다리지 않는다. */
  function reset(): void {
    stop();
    store.setState({ status: 'idle' });
  }

  return {
    getState: store.getState,
    getInitialState: store.getInitialState,
    subscribe: store.subscribe,
    track,
    reset,
    dispose: stop,
  };
}
