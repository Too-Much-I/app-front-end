import { useQuery } from '@tanstack/react-query';

import { isLearningPassRequiredError } from '@/features/learning/learning-pass';
import { learningUnitDetailQueryOptions } from '@/features/learning/learning-queries';
import type { LearningLessonParams } from '@/navigation/types';
import type { LearningLesson, LearningUnitDetail } from '@/types/learning';

export type LearningLessonLookup =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  /**
   * 유료 세트를 이용권 없이 열었다. 버튼은 이용권 화면으로 보내고, `retry`는 결제하고 돌아왔을 때 다시 받는 데
   * 쓴다. 다시 받는 동안에도 이 상태를 유지한다 — 안내가 사라졌다 다시 뜨면 본 순간 이벤트가 또 잡힌다.
   */
  | { status: 'pass-required'; retry: () => void }
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
    error,
    isError,
    isFetching,
    refetch,
  } = useQuery(learningUnitDetailQueryOptions(params.unitId, params.part, params.level));

  const retry = () => void refetch();
  if (isError && isLearningPassRequiredError(error)) return { status: 'pass-required', retry };
  // 다시 불러오는 동안은 `isError`가 남아 있어도 불러오는 중으로 본다.
  if (isError && !isFetching) return { status: 'error', retry };
  if (!detail) return { status: 'loading' };

  const index = detail.lessons.findIndex((lesson) => lesson.id === params.lessonId);
  const lesson = detail.lessons[index];
  if (!lesson) return { status: 'missing' };
  return { status: 'found', detail, lesson, nextLesson: detail.lessons[index + 1] ?? null };
}
