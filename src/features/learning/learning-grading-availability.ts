import { z } from 'zod';

const capabilitiesSchema = z.object({
  ready: z.boolean(),
  lessonIds: z.array(z.string()),
});

export type LearningGradingAvailability =
  | { kind: 'checking' }
  | { kind: 'ready' }
  | { kind: 'unsupported'; message: string }
  | { kind: 'unavailable'; message: string };

export function getLearningGradingAvailability(
  value: unknown,
  lessonId: string,
): LearningGradingAvailability {
  const capabilities = capabilitiesSchema.parse(value);
  if (!capabilities.lessonIds.includes(lessonId))
    return {
      kind: 'unsupported',
      message: '이 문항은 채점을 준비하고 있어요. 녹음하고 내 답변을 들어볼 수 있어요.',
    };
  if (!capabilities.ready)
    return {
      kind: 'unavailable',
      message: '지금은 채점을 이용할 수 없어요. 녹음 연습은 가능해요.',
    };
  return { kind: 'ready' };
}
