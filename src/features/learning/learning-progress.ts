import type {
  LearningLesson,
  LearningLevel,
  LearningStage,
} from '@/features/learning/learning-types';

// Metering is informational: quiet or missed input must not block comparison or submission.
export type LearningTake = { uri: string; seconds: number; inputDetected: boolean | null };
export type LearningProgress = {
  stage: LearningStage;
  listen: { index: number; seconds: number; heard: number[] };
  shadow: { index: number; round: number; accepted: number[] };
  take: LearningTake | null;
  practiced: boolean;
  updatedAt: number;
};
export const EMPTY_LEARNING_PROGRESS: LearningProgress = {
  stage: 'listen',
  listen: { index: 0, seconds: 0, heard: [] },
  shadow: { index: 0, round: 0, accepted: [] },
  take: null,
  practiced: false,
  updatedAt: 0,
};
export function getLearningProgressKey(
  lesson: Pick<LearningLesson, 'id' | 'part'>,
  level: LearningLevel,
) {
  return `${lesson.id}:${lesson.part === 1 ? 'common' : level}`;
}
export function getLearningStageCompletion(
  progress: LearningProgress,
  sentences: number,
  part: number,
) {
  const rounds = part === 1 ? 1 : 3;
  return {
    listen: Array.from({ length: sentences }, (_, i) => i).every((i) =>
      progress.listen.heard.includes(i),
    ),
    shadow: Array.from({ length: sentences * rounds }, (_, i) => i).every((i) =>
      progress.shadow.accepted.includes(i),
    ),
    practice: progress.practiced,
  } satisfies Record<LearningStage, boolean>;
}
export function isLearningTakeUsable(take: LearningTake | null) {
  return take !== null && getLearningTakeIssue(take) === null;
}
export function getLearningTakeIssue(take: LearningTake | null): string | null {
  if (!take) return null;
  if (!Number.isFinite(take.seconds) || take.seconds < 3)
    return '녹음이 너무 짧아요. 3초 이상 답변한 뒤 마쳐 주세요.';
  return null;
}
export function getLearningStageLabel(stage: LearningStage, part: number): string {
  return (
    {
      listen: '듣기',
      shadow: part === 1 ? '따라 읽기' : '따라 말하기',
      practice: part === 1 ? '실전 읽기' : '실전 연습',
    } satisfies Record<LearningStage, string>
  )[stage];
}
export function formatLearningTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export function getLearningReviewPosition(
  progress: LearningProgress,
  sentences: number,
  part: number,
  stage: LearningStage,
): Partial<LearningProgress> {
  if (stage === 'listen') {
    const missing = Array.from({ length: sentences }, (_, i) => i).find(
      (i) => !progress.listen.heard.includes(i),
    );
    return { listen: { ...progress.listen, index: missing ?? 0, seconds: 0 } };
  }
  if (stage === 'shadow') {
    const rounds = part === 1 ? 1 : 3;
    const missing =
      Array.from({ length: sentences * rounds }, (_, i) => i).find(
        (i) => !progress.shadow.accepted.includes(i),
      ) ?? 0;
    return {
      shadow: { ...progress.shadow, index: Math.floor(missing / rounds), round: missing % rounds },
    };
  }
  return {};
}
