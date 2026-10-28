import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Query, QueryCacheNotifyEvent, QueryClient, QueryKey } from '@tanstack/react-query';

import {
  isLearningProgressQueryKey,
  LEARNING_PROGRESS_CACHE_TIMES,
} from '@/features/learning/learning-queries';

const STORAGE_KEY = 'learning-progress-cache';
/**
 * 저장 형식 버전. 세트 목록(`LearningUnitSummary`)이나 이어서 하기(`LearningResume`) 모양을 바꾸면 올린다 —
 * 옛 모양이 새 화면에 들어가지 않게 버전이 다른 기록은 버린다. 유효 기간이 아니다(2026-10-28 결정: 기간 없음).
 */
const SCHEMA_VERSION = 1;

interface StoredQuery {
  queryKey: QueryKey;
  data: unknown;
  dataUpdatedAt: number;
  /** 완료 무효화 뒤 다시 받기 전에 앱이 꺼졌으면, 다음 실행에서 들어올 때 다시 받는다. */
  isInvalidated: boolean;
}

interface StoredCache {
  version: number;
  queries: StoredQuery[];
}

/** 디스크에 다시 써야 하는 변화. 받기 성공·무효화·직접 넣기·삭제(사용자 변경 때의 `clear()` 포함)다. */
function changesStoredProgress(event: QueryCacheNotifyEvent): boolean {
  if (!isLearningProgressQueryKey(event.query.queryKey)) return false;
  if (event.type === 'removed') return true;
  if (event.type !== 'updated') return false;
  return (
    event.action.type === 'success' ||
    event.action.type === 'invalidate' ||
    event.action.type === 'setState'
  );
}

function toStoredQuery(query: Query): StoredQuery {
  return {
    queryKey: query.queryKey,
    data: query.state.data,
    dataUpdatedAt: query.state.dataUpdatedAt,
    isInvalidated: query.state.isInvalidated,
  };
}

function isStoredCache(value: unknown): value is StoredCache {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    value.version === SCHEMA_VERSION &&
    'queries' in value &&
    Array.isArray(value.queries)
  );
}

async function writeProgress(queryClient: QueryClient): Promise<void> {
  const queries = queryClient
    .getQueryCache()
    .findAll({ predicate: (query) => isLearningProgressQueryKey(query.queryKey) })
    .filter((query) => query.state.data !== undefined)
    .map(toStoredQuery);
  if (queries.length === 0) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }
  const stored: StoredCache = { version: SCHEMA_VERSION, queries };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

async function restoreProgress(queryClient: QueryClient): Promise<void> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw === null) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  if (!isStoredCache(parsed)) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }
  for (const stored of parsed.queries) {
    // 디스크를 읽는 사이 서버에서 먼저 받았으면 그쪽이 새것이다.
    if (queryClient.getQueryData(stored.queryKey) !== undefined) continue;
    // 그냥 `setQueryData`로 만들면 기본 `gcTime`(5분)이 붙어 화면에 가기 전에 지워질 수 있다.
    queryClient
      .getQueryCache()
      .build(queryClient, { queryKey: stored.queryKey, ...LEARNING_PROGRESS_CACHE_TIMES });
    queryClient.setQueryData(stored.queryKey, stored.data, { updatedAt: stored.dataUpdatedAt });
    if (stored.isInvalidated) {
      void queryClient.invalidateQueries({
        queryKey: stored.queryKey,
        exact: true,
        refetchType: 'none',
      });
    }
  }
}

/**
 * 학습 진행도 캐시를 디스크에 남기고 앱 시작 때 되살린다(2026-10-28 결정). 멈추는 함수를 돌려준다.
 *
 * 메모리 캐시만 있으면 앱을 다시 켤 때마다 다섯 파트 목록과 이어서 하기를 새로 받는다. 저장 대상은 진행도 키
 * (`isLearningProgressQueryKey`)뿐이고, 받기 성공·무효화·삭제가 있을 때마다 그 키 전체를 다시 쓴다.
 * 사용자가 바뀌면 인증 런타임이 `queryClient.clear()`로 캐시를 비우고, 그 삭제가 그대로 디스크에도 반영된다.
 *
 * 쓰기는 되살리기가 끝난 뒤에 줄 세운다 — 되살리기 전에 쓰면 디스크의 기록을 덮어 버린다. 저장에 실패해도
 * 다음 진입에서 서버로 받을 뿐이라 화면을 막거나 보고하지 않는다.
 */
export function startLearningProgressCache(queryClient: QueryClient): () => void {
  let queue: Promise<void> = restoreProgress(queryClient).catch(() => undefined);
  let isWriteQueued = false;

  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (!changesStoredProgress(event) || isWriteQueued) return;
    // 같은 순간에 오는 여러 변화(`clear()`의 연속 삭제 등)를 한 번의 쓰기로 묶는다.
    isWriteQueued = true;
    queue = queue
      .then(() => {
        isWriteQueued = false;
        return writeProgress(queryClient);
      })
      .catch(() => undefined);
  });

  return unsubscribe;
}
