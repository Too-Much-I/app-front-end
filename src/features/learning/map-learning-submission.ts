import { z } from 'zod';

import { learningGradeSchema, mapLearningGrade } from '@/features/learning/map-learning-grade';
import type { LearningSubmission } from '@/types/learning';

/**
 * 제출 생성·접수·조회·재시도가 함께 돌려주는 `LearningJob`.
 *
 * 상태마다 읽는 필드가 달라 상태로 나눠 검증한다 — `completed`인데 `result`가 없거나 `failed`인데 `error`가
 * 없으면 응답 형식 오류다. `lessonId`·`level`·`contentVersion`은 보낸 값이라 읽지 않는다. `error.message`는
 * 서버 문구라 화면에 쓰지 않는다(안내 문구는 앱이 정한다).
 */
export const learningSubmissionSchema = z.discriminatedUnion('status', [
  z.object({
    id: z.string(),
    status: z.enum(['awaiting_audio', 'queued', 'transcribing', 'grading']),
  }),
  z.object({ id: z.string(), status: z.literal('completed'), result: learningGradeSchema }),
  z.object({
    id: z.string(),
    status: z.literal('failed'),
    error: z.object({ code: z.string(), retryable: z.boolean() }),
  }),
  z.object({ id: z.string(), status: z.literal('no_speech') }),
]);

export function mapLearningSubmission(
  raw: z.infer<typeof learningSubmissionSchema>,
): LearningSubmission {
  switch (raw.status) {
    case 'completed':
      return { id: raw.id, status: raw.status, result: mapLearningGrade(raw.result) };
    case 'failed':
      return {
        id: raw.id,
        status: raw.status,
        errorCode: raw.error.code,
        retryable: raw.error.retryable,
      };
    case 'no_speech':
    case 'awaiting_audio':
    case 'queued':
    case 'transcribing':
    case 'grading':
      return { id: raw.id, status: raw.status };
  }
}
