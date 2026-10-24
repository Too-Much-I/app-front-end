import { QueryClient } from '@tanstack/react-query';

import {
  learningUnitsQueryKey,
  learningUnitsQueryOptions,
} from '@/features/learning/learning-queries';

jest.mock('@/features/learning/api/learning-api', () => ({}));

describe('learningUnitsQueryKey', () => {
  it('Part 1은 어느 등급이든 common 캐시를 가리킨다', () => {
    expect(learningUnitsQueryKey(1, 'IM3')).toEqual(['learning', 'units', 1, 'common']);
    expect(learningUnitsQueryKey(1, 'AL')).toEqual(learningUnitsQueryKey(1, 'IM3'));
  });

  it('Part 2~5는 고른 등급을 그대로 넣는다', () => {
    expect(learningUnitsQueryKey(3, 'AL')).toEqual(['learning', 'units', 3, 'AL']);
  });

  it('등급 없이 만든 키로 무효화하면 그 파트 목록만 무효화된다', async () => {
    const queryClient = new QueryClient();
    const part1 = learningUnitsQueryOptions(1, 'IM3').queryKey;
    const part2 = learningUnitsQueryOptions(2, 'IM3').queryKey;
    queryClient.setQueryData(part1, []);
    queryClient.setQueryData(part2, []);

    await queryClient.invalidateQueries({ queryKey: learningUnitsQueryKey(1) });

    expect(queryClient.getQueryState(part1)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(part2)?.isInvalidated).toBe(false);
  });
});
