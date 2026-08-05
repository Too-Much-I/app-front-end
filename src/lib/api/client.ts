import { authController } from "@/features/auth/auth-controller";
import { getLearningApiBaseUrl } from "@/lib/api/service-base-url";
import {
  ApiError,
  serviceFetch,
  type JsonRequestInit,
} from "@/lib/api/transport";

export { ApiError } from "@/lib/api/transport";

function waitForCaller<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) {
    return promise;
  }
  if (signal.aborted) {
    return Promise.reject(signal.reason ?? new Error("요청이 취소되었습니다."));
  }

  return new Promise<T>((resolve, reject) => {
    const handleAbort = () => reject(signal.reason ?? new Error("요청이 취소되었습니다."));
    signal.addEventListener("abort", handleAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", handleAbort));
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

export async function apiFetch<T>(
  path: string,
  init: JsonRequestInit = {},
  timeoutMs?: number,
): Promise<T> {
  const firstSnapshot = await waitForCaller(
    authController.prepareRequest(),
    init.signal ?? undefined,
  );

  try {
    return await requestWithToken<T>(path, firstSnapshot, init, timeoutMs);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }
  }

  const retrySnapshot = await waitForCaller(
    authController.recoverUnauthorized(firstSnapshot.generation),
    init.signal ?? undefined,
  );
  return requestWithToken<T>(path, retrySnapshot, init, timeoutMs);
}
