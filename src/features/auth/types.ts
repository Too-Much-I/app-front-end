import type { ConsentRecordV2 } from '@/features/consent/consent-storage';

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
  /**
   * 광고성 푸시 선택 동의(2026-10-27 Identity 추가). 아직 이 항목을 주지 않는 서버면 `null`이고, 그때는 동의 화면과
   * 알림 설정에서 묻지 않는다 — 없다고 동의 조회 전체를 실패로 보면 모든 사용자가 앱 시작에서 막힌다.
   */
  marketingPush: ServerOptionalConsentItemStatus | null;
};

/**
 * 재동의 화면에서 고른 선택 동의. `marketingPush`가 `null`이면 서버가 항목을 주지 않아 묻지 않은 것이다.
 */
export type OptionalConsentChoices = {
  qualityReview: boolean;
  marketingPush: boolean | null;
};

/** 광고성 푸시 선택 동의를 보낼 때의 값. `false`도 기록(철회)이다. */
export type MarketingPushConsentChoice = {
  consented: boolean;
  version: string;
};

/**
 * 요청 본문에 붙이는 광고성 푸시 필드. 고르지 않았으면(서버가 버전을 주지 않음) 아무것도 붙이지 않는다 —
 * 동의 변경·Guest 승격은 빠진 필드를 "기존 상태 유지"로, 가입은 "미동의"로 본다(Identity Swagger 2026-10-27).
 */
export function marketingPushConsentFields(choice: MarketingPushConsentChoice | undefined): {
  isMarketingPushConsented?: boolean;
  marketingPushConsentVersion?: string;
} {
  return choice
    ? { isMarketingPushConsented: choice.consented, marketingPushConsentVersion: choice.version }
    : {};
}

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
  /** 빼면 서버가 기존 광고성 푸시 동의를 그대로 둔다. 답변 검토만 바꿀 때는 넣지 않는다. */
  isMarketingPushConsented?: boolean;
  marketingPushConsentVersion?: string;
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

export type BootstrapSource = 'startup' | 'consent-submit';

export type BootstrapRetry =
  | { operation: 'read-local' }
  | {
      operation: 'persist-consent';
      consent: ConsentRecordV2;
      continuation: 'guest' | 'authenticated';
    }
  | { operation: 'persist-installation'; installationId: string }
  | { operation: 'reissue' }
  | { operation: 'guest' }
  | {
      operation: 'persist-session';
      session: AuthSession;
      continuation: 'authenticated' | 'check-consent';
    }
  | { operation: 'check-consent' }
  | { operation: 'update-consent'; request: UpdateConsentsRequest };

export type AuthBootstrapState =
  | { status: 'CHECKING_LOCAL' }
  | {
      status: 'CONSENT_REQUIRED';
      mode: 'new' | 'existing';
      requiredItems: ConsentRequirements;
    }
  | { status: 'REISSUING' }
  | { status: 'CHECKING_SERVER_CONSENT' }
  | { status: 'GUEST_RECOVERING'; source: BootstrapSource }
  | { status: 'CONSENT_UPDATING'; source: 'consent-submit' }
  | { status: 'AUTHENTICATED' }
  | {
      status: 'RETRYABLE_ERROR';
      source: BootstrapSource;
      retry: BootstrapRetry;
      message: string;
      isRetrying?: boolean;
      autoRetryable: boolean;
    };

export type RequestAuthSnapshot = {
  accessToken: string;
  generation: number;
};

export class AuthProtocolError extends Error {
  constructor() {
    super('인증 응답 형식이 올바르지 않습니다.');
    this.name = 'AuthProtocolError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value > 0
  );
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
