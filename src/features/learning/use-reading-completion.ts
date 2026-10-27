import { useMutation, useQueryClient } from '@tanstack/react-query';

import { putLearningReadingCompletion } from '@/features/learning/api/learning-api';
import {
  learningResumeQueryKey,
  learningUnitsQueryKey,
} from '@/features/learning/learning-queries';
import { reportOperationalError } from '@/lib/operational-error-reporting';
import type { LearningLesson } from '@/types/learning';

/**
 * Part 1 문항 완료 저장(2026-10-23 결정).
 *
 * "이어서 하기"가 완료 기록을 기준으로 하므로 서버에 남긴다. 저장되면 그 파트의 목록 캐시와 모든 등급의 이어서
 * 하기 캐시를 무효화해 파트 화면의 완료 수와 카드를 다시 읽는다.
 *
 * 여기 `onSuccess`는 요청을 보낸 화면이 사라져도 실행되므로 화면과 상관없는 캐시 무효화만 둔다. 화면 이동은
 * 부르는 쪽이 `mutate(lesson, { onSuccess })`로 넘긴다 — 그 화면이 살아 있을 때만 실행된다(2026-10-25 결정).
 */
export function useReadingCompletion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lesson: LearningLesson) =>
      putLearningReadingCompletion(lesson.id, lesson.contentVersion),
    onSuccess: (_data, lesson) => {
      void queryClient.invalidateQueries({ queryKey: learningUnitsQueryKey(lesson.part) });
      void queryClient.invalidateQueries({ queryKey: learningResumeQueryKey() });
    },
    onError: (error) =>
      reportOperationalError({ code: 'LEARNING_COMPLETION_FAILED', cause: error }),
  });
}
