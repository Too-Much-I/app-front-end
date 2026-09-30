import type { AuthSession } from '@/features/auth/types';

export type IdentityLoginOrigin = 'noSession' | 'guest';
/** EMAIL_VERIFICATION은 SNS 로그인 경로에서 쓰지 않는다(2026-09-30 서버 확인). */
export type IdentityEnrollmentRequirement = 'PHONE_VERIFICATION' | 'PROFILE' | 'CONSENTS';

export type IdentityEnrollment = {
  enrollmentId: string;
  missingRequirements: IdentityEnrollmentRequirement[];
  expiresAt: number;
} & (
  | { origin: 'noSession' }
  | {
      origin: 'guest';
      privacyConsentVersion: string;
      termConsentVersion: string;
    }
);

export type IdentityExchangeResult =
  | { kind: 'authenticated'; session: AuthSession }
  | { kind: 'enrollment-required'; enrollment: IdentityEnrollment };

export type IdentityGuestPreparationResult =
  { kind: 'enrollment-required'; enrollment: IdentityEnrollment } | { kind: 'merge-required' };
