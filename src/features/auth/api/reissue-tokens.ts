import { createAuthSession, type AuthSession } from "@/features/auth/types";
import { getIdentityApiBaseUrl } from "@/lib/api/service-base-url";
import { ApiError, serviceFetch } from "@/lib/api/transport";

const DEFINITIVE_REFRESH_CODES = new Set([
  "INVALID_REFRESH_TOKEN",
  "REFRESH_TOKEN_EXPIRED",
  "REFRESH_TOKEN_REUSE_DETECTED",
]);

export async function reissueTokens(refreshToken: string): Promise<AuthSession> {
  const response = await serviceFetch<unknown>(
    `${getIdentityApiBaseUrl()}/api/v1/auth/reissue`,
    {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    },
  );
  return createAuthSession(response.result);
}

export function isDefinitiveRefreshFailure(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401 && Boolean(error.code) &&
    DEFINITIVE_REFRESH_CODES.has(error.code ?? "");
}
