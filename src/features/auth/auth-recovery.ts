import {
  SessionRestorationError,
  type AuthRecoveryReason,
  type AuthSessionRestoreResult,
} from '@/features/auth/session-restoration-types';
import { AuthProtocolError } from '@/features/auth/types';
import { ApiError, TransportConnectionError } from '@/lib/api/transport';

export function classifyAuthRecovery(
  error: unknown,
): Extract<AuthSessionRestoreResult, { kind: 'recovery-required' }> {
  let reason: AuthRecoveryReason;
  if (error instanceof SessionRestorationError) reason = error.reason;
  else if (error instanceof TransportConnectionError) reason = 'connection';
  else if (
    error instanceof ApiError &&
    (error.status >= 500 || error.status === 429 || error.status === 408)
  )
    reason = 'server';
  else if (error instanceof AuthProtocolError) reason = 'response-format';
  else reason = 'unexpected';

  const retryable = reason === 'connection' || reason === 'server' || reason === 'storage';
  return {
    kind: 'recovery-required',
    reason,
    action: retryable ? 'retry' : 'get-help',
  };
}

export const AUTH_RECOVERY_MESSAGES = {
  connection: '연결이 원활하지 않아요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
  server: '서비스 연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.',
  storage:
    '로그인 정보를 확인하지 못했어요. 다시 시도해 주세요. 문제가 계속되면 도움을 요청해 주세요.',
  'session-format': '저장된 로그인 정보를 복원하지 못했어요. 도움을 요청해 주세요.',
  'response-format': '로그인 정보를 확인하는 중 문제가 발생했어요. 도움을 요청해 주세요.',
  'refresh-uncertain':
    '로그인 갱신 결과를 확인하지 못했어요. 기존 정보를 보호하기 위해 도움을 요청해 주세요.',
  unexpected: '로그인을 준비하는 중 문제가 발생했어요. 도움을 요청해 주세요.',
} satisfies Record<AuthRecoveryReason, string>;
