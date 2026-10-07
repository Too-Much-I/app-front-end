import { mapAccountRecoveryTicket } from '@/features/auth/account-recovery-mapper';
import { getIdentityApiBaseUrl } from '@/lib/api/service-base-url';
import { serviceFetch } from '@/lib/api/transport';

/** 로그인 없이 접수번호를 받는다. 회원 존재 여부를 알려 주지 않으므로 분기 없이 먼저 부른다. */
export async function prepareAccountRecovery(signal?: AbortSignal) {
  const envelope = await serviceFetch<unknown>(
    `${getIdentityApiBaseUrl()}/api/v1/auth/account-recovery/prepare`,
    { method: 'POST', signal },
  );
  return mapAccountRecoveryTicket(envelope.result, Date.now());
}
