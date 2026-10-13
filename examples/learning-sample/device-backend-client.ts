import { serviceFetchWithMetadata, type JsonRequestInit } from '@/lib/api/transport';

export { ApiError } from '@/lib/api/transport';

// Selected only by LEARNING_SAMPLE=1 + LEARNING_DEVICE_BACKEND=1 in Metro.
// Use the production learning endpoints and schemas, with a local test session.
// Never put AWS, MongoDB, or model credentials in these client variables.
export async function apiFetch<T>(
  path: string,
  init: JsonRequestInit = {},
  timeoutMs?: number,
): Promise<T> {
  const base = process.env.EXPO_PUBLIC_LEARNING_DEVICE_API_URL;
  const session = process.env.EXPO_PUBLIC_LEARNING_DEVICE_SESSION;
  if (!__DEV__ || !base || !session || !path.startsWith('/api/v1/learning/')) {
    throw new Error('학습 테스트 서버 연결 설정을 확인해 주세요.');
  }
  const { envelope } = await serviceFetchWithMetadata(
    `${base.replace(/\/$/, '')}${path}`,
    { ...init, headers: { ...init.headers, Authorization: `Bearer ${session}` } },
    timeoutMs,
  );
  return envelope as T;
}

export const apiFetchWithAuthRetry = apiFetch;
