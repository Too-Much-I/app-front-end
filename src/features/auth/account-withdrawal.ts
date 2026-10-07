import type { withdrawAccount } from '@/features/auth/api/withdraw-account';
import { classifyAuthRecovery } from '@/features/auth/auth-recovery';
import { classifyFirebaseAuthFailure } from '@/features/auth/firebase-auth-errors';
import type { FirebaseAuthSdk } from '@/features/auth/firebase-auth-types';
import { SessionRequestError } from '@/features/auth/session-restoration-types';
import type { AuthSession, RequestAuthSnapshot } from '@/features/auth/types';
import { ApiError } from '@/lib/api/transport';

/** 문구는 2026-10-07 사용자 결정. 오류를 공용으로 묶지 않고 탈퇴 흐름 안에서 보여준다. */
export const ACCOUNT_WITHDRAWAL_MESSAGES = {
  connection: '네트워크 오류가 발생했어요. 잠시 후 다시 시도해 주세요.',
  failed: '탈퇴하지 못했어요. 잠시 후 다시 시도해 주세요.',
} as const;

export type AccountWithdrawalResult =
  | { kind: 'withdrawn' }
  /** Apple 창을 닫았다. 탈퇴를 멈추고 설정에 머문다. */
  | { kind: 'cancelled' }
  /** 탈퇴 전에 세션이 끝났다(다른 기기에서 탈퇴 등). 안내는 세션 구독자가 이미 띄운다. */
  | { kind: 'session-ended' }
  | { kind: 'failed'; message: string };

interface AccountWithdrawalDependencies {
  prepareTokenPair: () => Promise<{ session: AuthSession; generation: number }>;
  recoverUnauthorized: (usedGeneration: number, code?: string) => Promise<RequestAuthSnapshot>;
  firebase: Pick<
    FirebaseAuthSdk,
    'getCurrentIdToken' | 'getLinkedProviderIds' | 'revokeAppleSignIn'
  >;
  withdraw: typeof withdrawAccount;
}

const APPLE_PROVIDER_ID = 'apple.com';

function failed(reason: 'connection' | 'failed'): AccountWithdrawalResult {
  return { kind: 'failed', message: ACCOUNT_WITHDRAWAL_MESSAGES[reason] };
}

/** 200과 401 ACCOUNT_WITHDRAWN은 둘 다 "이 계정은 탈퇴됐다"이므로 같은 성공이다. */
function isWithdrawnResponse(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401 && error.code === 'ACCOUNT_WITHDRAWN';
}

/**
 * 회원 탈퇴 한 번. 순서: 세션 토큰 쌍 → 지금 Firebase 토큰 → (Apple 연결이면) Apple revoke → `/users/withdraw`.
 *
 * - 재인증하지 않는다. 서버와 합의해 지금 토큰을 그대로 보낸다. Apple만 revoke에 새 authorization code가
 *   필요해 Apple 창을 한 번 띄운다. 탈퇴 뒤에는 Firebase 사용자가 없어 revoke할 수 없으므로 먼저 한다.
 * - Firebase 토큰을 못 받으면 재발급으로 계정이 이미 탈퇴됐는지 확인한다(다른 기기에서 탈퇴하면 Firebase
 *   사용자가 지워진다). 매번 재발급하지 않는 것은 회전·응답 유실 복구를 드문 경로에만 두기 위해서다.
 * - 401은 가이드 7절대로 한 번만 고쳐서 다시 보낸다.
 *
 * 세션 정리와 안내는 호출한 쪽이 한다.
 */
export async function runAccountWithdrawal(
  dependencies: AccountWithdrawalDependencies,
): Promise<AccountWithdrawalResult> {
  try {
    let { session, generation } = await dependencies.prepareTokenPair();
    let firebaseIdToken: string;
    try {
      firebaseIdToken = await dependencies.firebase.getCurrentIdToken(false);
    } catch (error) {
      if (classifyFirebaseAuthFailure(error).reason === 'connection') return failed('connection');
      // 재발급이 ACCOUNT_WITHDRAWN이면 세션 담당이 세션을 지우고 SessionRequestError로 끝난다.
      // 계정이 살아 있으면 Firebase에만 없는 계정이라 탈퇴할 수 없다(드문 경우라 실패로 둔다).
      await dependencies.recoverUnauthorized(generation);
      return failed('failed');
    }

    if (dependencies.firebase.getLinkedProviderIds().includes(APPLE_PROVIDER_ID)) {
      const revoke = await dependencies.firebase.revokeAppleSignIn();
      if (revoke === 'cancelled') return { kind: 'cancelled' };
    }

    try {
      await dependencies.withdraw({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        firebaseIdToken,
      });
      return { kind: 'withdrawn' };
    } catch (error) {
      if (isWithdrawnResponse(error)) return { kind: 'withdrawn' };
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      if (error.code === 'INVALID_FIREBASE_ID_TOKEN') {
        firebaseIdToken = await dependencies.firebase.getCurrentIdToken(true);
      } else {
        await dependencies.recoverUnauthorized(generation, error.code);
        ({ session, generation } = await dependencies.prepareTokenPair());
      }
    }

    try {
      await dependencies.withdraw({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        firebaseIdToken,
      });
    } catch (error) {
      if (!isWithdrawnResponse(error)) throw error;
    }
    return { kind: 'withdrawn' };
  } catch (error) {
    if (error instanceof SessionRequestError) {
      if (error.result.kind === 'login-required') return { kind: 'session-ended' };
      return failed(
        error.result.kind === 'recovery-required' && error.result.reason === 'connection'
          ? 'connection'
          : 'failed',
      );
    }
    return failed(classifyAuthRecovery(error).reason === 'connection' ? 'connection' : 'failed');
  }
}
