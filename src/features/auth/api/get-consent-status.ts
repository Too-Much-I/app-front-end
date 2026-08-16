import type {
  ServerConsentItemStatus,
  ServerConsentStatus,
  ServerOptionalConsentItemStatus,
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

/**
 * 선택 동의 항목을 매핑한다. `mapConsentItem`을 재사용하지 않는 이유는 두 가지다.
 *
 * 1. 아직 선택하지 않았거나 동의를 철회한 상태에서는 서버가 `consentedVersion`과
 *    `consentedAt`을 `null`로 내려준다. 필수 항목 매퍼는 이를 형식 오류로 보고
 *    던지므로 그대로 쓰면 부트스트랩이 통째로 실패한다.
 * 2. 필수 항목에는 없는 `consented` 불리언으로 동의 여부를 판단해야 한다.
 */
function mapOptionalConsentItem(value: unknown): ServerOptionalConsentItemStatus {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.currentVersion) ||
    typeof value.consented !== "boolean" ||
    typeof value.requiresConsent !== "boolean" ||
    !(value.consentedVersion === null || isNonEmptyString(value.consentedVersion)) ||
    !(value.consentedAt === null || isIsoDate(value.consentedAt))
  ) {
    throw new ConsentStatusProtocolError();
  }

  return {
    currentVersion: value.currentVersion,
    consented: value.consented,
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
    qualityReview: mapOptionalConsentItem(value.qualityReview),
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
