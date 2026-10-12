import { queryOptions } from '@tanstack/react-query';
import { getLearningUnits } from '@/features/learning/api/get-learning-units';
import { getLearningUnit } from '@/features/learning/api/get-learning-unit';
import type { LearningLevel } from '@/features/learning/learning-types';

export const LEARNING_QUERY_KEY = ['answer-learning'] as const;
export const learningUnitsQuery = (part: number, level: LearningLevel) =>
  queryOptions({
    queryKey: [...LEARNING_QUERY_KEY, 'units', part, part === 1 ? 'common' : level],
    queryFn: ({ signal }) => getLearningUnits(part, level, signal),
    staleTime: 30_000,
    retry: false,
  });
export const learningUnitQuery = (id: string, level: LearningLevel) =>
  queryOptions({
    queryKey: [...LEARNING_QUERY_KEY, 'unit', id, level],
    queryFn: ({ signal }) => getLearningUnit(id, level, signal),
    // Pin content during an exercise; a reconnect must not replace its audio/timings.
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
