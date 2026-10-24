import { useQuery } from '@tanstack/react-query';

import { learningUnitDetailQueryOptions } from '@/features/learning/learning-queries';
import type { LearningLessonParams } from '@/navigation/types';
import type { LearningLesson, LearningUnitDetail } from '@/types/learning';

export type LearningLessonLookup =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'missing' }
  | {
      status: 'found';
      detail: LearningUnitDetail;
      lesson: LearningLesson;
      /** 같은 세트의 다음 문항. 마지막 문항이면 `null`. */
      nextLesson: LearningLesson | null;
    };

/**
 * 학습 단계 화면이 route param으로 받은 문항을 찾는다.
 *
 * 세 단계 화면이 같은 문항을 각자 읽지만 상세 조회 캐시가 같아 요청은 한 번이다. `missing`은 상세는 받았는데
 * 그 안에 route의 문항이 없는 경우다(목록과 상세의 콘텐츠 버전이 엇갈린 경우 등).
 */
export function useLearningLesson(params: LearningLessonParams): LearningLessonLookup {
  const {
    data: detail,
    isError,
    isFetching,
    refetch,
  } = useQuery(learningUnitDetailQueryOptions(params.unitId, params.part, params.level));

  // 다시 불러오는 동안은 `isError`가 남아 있어도 불러오는 중으로 본다.
  if (isError && !isFetching) return { status: 'error', retry: () => void refetch() };
  if (!detail) return { status: 'loading' };

  const index = detail.lessons.findIndex((lesson) => lesson.id === params.lessonId);
  const lesson = detail.lessons[index];
  if (!lesson) return { status: 'missing' };
  return { status: 'found', detail, lesson, nextLesson: detail.lessons[index + 1] ?? null };
}
