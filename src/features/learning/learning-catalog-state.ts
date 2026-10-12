import { getLearningProgressKey } from '@/features/learning/learning-progress';
import type {
  LearningLesson,
  LearningLevel,
  LearningUnit,
} from '@/features/learning/learning-types';

export function getLearningUnitProgress(
  unit: LearningUnit,
  completedKeys: ReadonlySet<string>,
  level: LearningLevel,
  lessons: ReadonlyMap<string, Pick<LearningLesson, 'questionNumber'>> = new Map(),
) {
  const questions = unit.lessonIds.map((id, index) => {
    const key = getLearningProgressKey({ id, part: unit.part }, level);
    const lesson = lessons.get(id);
    const completed = completedKeys.has(`learning-complete:${key}`);
    return { index, number: lesson?.questionNumber, completed };
  });
  return {
    questions,
    completed: questions.every((q) => q.completed),
    completedCount: questions.filter((q) => q.completed).length,
  };
}
export function getLearningCatalogState(
  units: readonly LearningUnit[],
  completedKeys: ReadonlySet<string>,
  level: LearningLevel,
  lessons: ReadonlyMap<string, Pick<LearningLesson, 'questionNumber'>> = new Map(),
) {
  const statuses = new Map(
    units.map((unit) => [unit.id, getLearningUnitProgress(unit, completedKeys, level, lessons)]),
  );
  const done = units.filter((unit) => statuses.get(unit.id)?.completed);
  const completedIds = new Set(done.map((unit) => unit.id));
  return {
    statuses,
    completedIds,
    completed: done,
    all: [...units.filter((unit) => !completedIds.has(unit.id)), ...done],
  };
}
