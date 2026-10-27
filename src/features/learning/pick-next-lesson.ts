import type { LearningUnitSummary } from '@/types/learning';

export type NextLessonPick =
  | { kind: 'next'; unitId: string; lessonId: string }
  /** 모든 문항을 끝냈다. 무엇을 줄지는 화면이 정한다. */
  | { kind: 'all-done'; firstUnitId: string; firstLessonId: string }
  /** 이 파트·등급에 세트가 하나도 없다. */
  | { kind: 'empty' };

/**
 * 파트를 눌렀을 때 들어갈 문항을 서버의 완료 기록으로 고른다(2026-10-22 결정).
 *
 * 세트 순서대로 보고, 안 끝난 문항이 하나라도 있는 첫 세트의 첫 미완료 문항을 고른다. Part 3처럼 세트 안에
 * 문항이 여럿이면 Q5만 끝낸 세트는 Q6부터 이어진다.
 *
 * `completed`는 사용자·등급·콘텐츠 버전 기준이고, Part 2~5는 채점까지 끝나야 true가 된다. 그래서 퍼즐과
 * 쉐도잉만 하고 나간 문항은 다음에 다시 골라진다.
 */
export function pickNextLesson(units: readonly LearningUnitSummary[]): NextLessonPick {
  for (const unit of units) {
    const lesson = unit.lessons.find((candidate) => !candidate.completed);
    if (lesson) return { kind: 'next', unitId: unit.id, lessonId: lesson.id };
  }

  const firstUnit = units[0];
  const firstLesson = firstUnit?.lessons[0];
  if (!firstUnit || !firstLesson) return { kind: 'empty' };
  return { kind: 'all-done', firstUnitId: firstUnit.id, firstLessonId: firstLesson.id };
}
