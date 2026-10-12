import { ApiError } from '@/lib/api/transport';

export function getLearningSubmissionError(error: unknown) {
  if (error instanceof ApiError) {
    const result = error.result;
    const explicitRetry =
      typeof result === 'object' && result !== null && 'retryable' in result
        ? result.retryable
        : undefined;
    return {
      message: error.message,
      canRetry:
        error.code !== 'CHECKLIST_NOT_READY' &&
        (typeof explicitRetry === 'boolean'
          ? explicitRetry
          : error.status === 408 || error.status === 429 || error.status >= 500),
    };
  }
  return {
    message: error instanceof Error ? error.message : '서버에 연결하지 못했어요.',
    canRetry: true,
  };
}
