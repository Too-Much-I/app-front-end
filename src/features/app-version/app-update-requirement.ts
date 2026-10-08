import {
  getAppVersionPolicy,
  type AppPlatform,
} from '@/features/app-version/api/app-version-policy';
import { decideAppUpdate, type AppUpdateDecision } from '@/features/app-version/app-version';
import { TransportConnectionError } from '@/lib/api/transport';

/** `connection-failed`만 사용자에게 알린다. 서버 오류(400·503·5xx)와 읽을 수 없는 응답은 `unknown`으로 통과한다. */
export type AppUpdateRequirement = AppUpdateDecision | 'connection-failed';

/** 처음 1번 + 재시도 2번(2026-10-08 결정). 잠깐 끊긴 연결로 모달을 띄우지 않으려는 것이다. */
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1_000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function getAppUpdateRequirement(
  platform: AppPlatform,
  installedVersion: string | null,
): Promise<AppUpdateRequirement> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const { minimumVersion } = await getAppVersionPolicy(platform);
      return decideAppUpdate(installedVersion, minimumVersion);
    } catch (error) {
      // 서버가 답한 실패는 다시 물어도 정책이 바뀌지 않는다. 다음 활성화 때 다시 확인한다.
      if (!(error instanceof TransportConnectionError)) return 'unknown';
      if (attempt >= MAX_ATTEMPTS) return 'connection-failed';
      await wait(RETRY_DELAY_MS);
    }
  }
}
