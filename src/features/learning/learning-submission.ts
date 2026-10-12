import { z } from 'zod';

const practiceResultSchema = z.object({
  checklistVersion: z.string(),
  transcript: z.string(),
  metCount: z.number().int().nonnegative(),
  totalCount: z.number().int().positive(),
  items: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      verdict: z.enum(['met', 'not_met', 'uncertain']),
      probability: z.number().min(0).max(1),
      feedback: z.string(),
    }),
  ),
});

export type LearningCheckResult = z.infer<typeof practiceResultSchema>;

const submissionSchema = z.object({
  id: z.string().uuid(),
  lessonId: z.string(),
  contentVersion: z.string().min(1),
  level: z.enum(['IM3', 'IH', 'AL']),
  status: z.enum([
    'awaiting_audio',
    'queued',
    'transcribing',
    'grading',
    'completed',
    'no_speech',
    'failed',
  ]),
  result: practiceResultSchema.nullable(),
  error: z.object({ code: z.string(), message: z.string(), retryable: z.boolean() }).nullable(),
});

export type LearningSubmissionJob = z.infer<typeof submissionSchema>;

/** Validate the local/remote boundary before a result can mark practice complete. */
export function parseLearningSubmission(value: unknown): LearningSubmissionJob {
  const job = submissionSchema.parse(value);
  if (job.status === 'completed') {
    const result = job.result;
    if (
      !result ||
      result.totalCount !== result.items.length ||
      result.metCount !== result.items.filter((item) => item.verdict === 'met').length ||
      new Set(result.items.map((item) => item.id)).size !== result.items.length
    )
      throw new Error('채점 결과를 확인하지 못했어요. 다시 확인해 주세요.');
  }
  if (job.status === 'failed' && !job.error) throw new Error('채점 처리 상태를 확인하지 못했어요.');
  return job;
}
