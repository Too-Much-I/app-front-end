import { SessionRestorationError } from "@/features/auth/session-restoration-types";
import { createAuthSession, type AuthSession } from "@/features/auth/types";
import { getIdentityApiBaseUrl } from "@/lib/api/service-base-url";
import { serviceFetchWithMetadata } from "@/lib/api/transport";

/** 재전달된 duration을 현재 시각에 더하지 않고 서버의 절대 만료 시각을 사용한다. */
export async function reissueSession(
  refreshToken: string,
  requestId: string,
  replaySupported: boolean,
): Promise<AuthSession> {
  const { envelope, headers } = await serviceFetchWithMetadata<unknown>(
    `${getIdentityApiBaseUrl()}/api/v1/auth/reissue`,
    {
      method: "POST",
      headers: { "Idempotency-Key": requestId },
      body: JSON.stringify({ refreshToken }),
    },
  );
  const session = createAuthSession(envelope.result);
  if (!replaySupported) return session;

  const accessExpiresAt = Date.parse(
    headers.get("Reissue-Access-Expires-At") ?? "",
  );
  const refreshExpiresAt = Date.parse(
    headers.get("Reissue-Refresh-Expires-At") ?? "",
  );
  if (
    !Number.isFinite(accessExpiresAt) ||
    !Number.isFinite(refreshExpiresAt) ||
    accessExpiresAt <= 0 ||
    refreshExpiresAt <= 0
  ) {
    throw new SessionRestorationError("response-format");
  }
  return {
    ...session,
    accessTokenExpiresAt: accessExpiresAt,
    refreshTokenExpiresAt: refreshExpiresAt,
  };
}
