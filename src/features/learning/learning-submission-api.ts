import { File, UploadType } from 'expo-file-system';
import { apiFetch, apiFetchWithAuthRetry } from '@/lib/api/client';
import type { ApiEnvelope } from '@/types/api';
import { parseLearningSubmission } from '@/features/learning/learning-submission';
import { getLearningGradingAvailability } from '@/features/learning/learning-grading-availability';
import { learningUploadSchema } from '@/features/learning/learning-upload-schema';
import type { LearningLevel } from '@/features/learning/learning-types';

const SUBMISSIONS = '/api/v1/learning/submissions';
export async function getLearningGradingSupport(lessonId: string, signal: AbortSignal) {
  const { result } = await apiFetchWithAuthRetry<ApiEnvelope<unknown>>(
    `/api/v1/learning/capabilities?lessonId=${encodeURIComponent(lessonId)}`,
    { signal },
    5000,
  );
  return getLearningGradingAvailability(result, lessonId);
}

async function requestPracticeJob(path: string, signal: AbortSignal, body?: object) {
  const { result } =
    body === undefined
      ? await apiFetchWithAuthRetry<ApiEnvelope<unknown>>(`${SUBMISSIONS}${path}`, { signal })
      : await apiFetch<ApiEnvelope<unknown>>(`${SUBMISSIONS}${path}`, {
          method: 'POST',
          signal,
          body: JSON.stringify(body),
        });
  return parseLearningSubmission(result);
}

export function createLearningSubmission(
  id: string,
  lessonId: string,
  level: LearningLevel,
  signal: AbortSignal,
  contentVersion: string,
) {
  return requestPracticeJob('', signal, { submissionId: id, lessonId, level, contentVersion });
}
export function getLearningSubmission(id: string, signal: AbortSignal) {
  return requestPracticeJob(`/${encodeURIComponent(id)}`, signal);
}
export function retryLearningSubmission(id: string, signal: AbortSignal) {
  return requestPracticeJob(`/${encodeURIComponent(id)}/retry`, signal, {});
}

/** Backend owns the object key, size limit and one submission's immutable audio. */
export async function uploadLearningSubmission(id: string, uri: string, signal: AbortSignal) {
  const file = new File(uri);
  const size = file.size;
  if (!file.exists || size <= 0 || size > 8 * 1024 * 1024)
    throw new Error('녹음 파일을 확인해 주세요.');
  const { result } = await apiFetch<ApiEnvelope<unknown>>(
    `${SUBMISSIONS}/${encodeURIComponent(id)}/upload-url`,
    {
      method: 'POST',
      signal,
      body: JSON.stringify({ contentType: 'audio/mp4', sizeBytes: size }),
    },
  );
  const target = learningUploadSchema.parse(result);
  if (
    target.submissionId !== id ||
    Date.parse(target.expiresAt) <= Date.now() ||
    size > target.maxBytes
  )
    throw new Error('녹음 업로드 주소가 올바르지 않습니다.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal.aborted) abort();
  else signal.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 45_000);
  try {
    // S3 only receives its signed URL + content type. Never forward the app's bearer token.
    const response = await file.upload(target.url, {
      httpMethod: 'PUT',
      uploadType: UploadType.BINARY_CONTENT,
      mimeType: 'audio/mp4',
      headers: { 'Content-Type': 'audio/mp4' },
      sessionType: 'foreground',
      signal: controller.signal,
    });
    if (response.status < 200 || response.status >= 300)
      throw new Error('녹음을 전송하지 못했어요. 다시 제출해 주세요.');
    if (signal.aborted) return;
    // Queue only after backend checks the object. Duplicate confirm calls must be idempotent.
    await requestPracticeJob(`/${encodeURIComponent(id)}/submit`, signal, {});
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
}
