import { z } from 'zod';

import { getIdentityApiBaseUrl } from '@/lib/api/service-base-url';
import { serviceFetch } from '@/lib/api/transport';

export type AppPlatform = 'ios' | 'android';

/** `null`: 서버가 최소 버전을 아직 주지 않는다. 강제할 근거가 없다는 뜻이다. */
export type AppVersionPolicy = { minimumVersion: string | null };

/**
 * `minimumVersion`은 2026-10-08 서버에 요청한 필드로 아직 배포 전이다. 배포 전 응답(`latestVersion`만 있음)도
 * 통과로 읽혀야 하므로 없거나 null인 값을 허용한다. `latestVersion`은 권장 업데이트를 띄우지 않기로 해 읽지 않는다.
 */
const rawAppVersionPolicySchema = z.object({
  minimumVersion: z.string().trim().min(1).nullish(),
});

/** 토큰 없이 부른다. 400·503(`APP_VERSION_UNAVAILABLE`)은 `ApiError`로 던져진다. */
export async function getAppVersionPolicy(
  platform: AppPlatform,
  signal?: AbortSignal,
): Promise<AppVersionPolicy> {
  const envelope = await serviceFetch<unknown>(
    `${getIdentityApiBaseUrl()}/api/v1/app/version?platform=${platform}`,
    { signal },
  );
  const parsed = rawAppVersionPolicySchema.safeParse(envelope.result);
  return { minimumVersion: parsed.success ? (parsed.data.minimumVersion ?? null) : null };
}
