import type { AuthSession } from '@/features/auth/types';

export type AuthRecoveryReason =
  | 'connection'
  | 'server'
  | 'storage'
  | 'session-format'
  | 'response-format'
  | 'refresh-uncertain'
  | 'unexpected';

export type AuthRecoveryAction = 'retry' | 'get-help';

export type AuthSessionRestoreResult =
  | { kind: 'ready'; accountType: 'MEMBER' | 'GUEST' }
  /** notice: 서버가 이 세션의 계정을 비활성으로 거절해 세션을 지웠다. 사용자에게 알린 뒤 로그인으로 보낸다. */
  | { kind: 'login-required'; notice?: 'account-inactive' }
  | {
      kind: 'recovery-required';
      reason: AuthRecoveryReason;
      action: AuthRecoveryAction;
    };

/** 한 레코드 안에서 토큰과 그 토큰의 재발급 요청 ID를 함께 저장한다. */
export type AuthRestorationRecord = { schemaVersion: 2 } & (
  | { phase: 'active'; session: AuthSession }
  | {
      phase: 'refresh-pending';
      session: AuthSession;
      requestId: string;
      replaySupported: boolean;
    }
  | { phase: 'signed-out' }
);

export class SessionRestorationError extends Error {
  constructor(public readonly reason: AuthRecoveryReason) {
    super('인증 복원 작업을 완료하지 못했습니다.');
    this.name = 'SessionRestorationError';
  }
}

/** API 호출은 복구 결과를 전달하고, 토큰·서버 응답 원문은 오류에 담지 않는다. */
export class SessionRequestError extends Error {
  constructor(public readonly result: Exclude<AuthSessionRestoreResult, { kind: 'ready' }>) {
    super('요청에 사용할 인증 세션이 준비되지 않았습니다.');
    this.name = 'SessionRequestError';
  }
}
