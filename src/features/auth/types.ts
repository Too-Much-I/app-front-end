import type { ConsentRecordV2 } from "@/features/consent/consent-storage";

export type GuestAuthRequest = {
  installationId: string;
  isPrivacyConsented: true;
  privacyConsentVersion: string;
  isTermConsented: true;
  termConsentVersion: string;
};

export type ReissueRequest = {
  refreshToken: string;
};

export type ServerConsentItemStatus = {
  currentVersion: string;
  consentedVersion: string;
  consentedAt: string;
  requiresConsent: boolean;
};

export type ServerConsentStatus = {
  privacy: ServerConsentItemStatus;
  terms: ServerConsentItemStatus;
};

export type ConsentRequirements = {
  privacy: boolean;
  terms: boolean;
};

export type UpdateConsentsRequest = {
  isPrivacyConsented: true;
  privacyConsentVersion: string;
  isTermConsented: true;
  termConsentVersion: string;
};

export type RawTokenPair = {
  accessToken: string;
  refreshToken: string;
  grantType: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
};

export type AuthSession = {
  schemaVersion: 1;
  accessToken: string;
  refreshToken: string;
  grantType: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
};

export type BootstrapSource = "startup" | "consent-submit";

export type BootstrapRetry =
  | { operation: "read-local" }
  | {
      operation: "persist-consent";
      consent: ConsentRecordV2;
      continuation: "guest" | "authenticated";
    }
  | { operation: "persist-installation"; installationId: string }
  | { operation: "reissue" }
  | { operation: "guest" }
  | {
      operation: "persist-session";
      session: AuthSession;
      continuation: "authenticated" | "check-consent";
    }
  | { operation: "check-consent" }
  | { operation: "update-consent"; request: UpdateConsentsRequest };

export type AuthBootstrapState =
  | { status: "CHECKING_LOCAL" }
  | {
      status: "CONSENT_REQUIRED";
      mode: "new" | "existing";
      requiredItems: ConsentRequirements;
    }
  | { status: "REISSUING" }
  | { status: "CHECKING_SERVER_CONSENT" }
  | { status: "GUEST_RECOVERING"; source: BootstrapSource }
  | { status: "CONSENT_UPDATING"; source: "consent-submit" }
  | { status: "AUTHENTICATED" }
  | {
      status: "RETRYABLE_ERROR";
      source: BootstrapSource;
      retry: BootstrapRetry;
      message: string;
      isRetrying?: boolean;
    };

export type RequestAuthSnapshot = {
  accessToken: string;
  generation: number;
};

export class AuthProtocolError extends Error {
  constructor() {
    super("인증 응답 형식이 올바르지 않습니다.");
    this.name = "AuthProtocolError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

export function parseRawTokenPair(value: unknown): RawTokenPair {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.accessToken) ||
    !isNonEmptyString(value.refreshToken) ||
    !isNonEmptyString(value.grantType) ||
    !isPositiveInteger(value.accessTokenExpiresIn) ||
    !isPositiveInteger(value.refreshTokenExpiresIn)
  ) {
    throw new AuthProtocolError();
  }

  return {
    accessToken: value.accessToken,
    refreshToken: value.refreshToken,
    grantType: value.grantType,
    accessTokenExpiresIn: value.accessTokenExpiresIn,
    refreshTokenExpiresIn: value.refreshTokenExpiresIn,
  };
}

export function createAuthSession(value: unknown, receivedAt: number = Date.now()): AuthSession {
  const pair = parseRawTokenPair(value);
  return {
    schemaVersion: 1,
    accessToken: pair.accessToken,
    refreshToken: pair.refreshToken,
    grantType: pair.grantType,
    accessTokenExpiresAt: receivedAt + pair.accessTokenExpiresIn,
    refreshTokenExpiresAt: receivedAt + pair.refreshTokenExpiresIn,
  };
}

export function isAuthSession(value: unknown): value is AuthSession {
  return (
    isRecord(value) &&
    value.schemaVersion === 1 &&
    isNonEmptyString(value.accessToken) &&
    isNonEmptyString(value.refreshToken) &&
    isNonEmptyString(value.grantType) &&
    isPositiveInteger(value.accessTokenExpiresAt) &&
    isPositiveInteger(value.refreshTokenExpiresAt)
  );
}
