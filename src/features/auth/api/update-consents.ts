import type { UpdateConsentsRequest } from "@/features/auth/types";
import { getIdentityApiBaseUrl } from "@/lib/api/service-base-url";
import { serviceFetch } from "@/lib/api/transport";

export async function updateConsents(
  accessToken: string,
  request: UpdateConsentsRequest,
): Promise<void> {
  await serviceFetch<unknown>(
    `${getIdentityApiBaseUrl()}/api/v1/users/me/consents`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(request),
    },
  );
}
