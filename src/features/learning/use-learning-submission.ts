import { randomUUID } from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';
import type { LearningTake } from '@/features/learning/learning-progress';
import type {
  LearningCheckResult,
  LearningSubmissionJob,
} from '@/features/learning/learning-submission';
import {
  createLearningSubmission,
  getLearningSubmission,
  retryLearningSubmission,
  uploadLearningSubmission,
} from '@/features/learning/learning-submission-api';
import type { LearningLevel } from '@/features/learning/learning-types';
import { getLearningSubmissionError } from '@/features/learning/learning-submission-error';

type SubmissionView =
  | { kind: 'idle' }
  | { kind: 'uploading' }
  | { kind: 'processing'; phase: 'queued' | 'transcribing' | 'grading' }
  | { kind: 'paused' }
  | { kind: 'error'; message: string; canRetry: boolean };

function waitForPoll(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new Error('cancelled'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, 1200);
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}

export function useLearningSubmission(
  lessonId: string,
  level: LearningLevel,
  take: LearningTake | null,
  onComplete: (result: LearningCheckResult, submissionId: string) => void,
  contentVersion: string,
) {
  const [state, setState] = useState<SubmissionView>({ kind: 'idle' });
  const active = useRef<AbortController | null>(null);
  const attempt = useRef<{ uri: string; id: string } | null>(null);
  const complete = useRef(onComplete);
  complete.current = onComplete;
  useEffect(() => {
    active.current?.abort();
    active.current = null;
    setState({ kind: 'idle' });
    attempt.current = null;
    return () => {
      active.current?.abort();
      active.current = null;
    };
  }, [lessonId, level, contentVersion, take?.uri]);

  const stopWaiting = () => {
    active.current?.abort();
    active.current = null;
    setState({ kind: 'paused' });
  };

  const submit = async () => {
    if (!take || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    const { signal } = controller;
    if (attempt.current?.uri !== take.uri) attempt.current = { uri: take.uri, id: randomUUID() };
    const { id } = attempt.current;
    let job: LearningSubmissionJob | undefined;
    try {
      setState({ kind: 'uploading' });
      // Repeating the same ID recovers an accepted upload whose response was lost.
      job = await createLearningSubmission(id, lessonId, level, signal, contentVersion);
      if (signal.aborted) return;
      if (
        job.id !== id ||
        job.lessonId !== lessonId ||
        job.level !== level ||
        job.contentVersion !== contentVersion
      )
        throw new Error('다른 답변의 처리 정보가 도착했어요. 다시 확인해 주세요.');
      if (job.status === 'awaiting_audio') {
        await uploadLearningSubmission(id, take.uri, signal);
        if (signal.aborted) return;
        job = await getLearningSubmission(id, signal);
      } else if (job.status === 'failed' && job.error?.retryable) {
        job = await retryLearningSubmission(id, signal);
      }
      const deadline = Date.now() + 150_000;
      while (!signal.aborted) {
        if (
          job.id !== id ||
          job.lessonId !== lessonId ||
          job.level !== level ||
          job.contentVersion !== contentVersion
        )
          throw new Error('다른 답변의 결과가 도착했어요. 다시 확인해 주세요.');
        switch (job.status) {
          case 'completed':
            if (!job.result) throw new Error('채점 결과를 확인하지 못했어요.');
            setState({ kind: 'idle' });
            complete.current(job.result, job.id);
            return;
          case 'no_speech':
            setState({
              kind: 'error',
              message: '말한 내용을 확인하지 못했어요. 다시 녹음해 주세요.',
              canRetry: false,
            });
            return;
          case 'failed':
            setState({
              kind: 'error',
              message: job.error?.message ?? '답변 처리에 실패했어요.',
              canRetry: job.error?.retryable ?? false,
            });
            return;
          case 'awaiting_audio':
            throw new Error('녹음 전송을 확인하지 못했어요. 다시 제출해 주세요.');
          case 'queued':
          case 'transcribing':
          case 'grading':
            setState({ kind: 'processing', phase: job.status });
        }
        if (Date.now() >= deadline)
          throw new Error('답변 확인이 지연되고 있어요. 다시 제출하면 기존 처리 상태를 확인해요.');
        await waitForPoll(signal);
        job = await getLearningSubmission(id, signal);
      }
    } catch (error) {
      if (!signal.aborted)
        setState({
          kind: 'error',
          ...getLearningSubmissionError(error),
        });
    } finally {
      if (active.current === controller) active.current = null;
    }
  };
  return {
    state,
    submit,
    stopWaiting,
    busy: state.kind === 'uploading' || state.kind === 'processing',
  };
}
