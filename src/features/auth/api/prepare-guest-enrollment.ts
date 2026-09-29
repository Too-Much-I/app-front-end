import { mapIdentityGuestPreparation } from "@/features/auth/identity-login-mapper";
import { getIdentityApiBaseUrl } from "@/lib/api/service-base-url";
import { serviceFetch } from "@/lib/api/transport";

export async function prepareGuestEnrollment(
  firebaseIdToken: string,
  guestAccessToken: string,
  signal?: AbortSignal,
) {
  const envelope = await serviceFetch<unknown>(
    `${getIdentityApiBaseUrl()}/api/v1/auth/firebase/guest/prepare`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${guestAccessToken}` },
      body: JSON.stringify({ firebaseIdToken }),
      signal,
    },
  );
  return mapIdentityGuestPreparation(envelope.result);
}
