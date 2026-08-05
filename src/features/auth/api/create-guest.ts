import { createAuthSession, type AuthSession, type GuestAuthRequest } from "@/features/auth/types";
import { getIdentityApiBaseUrl } from "@/lib/api/service-base-url";
import { serviceFetch } from "@/lib/api/transport";

export async function createGuest(request: GuestAuthRequest): Promise<AuthSession> {
  const response = await serviceFetch<unknown>(
    `${getIdentityApiBaseUrl()}/api/v1/auth/guest`,
    {
      method: "POST",
      body: JSON.stringify(request),
    },
  );
  return createAuthSession(response.result);
}
