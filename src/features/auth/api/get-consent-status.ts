import type {
  ServerConsentItemStatus,
  ServerConsentStatus,
} from "@/features/auth/types";
import { getIdentityApiBaseUrl } from "@/lib/api/service-base-url";
import { serviceFetch } from "@/lib/api/transport";

class ConsentStatusProtocolError extends Error {
  constructor() {
    super("동의 상태 응답 형식이 올바르지 않습니다.");
    this.name = "ConsentStatusProtocolError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function mapConsentItem(value: unknown): ServerConsentItemStatus {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.currentVersion) ||
    !isNonEmptyString(value.consentedVersion) ||
    !isIsoDate(value.consentedAt) ||
    typeof value.requiresConsent !== "boolean"
  ) {
    throw new ConsentStatusProtocolError();
  }

  return {
    currentVersion: value.currentVersion,
    consentedVersion: value.consentedVersion,
    consentedAt: value.consentedAt,
    requiresConsent: value.requiresConsent,
  };
}

function mapConsentStatus(value: unknown): ServerConsentStatus {
  if (!isRecord(value)) {
    throw new ConsentStatusProtocolError();
  }

  return {
    privacy: mapConsentItem(value.privacy),
    terms: mapConsentItem(value.terms),
  };
}

export async function getConsentStatus(accessToken: string): Promise<ServerConsentStatus> {
  const response = await serviceFetch<unknown>(
    `${getIdentityApiBaseUrl()}/api/v1/users/me/consents`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  return mapConsentStatus(response.result);
}
