import { mapAccountRecoveryResult } from '@/features/auth/account-recovery-mapper';
import { getIdentityApiBaseUrl } from '@/lib/api/service-base-url';
import { serviceFetch } from '@/lib/api/transport';

/**
 * 접수 뒤 전화 로그인으로 받은 Firebase ID Token(`sign_in_provider: phone`)으로 가입 수단 힌트를 받는다.
 * 로그인·병합은 하지 않는다. 같은 접수번호·토큰으로 다시 보내도 된다(응답 유실 재시도).
 */
export async function lookupAccountRecovery(
  recoveryId: string,
  firebaseIdToken: string,
  signal?: AbortSignal,
) {
  const envelope = await serviceFetch<unknown>(
    `${getIdentityApiBaseUrl()}/api/v1/auth/account-recovery/lookup`,
    { method: 'POST', body: JSON.stringify({ recoveryId, firebaseIdToken }), signal },
  );
  return mapAccountRecoveryResult(envelope.result);
}
