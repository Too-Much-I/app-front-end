import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createLearningSubmission,
  getLearningCapabilities,
  getLearningSubmission,
  issueLearningUploadUrl,
  LEARNING_AUDIO_CONTENT_TYPE,
  retryLearningSubmission,
  submitLearningSubmission,
} from '@/features/learning/api/learning-api';
import type { LearningLevel } from '@/features/learning/learning-level';
import {
  learningResumeQueryKey,
  learningUnitsQueryKey,
} from '@/features/learning/learning-queries';
import {
  AnswerAudioUploadError,
  getValidAnswerAudioFile,
  uploadAnswerAudio,
} from '@/features/exam/upload-answer-audio';
import { trackEvent } from '@/lib/amplitude';
import type { LearningLessonResult } from '@/lib/analytics-events';
import { ApiError } from '@/lib/api/client';
import { reportOperationalError } from '@/lib/operational-error-reporting';
import type { LearningGradeResult, LearningLesson, LearningSubmission } from '@/types/learning';

/** 채점 상태를 다시 묻는 간격. 서버 채점은 대개 몇 초 안에 끝난다. */
const POLL_INTERVAL_MS = 1_200;
/** 이만큼 기다려도 끝나지 않으면 실패로 보여 주고 재시도로 다시 조회하게 한다. */
const POLL_BUDGET_MS = 60_000;

/** 서버가 채점할 수 없다고 답하는 코드. 녹음 문제가 아니라 잠시 뒤 다시 시도할 일이다. */
const GRADING_NOT_READY_CODES = new Set(['GRADING_NOT_READY', 'CHECKLIST_NOT_READY']);

type GradingStage = 'create' | 'upload-url' | 'upload' | 'submit' | 'polling' | 'retry';

/**
 * 실패 뒤 재시도가 할 일. 어디서 멈췄는지에 따라 같은 녹음으로 이어서 보낼 곳이 다르다.
 * - `send`: 제출 생성~접수 중 실패. 같은 제출 ID로 처음부터 다시 보낸다(서버가 기존 제출을 돌려준다).
 * - `poll`: 접수는 됐는데 조회가 실패했거나 오래 걸렸다. 다시 조회만 한다.
 * - `retry`: 서버가 `retryable` 실패라고 했다. `/retry`를 부른다.
 */
type RetryPlan = 'send' | 'poll' | 'retry';

export type LearningGradingState =
  | { status: 'checking' }
  /** 서버가 이 문항을 지금 채점할 수 없다. 잠시 뒤 다시 확인한다. */
  | { status: 'not-ready' }
  | { status: 'ready' }
  | { status: 'grading' }
  | { status: 'completed'; result: LearningGradeResult }
  /**
   * `canRetry`가 false면 같은 녹음으로는 회복할 수 없어 새로 녹음해야 한다. `stillGrading`은 접수 뒤 조회만
   * 실패해 서버가 아직 채점하고 있을 수 있다는 뜻이다.
   */
  | { status: 'failed'; canRetry: boolean; stillGrading: boolean }
  | { status: 'no-speech' };

class GradingStepError extends Error {
  constructor(
    public readonly stage: GradingStage,
    options: ErrorOptions,
  ) {
    super(`학습 채점 ${stage} 실패`, options);
    this.name = 'GradingStepError';
  }
}

async function step<T>(stage: GradingStage, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw new GradingStepError(stage, { cause: error });
  }
}

/** 기다린다. 중간에 화면을 나가면 바로 끝나고, 부르는 쪽이 `signal.aborted`를 보고 멈춘다. */
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function isGradingNotReady(error: unknown): boolean {
  return (
    error instanceof ApiError && error.code !== undefined && GRADING_NOT_READY_CODES.has(error.code)
  );
}

/**
 * Part 2~5 채점 한 문항(2026-10-26 결정).
 *
 * 화면에 들어오면 서버가 이 문항을 채점할 수 있는지부터 묻는다. 녹음 파일을 받으면 제출 생성 → 업로드 주소 →
 * S3 PUT → 접수 → 상태 조회를 차례로 하고, `completed`면 그 파트·등급 목록만 무효화한다. 완료 기록은 서버의
 * 채점 worker가 저장해서 앱이 따로 보내지 않는다.
 *
 * 녹음 파일은 이 훅이 지우지 않는다 — 녹음 훅이 다음 녹음이나 화면 이탈 때 지운다. 재시도는 같은 파일과 같은
 * 제출 ID로 이어서 보내고, 새로 녹음하면 `reset`으로 제출 ID를 버린다. 화면을 나가면 진행 중인 요청과 조회를
 * 멈춘다.
 */
