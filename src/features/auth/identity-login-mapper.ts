import { z } from 'zod';

import type {
  IdentityEnrollment,
  IdentityExchangeResult,
  IdentityGuestPreparationResult,
  IdentityLoginOrigin,
} from '@/features/auth/identity-login-types';
import { AuthProtocolError, createAuthSession } from '@/features/auth/types';

const enrollmentSchema = z.object({
  type: z.literal('ENROLLMENT_REQUIRED'),
  enrollmentId: z.string().trim().min(1),
  missingRequirements: z.array(
    z.enum(['EMAIL_VERIFICATION', 'PHONE_VERIFICATION', 'PROFILE', 'CONSENTS']),
  ),
  expiresIn: z.number().int().positive(),
});
const guestEnrollmentSchema = enrollmentSchema.extend({
  privacyConsentVersion: z.string().trim().min(1),
  termConsentVersion: z.string().trim().min(1),
});

function parseEnrollment(
  value: unknown,
  origin: IdentityLoginOrigin,
  now: number,
): IdentityEnrollment {
  const parsed = enrollmentSchema.safeParse(value);
  if (!parsed.success) throw new AuthProtocolError();
  const data = parsed.data;
  // expiresIn은 토큰 응답과 동일하게 밀리초다. 배열 순서는 화면 순서가 아니다.
  const common = {
    enrollmentId: data.enrollmentId,
    missingRequirements: data.missingRequirements,
    expiresAt: now + data.expiresIn,
  };
  if (origin === 'noSession') return { ...common, origin };
  const guest = guestEnrollmentSchema.safeParse(value);
  if (!guest.success) throw new AuthProtocolError();
  return {
    ...common,
    origin,
    privacyConsentVersion: guest.data.privacyConsentVersion,
    termConsentVersion: guest.data.termConsentVersion,
  };
}

export function mapIdentityExchange(value: unknown, now = Date.now()): IdentityExchangeResult {
  if (typeof value !== 'object' || value === null || !('type' in value))
    throw new AuthProtocolError();
  switch (value.type) {
    case 'AUTHENTICATED':
      return { kind: 'authenticated', session: createAuthSession(value, now) };
    case 'ENROLLMENT_REQUIRED':
      return {
        kind: 'enrollment-required',
        enrollment: parseEnrollment(value, 'noSession', now),
      };
    default:
      throw new AuthProtocolError();
  }
}

export function mapIdentityGuestPreparation(
  value: unknown,
  now = Date.now(),
): IdentityGuestPreparationResult {
  if (typeof value !== 'object' || value === null || !('type' in value))
    throw new AuthProtocolError();
  switch (value.type) {
    case 'MERGE_REQUIRED':
      return { kind: 'merge-required' };
    case 'ENROLLMENT_REQUIRED':
      return {
        kind: 'enrollment-required',
        enrollment: parseEnrollment(value, 'guest', now),
      };
    default:
      throw new AuthProtocolError();
  }
}
