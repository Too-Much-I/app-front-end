import { pickNextLesson } from '@/features/learning/pick-next-lesson';
import type { LearningUnitSummary } from '@/types/learning';

function unit(id: string, completed: boolean[]): LearningUnitSummary {
  return {
    id,
    part: 3,
    title: id,
    lessons: completed.map((done, index) => ({
      id: `${id}-q${index + 5}`,
      questionNumber: index + 5,
      completed: done,
    })),
  };
}

describe('pickNextLesson', () => {
  it('안 끝난 문항이 있는 첫 세트의 첫 미완료 문항을 고른다', () => {
    const units = [unit('a', [true, true, true]), unit('b', [true, false, false])];

    expect(pickNextLesson(units)).toEqual({ kind: 'next', unitId: 'b', lessonId: 'b-q6' });
  });

  it('모두 끝났으면 첫 세트 첫 문항을 함께 알려 준다', () => {
    const units = [unit('a', [true]), unit('b', [true])];

    expect(pickNextLesson(units)).toEqual({
      kind: 'all-done',
      firstUnitId: 'a',
      firstLessonId: 'a-q5',
    });
  });

  it('세트가 없으면 empty', () => {
    expect(pickNextLesson([])).toEqual({ kind: 'empty' });
  });
});
