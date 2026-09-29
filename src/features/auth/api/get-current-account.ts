import { SessionRestorationError } from "@/features/auth/session-restoration-types";
import { getIdentityApiBaseUrl } from "@/lib/api/service-base-url";
import { serviceFetch } from "@/lib/api/transport";

export async function getCurrentAccount(
  accessToken: string,
): Promise<"MEMBER" | "GUEST"> {
  const { result } = await serviceFetch<unknown>(
    `${getIdentityApiBaseUrl()}/api/v1/users/me`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (
    typeof result === "object" &&
    result !== null &&
    "accountType" in result &&
    (result.accountType === "MEMBER" || result.accountType === "GUEST")
  ) {
    return result.accountType;
  }
  throw new SessionRestorationError("response-format");
}