export function useLearningGrading(lesson: LearningLesson, level: LearningLevel) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<LearningGradingState>({ status: 'checking' });
  const [checkCount, setCheckCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  /** 이 녹음 한 건의 제출 ID. 새로 녹음할 때만 버린다. */
  const submissionIdRef = useRef<string | null>(null);
  const audioUriRef = useRef<string | null>(null);
  const retryPlanRef = useRef<RetryPlan>('send');

  useEffect(() => () => abortRef.current?.abort(), []);

  // 채점 준비 확인. `checkCount`가 바뀌면(준비 안 됨에서 다시 시도) 다시 묻는다.
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'checking' });
    getLearningCapabilities(lesson.id, controller.signal)
      .then((capabilities) => {
        if (controller.signal.aborted) return;
        const ready = capabilities.ready && capabilities.lessonIds.includes(lesson.id);
        setState({ status: ready ? 'ready' : 'not-ready' });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        reportOperationalError({
          code: 'LEARNING_GRADING_FAILED',
          stage: 'capabilities',
          cause: error,
        });
        setState({ status: 'not-ready' });
      });
    return () => controller.abort();
  }, [checkCount, lesson.id]);

  const startRequest = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: 'grading' });
    return controller.signal;
  }, []);

  /** 채점이 끝날 때까지 조회한다. 끝난 상태를 돌려주고, 예산을 넘기면 던진다. */
  const pollUntilDone = useCallback(
    async (first: LearningSubmission, signal: AbortSignal): Promise<LearningSubmission> => {
      const deadline = Date.now() + POLL_BUDGET_MS;
      let current = first;
      while (!isSettled(current)) {
        if (Date.now() >= deadline) {
          throw new GradingStepError('polling', { cause: new Error('채점 대기 시간 초과') });
        }
        await wait(POLL_INTERVAL_MS, signal);
        if (signal.aborted) return current;
        const id = current.id;
        current = await step('polling', () => getLearningSubmission(id, signal));
      }
      return current;
    },
    [],
  );

  const settle = useCallback(
    (submission: LearningSubmission) => {
      // 채점이 끝난 결과를 문항 마지막 단계 이벤트로 보낸다(2026-10-28 결정). 점수는 싣지 않는다.
      const trackLessonFinished = (result: LearningLessonResult) =>
        trackEvent({
          name: 'learning_lesson_finished',
          properties: { part: lesson.part, level, result },
        });
      switch (submission.status) {
        case 'completed':
          void queryClient.invalidateQueries({
            queryKey: learningUnitsQueryKey(lesson.part, level),
          });
          void queryClient.invalidateQueries({ queryKey: learningResumeQueryKey(level) });
          trackLessonFinished('completed');
          setState({ status: 'completed', result: submission.result });
          return;
        case 'no_speech':
          trackLessonFinished('no_speech');
          setState({ status: 'no-speech' });
          return;
        case 'failed':
          reportOperationalError({
            code: 'LEARNING_GRADING_FAILED',
            stage: 'job',
            jobErrorCode: submission.errorCode,
            cause: new Error('서버 채점 실패'),
          });
          trackLessonFinished('failed');
          retryPlanRef.current = 'retry';
          setState({ status: 'failed', canRetry: submission.retryable, stillGrading: false });
          return;
        case 'awaiting_audio':
        case 'queued':
        case 'transcribing':
        case 'grading':
          // 끝나지 않은 상태로 오는 건 화면을 나가 조회가 멈춘 경우뿐이라 상태를 건드리지 않는다.
          return;
        default: {
          const unhandled: never = submission;
          return unhandled;
        }
      }
    },
    [lesson.part, level, queryClient],
  );

  const fail = useCallback((error: unknown, signal: AbortSignal) => {
    if (signal.aborted) return;
    if (isGradingNotReady(error instanceof GradingStepError ? error.cause : error)) {
      // 녹음은 그대로 두고 준비 안 됨 안내로 보낸다. 다시 확인하면 녹음부터 다시 한다.
      setState({ status: 'not-ready' });
      return;
    }
    const stage = error instanceof GradingStepError ? error.stage : 'create';
    const cause = error instanceof GradingStepError ? error.cause : error;
    reportOperationalError({ code: 'LEARNING_GRADING_FAILED', stage, cause });
    const isPolling = stage === 'polling';
    retryPlanRef.current = isPolling ? 'poll' : 'send';
    // 녹음 파일이 망가졌거나 너무 크거나, 제출이 만료됐으면(410) 같은 녹음으로는 다시 보낼 수 없다.
    const unusableRecording =
      (cause instanceof AnswerAudioUploadError && cause.status === null && !cause.retryable) ||
      (cause instanceof ApiError && cause.status === 410);
    setState({ status: 'failed', canRetry: !unusableRecording, stillGrading: isPolling });
  }, []);

  const send = useCallback(
    async (audioFileUri: string, submissionId: string, signal: AbortSignal) => {
      const created = await step('create', () =>
        createLearningSubmission(
          { submissionId, lessonId: lesson.id, level, contentVersion: lesson.contentVersion },
          signal,
        ),
      );
      // 같은 ID로 다시 보냈는데 이미 접수된 제출이면 업로드를 건너뛰고 조회로 간다.
      if (created.status !== 'awaiting_audio') return created;

      const file = await step('upload', async () => getValidAnswerAudioFile(audioFileUri));
      const upload = await step('upload-url', () =>
        issueLearningUploadUrl(submissionId, file.size, signal),
      );
      if (file.size > upload.maxBytes) {
        throw new GradingStepError('upload', {
          cause: new AnswerAudioUploadError('녹음 파일이 너무 커요.', false),
        });
      }
      await step('upload', () =>
        uploadAnswerAudio(
          upload.url,
          audioFileUri,
          upload.expiresAtMs,
          signal,
          LEARNING_AUDIO_CONTENT_TYPE,
        ),
      );
      return step('submit', () => submitLearningSubmission(submissionId, signal));
    },
    [lesson.contentVersion, lesson.id, level],
  );

  /** 녹음을 마친 파일로 채점을 받는다. */
  const grade = useCallback(
    async (audioFileUri: string) => {
      const signal = startRequest();
      audioUriRef.current = audioFileUri;
      submissionIdRef.current ??= Crypto.randomUUID().toLowerCase();
      const submissionId = submissionIdRef.current;
      try {
        const accepted = await send(audioFileUri, submissionId, signal);
        settle(await pollUntilDone(accepted, signal));
      } catch (error) {
        fail(error, signal);
      }
    },
    [fail, pollUntilDone, send, settle, startRequest],
  );

  /** 실패 화면의 재시도. 멈춘 곳에 맞춰 같은 녹음으로 이어서 보낸다. */
  const retry = useCallback(async () => {
    const submissionId = submissionIdRef.current;
    const audioFileUri = audioUriRef.current;
    if (!submissionId || !audioFileUri) return;
    const plan = retryPlanRef.current;
    if (plan === 'send') {
      await grade(audioFileUri);
      return;
    }
    const signal = startRequest();
    try {
      const first =
        plan === 'retry'
          ? await step('retry', () => retryLearningSubmission(submissionId, signal))
          : await step('polling', () => getLearningSubmission(submissionId, signal));
      settle(await pollUntilDone(first, signal));
    } catch (error) {
      fail(error, signal);
    }
  }, [fail, grade, pollUntilDone, settle, startRequest]);

  const forgetRecording = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    submissionIdRef.current = null;
    audioUriRef.current = null;
    retryPlanRef.current = 'send';
  }, []);

  /** 새로 녹음하러 간다. 다른 녹음은 다른 제출이라 제출 ID를 버린다. */
  const reset = useCallback(() => {
    forgetRecording();
    setState({ status: 'ready' });
  }, [forgetRecording]);

  /** 준비 안 됨에서 다시 확인한다. 확인이 끝나면 녹음부터 다시 한다. */
  const recheck = useCallback(() => {
    forgetRecording();
    setCheckCount((count) => count + 1);
  }, [forgetRecording]);

  return { state, grade, retry, reset, recheck };
}

function isSettled(submission: LearningSubmission): boolean {
  return (
    submission.status === 'completed' ||
    submission.status === 'failed' ||
    submission.status === 'no_speech'
  );
}
