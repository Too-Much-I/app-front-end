import { useCallback, useEffect, useRef, useState } from 'react';
import type { LearningGradingAvailability } from '@/features/learning/learning-grading-availability';
import { getLearningGradingSupport } from '@/features/learning/learning-submission-api';

export function useLearningGradingSupport(lessonId: string, enabled: boolean) {
  const [state, setState] = useState<LearningGradingAvailability>({ kind: 'checking' });
  const active = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (!enabled) return;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setState({ kind: 'checking' });
    try {
      const next = await getLearningGradingSupport(lessonId, controller.signal);
      if (!controller.signal.aborted) setState(next);
    } catch {
      if (!controller.signal.aborted)
        setState({
          kind: 'unavailable',
          message: '채점에 연결하지 못했어요. 녹음 연습은 가능해요.',
        });
    } finally {
      if (active.current === controller) active.current = null;
    }
  }, [lessonId, enabled]);
  useEffect(() => {
    void refresh();
    return () => {
      active.current?.abort();
      active.current = null;
    };
  }, [refresh]);
  return { state, refresh };
}
