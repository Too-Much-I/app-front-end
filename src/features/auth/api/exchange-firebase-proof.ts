import { mapIdentityExchange } from "@/features/auth/identity-login-mapper";
import { getIdentityApiBaseUrl } from "@/lib/api/service-base-url";
import { serviceFetch } from "@/lib/api/transport";

export async function exchangeFirebaseProof(
  firebaseIdToken: string,
  signal?: AbortSignal,
) {
  const envelope = await serviceFetch<unknown>(
    `${getIdentityApiBaseUrl()}/api/v1/auth/firebase/exchange`,
    { method: "POST", body: JSON.stringify({ firebaseIdToken }), signal },
  );
  return mapIdentityExchange(envelope.result);
}
