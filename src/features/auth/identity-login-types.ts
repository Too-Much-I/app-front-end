import type { AuthSession } from '@/features/auth/types';

export type IdentityLoginOrigin = 'noSession' | 'guest';
export type IdentityEnrollmentRequirement =
  'EMAIL_VERIFICATION' | 'PHONE_VERIFICATION' | 'PROFILE' | 'CONSENTS';

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
