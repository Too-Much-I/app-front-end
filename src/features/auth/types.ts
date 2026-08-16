import type { ConsentRecordV2 } from "@/features/consent/consent-storage";

export type GuestAuthRequest = {
  installationId: string;
  isPrivacyConsented: true;
  privacyConsentVersion: string;
  isTermConsented: true;
  termConsentVersion: string;
  /**
   * 필수 항목과 달리 `true` 리터럴이 아니라 `boolean`이다. 선택 항목은 "거부"도
   * 서버가 기록해야 하는 상태라서 `false`를 보낼 수 있어야 한다.
   */
  isQualityReviewConsented: boolean;
  qualityReviewConsentVersion: string;
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

/**
 * 선택 동의 항목의 서버 상태.
 *
 * 필수 항목(`ServerConsentItemStatus`)과 모양이 다르다. 아직 선택하지 않았거나
 * 동의를 철회하면 서버가 `consentedVersion`과 `consentedAt`을 `null`로 되돌리므로
 * 두 필드가 nullable이고, 동의 여부를 알려주는 `consented`가 따로 있다.
 */
export type ServerOptionalConsentItemStatus = {
  currentVersion: string;
  consented: boolean;
  consentedVersion: string | null;
  consentedAt: string | null;
  requiresConsent: boolean;
};

export type ServerConsentStatus = {
  privacy: ServerConsentItemStatus;
  terms: ServerConsentItemStatus;
  qualityReview: ServerOptionalConsentItemStatus;
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
  /** 선택 항목이라 `false`도 유효한 값이며, `false` 전송이 곧 동의 철회다. */
  isQualityReviewConsented: boolean;
  qualityReviewConsentVersion: string;
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
