import { useMutation, useQueryClient } from '@tanstack/react-query';

import { putLearningReadingCompletion } from '@/features/learning/api/learning-api';
import { learningUnitsQueryKey } from '@/features/learning/learning-queries';
import { reportOperationalError } from '@/lib/operational-error-reporting';
import type { LearningLesson } from '@/types/learning';

/**
 * Part 1 문항 완료 저장(2026-10-23 결정).
 *
 * 나중에 서버가 줄 "이어서 하기"가 완료 기록을 기준으로 하므로 서버에 남긴다. 저장되면 그 파트의 목록 캐시만
 * 무효화해 파트 화면의 완료 수를 다시 읽는다.
 */
export function useReadingCompletion(onSaved: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lesson: LearningLesson) =>
      putLearningReadingCompletion(lesson.id, lesson.contentVersion),
    onSuccess: (_data, lesson) => {
      void queryClient.invalidateQueries({ queryKey: learningUnitsQueryKey(lesson.part) });
      onSaved();
    },
    onError: (error) =>
      reportOperationalError({ code: 'LEARNING_COMPLETION_FAILED', cause: error }),
  });
}
