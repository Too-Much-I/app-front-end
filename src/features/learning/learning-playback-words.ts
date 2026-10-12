import type { LearningWordTiming } from '@/features/learning/learning-types';

export type LearningWordState = 'pending' | 'active' | 'complete';

/** Follow the media clock, including its pauses, seeks and the silent gaps in each clip. */
export function getLearningPlaybackWordStates(
  words: readonly LearningWordTiming[],
  seconds: number,
): LearningWordState[] {
  if (!Number.isFinite(seconds)) return words.map(() => 'pending');
  let current = -1;
  words.forEach((word, index) => {
    if (word.start <= seconds) current = index;
  });
  return words.map((word, index) => {
    if (index === current && seconds < word.end) return 'active';
    if (index < current || seconds >= word.end) return 'complete';
    return 'pending';
  });
}
