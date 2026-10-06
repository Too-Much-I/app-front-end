import type { RequestAuthSnapshot } from '@/features/auth/types';
import { getLearningApiBaseUrl } from '@/lib/api/service-base-url';
import { ApiError, serviceFetch, type JsonRequestInit } from '@/lib/api/transport';

interface ApiSessionAccess {
  prepareRequest: () => Promise<RequestAuthSnapshot>;
  recoverUnauthorized: (generation: number, code?: string) => Promise<RequestAuthSnapshot>;
}

type ReadRequestInit = Omit<JsonRequestInit, 'body' | 'method'> & {
  body?: never;
  method?: 'GET';
};

/**
 * 취소를 먼저 확인한 뒤 작업을 시작한다. promise를 받으면 이미 시작된 뒤라, 로그아웃으로 취소된 요청도
 * 세션 복구(재발급·복원)를 일으킬 수 있었다.
 */
function waitForCaller<T>(start: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) {
    return start();
  }
  if (signal.aborted) {
    return Promise.reject(signal.reason ?? new Error('요청이 취소되었습니다.'));
  }

  const promise = start();
  return new Promise<T>((resolve, reject) => {
    const handleAbort = () => reject(signal.reason ?? new Error('요청이 취소되었습니다.'));
    signal.addEventListener('abort', handleAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', handleAbort));
  });
}

async function requestWithToken<T>(
  path: string,
  snapshot: { accessToken: string },
  init: JsonRequestInit,
  timeoutMs?: number,
): Promise<T> {
  const envelope = await serviceFetch<unknown>(
    `${getLearningApiBaseUrl()}${path}`,
    {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${snapshot.accessToken}`,
      },
    },
    timeoutMs,
  );

  // apiFetch의 제네릭은 endpoint가 기대하는 검증 완료 Envelope 타입을 표현한다.
  return envelope as T;
}

/** 같은 세션 소유자를 모든 API에 연결한다. 생성 시 통신하지 않는다. */
export function createAuthenticatedApiClient(session: ApiSessionAccess) {
  async function apiFetch<T>(
    path: string,
    init: JsonRequestInit = {},
    timeoutMs?: number,
  ): Promise<T> {
    const snapshot = await waitForCaller(() => session.prepareRequest(), init.signal ?? undefined);

    return requestWithToken<T>(path, snapshot, init, timeoutMs);
  }

  async function apiFetchWithAuthRetry<T>(
    path: string,
    init: ReadRequestInit = {},
    timeoutMs?: number,
  ): Promise<T> {
    const firstSnapshot = await waitForCaller(
      () => session.prepareRequest(),
      init.signal ?? undefined,
    );

    let unauthorizedCode: string | undefined;
    try {
      return await requestWithToken<T>(path, firstSnapshot, init, timeoutMs);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        throw error;
      }
      unauthorizedCode = error.code;
    }

    const retrySnapshot = await waitForCaller(
      () => session.recoverUnauthorized(firstSnapshot.generation, unauthorizedCode),
      init.signal ?? undefined,
    );
    return requestWithToken<T>(path, retrySnapshot, init, timeoutMs);
  }

  return { apiFetch, apiFetchWithAuthRetry };
}
