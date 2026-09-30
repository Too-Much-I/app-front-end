import { authController } from '@/features/auth/auth-controller';
import { createAuthenticatedApiClient } from '@/lib/api/authenticated-client';

export { ApiError } from '@/lib/api/transport';

// TODO: Firebase/Identity 연결 완료 후 App과 함께 새 sessionController로 전환한다.
const client = createAuthenticatedApiClient(authController);
export const apiFetch = client.apiFetch;
export const apiFetchWithAuthRetry = client.apiFetchWithAuthRetry;
