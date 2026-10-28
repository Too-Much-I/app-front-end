import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';

import { startLearningProgressCache } from '@/features/learning/learning-progress-cache';
import {
  learningResumeQueryKey,
  learningUnitsQueryKey,
} from '@/features/learning/learning-queries';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/features/learning/api/learning-api', () => ({}));

const STORAGE_KEY = 'learning-progress-cache';
const UNITS_KEY = learningUnitsQueryKey(2, 'IM3');
const UNITS = [{ id: 'u1', part: 2, title: '세트 1', lessons: [] }];

/** 쓰기 줄이 비워질 때까지 기다린다. AsyncStorage 가짜도 promise라 몇 번 넘겨야 한다. */
async function settle() {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

async function storedKeys(): Promise<unknown[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw === null) return [];
  return JSON.parse(raw).queries.map((query: { queryKey: unknown }) => query.queryKey);
}

const clients: QueryClient[] = [];

/** 테스트가 끝나면 비워 기본 gcTime(5분) 타이머가 Jest를 붙잡지 않게 한다. */
function createQueryClient() {
  const queryClient = new QueryClient();
  clients.push(queryClient);
  return queryClient;
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

afterEach(() => {
  clients.splice(0).forEach((queryClient) => queryClient.clear());
});

describe('startLearningProgressCache', () => {
  it('진행도를 받으면 디스크에 남기고, 다음 실행에서 끝없는 보관 규칙으로 되살린다', async () => {
    const first = createQueryClient();
    const stop = startLearningProgressCache(first);
    first.setQueryData(UNITS_KEY, UNITS);
    await settle();
    stop();

    const next = createQueryClient();
    startLearningProgressCache(next);
    await settle();

    expect(next.getQueryData(UNITS_KEY)).toEqual(UNITS);
    expect(next.getQueryCache().find({ queryKey: UNITS_KEY })?.gcTime).toBe(Infinity);
  });

  it('무효화한 뒤 다시 받기 전에 꺼졌으면 다음 실행에서도 무효화 상태다', async () => {
    const first = createQueryClient();
    startLearningProgressCache(first);
    first.setQueryData(UNITS_KEY, UNITS);
    await first.invalidateQueries({ queryKey: learningUnitsQueryKey(2) });
    await settle();

    const next = createQueryClient();
    startLearningProgressCache(next);
    await settle();

    expect(next.getQueryState(UNITS_KEY)?.isInvalidated).toBe(true);
  });

  it('사용자가 바뀌어 캐시를 비우면 디스크에서도 지운다', async () => {
    const queryClient = createQueryClient();
    startLearningProgressCache(queryClient);
    queryClient.setQueryData(UNITS_KEY, UNITS);
    await settle();
    expect(await storedKeys()).toHaveLength(1);

    queryClient.clear();
    await settle();

    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('진행도가 아닌 캐시는 남기지 않는다', async () => {
    const queryClient = createQueryClient();
    startLearningProgressCache(queryClient);
    queryClient.setQueryData(UNITS_KEY, UNITS);
    queryClient.setQueryData(learningResumeQueryKey('IM3'), { part: 2 });
    queryClient.setQueryData(['learning', 'detail', 'u1', 'IM3'], { lessons: [] });
    await settle();

    expect(await storedKeys()).toEqual([UNITS_KEY, learningResumeQueryKey('IM3')]);
  });

  it('되살리기 전에 생긴 변화가 디스크의 기록을 덮지 않는다', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        queries: [{ queryKey: UNITS_KEY, data: UNITS, dataUpdatedAt: 1, isInvalidated: false }],
      }),
    );
    const queryClient = createQueryClient();
    startLearningProgressCache(queryClient);
    queryClient.setQueryData(learningResumeQueryKey('IM3'), { part: 2 });
    await settle();

    expect(await storedKeys()).toEqual(
      expect.arrayContaining([UNITS_KEY, learningResumeQueryKey('IM3')]),
    );
  });

  it('형식 버전이 다른 기록은 버린다', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 0,
        queries: [{ queryKey: UNITS_KEY, data: UNITS, dataUpdatedAt: 1, isInvalidated: false }],
      }),
    );
    const queryClient = createQueryClient();
    startLearningProgressCache(queryClient);
    await settle();

    expect(queryClient.getQueryData(UNITS_KEY)).toBeUndefined();
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
