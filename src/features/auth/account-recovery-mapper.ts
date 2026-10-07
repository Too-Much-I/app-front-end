import { z } from 'zod';

import type { FirebaseLoginProvider } from '@/features/auth/firebase-auth-types';
import { AuthProtocolError } from '@/features/auth/types';

// 서버 기본 유효시간. 기기 시계가 서버보다 빨라 expiresAt이 이미 임박해 보이면 이 값으로 계산한다.
const DEFAULT_TICKET_LIFETIME_MS = 5 * 60_000;
// 이보다 짧게 남은 접수번호를 받으면 시계 차이로 본다. 그대로 쓰면 받자마자 다시 받는 일을 반복한다.
const MIN_PLAUSIBLE_LIFETIME_MS = 2 * 60_000;

const ticketSchema = z.object({
  recoveryId: z.string().trim().min(1),
  expiresAt: z.iso.datetime({ offset: true }),
});

const resultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('FOUND'),
    provider: z.enum(['GOOGLE', 'KAKAO', 'APPLE']),
    maskedEmail: z.string().nullish(),
    emailHintKind: z.enum(['EMAIL', 'APPLE_PRIVATE_RELAY', 'UNAVAILABLE']).nullish(),
  }),
  z.object({ status: z.literal('NOT_FOUND') }),
  z.object({ status: z.literal('ACTION_REQUIRED') }),
]);

const PROVIDERS = {
  GOOGLE: 'google',
  KAKAO: 'kakao',
  APPLE: 'apple',
} as const satisfies Record<string, FirebaseLoginProvider>;

/** deadline은 기기 시계 기준 만료 시각(ms)이다. 서버 시각을 그대로 비교하지 않는다. */
export type AccountRecoveryTicket = { recoveryId: string; deadline: number };

export type AccountRecoveryResult =
  | { status: 'found'; provider: FirebaseLoginProvider; maskedEmail: string | null }
  | { status: 'not-found' }
  | { status: 'action-required' };

export function mapAccountRecoveryTicket(
  value: unknown,
  receivedAt: number,
): AccountRecoveryTicket {
  const parsed = ticketSchema.safeParse(value);
  if (!parsed.success) throw new AuthProtocolError();
  const lifetime = Date.parse(parsed.data.expiresAt) - receivedAt;
  return {
    recoveryId: parsed.data.recoveryId,
    deadline:
      receivedAt + (lifetime >= MIN_PLAUSIBLE_LIFETIME_MS ? lifetime : DEFAULT_TICKET_LIFETIME_MS),
  };
}

export function mapAccountRecoveryResult(value: unknown): AccountRecoveryResult {
  const parsed = resultSchema.safeParse(value);
  if (!parsed.success) throw new AuthProtocolError();
  const result = parsed.data;
  switch (result.status) {
    case 'FOUND':
      return {
        status: 'found',
        provider: PROVIDERS[result.provider],
        // 힌트가 없다고 표시된 경우 서버가 값을 주더라도 보여 주지 않는다.
        maskedEmail:
          result.emailHintKind === 'UNAVAILABLE' ? null : result.maskedEmail?.trim() || null,
      };
    case 'NOT_FOUND':
      return { status: 'not-found' };
    case 'ACTION_REQUIRED':
      return { status: 'action-required' };
  }
}
