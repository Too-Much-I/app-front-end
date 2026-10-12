import { getMessaging, getToken } from '@react-native-firebase/messaging';

import {
  deletePushDevice,
  putPushDevice,
  type LearningApiFetch,
} from '@/features/push/api/push-devices';
import {
  getOrCreatePushInstallation,
  readPushInstallation,
} from '@/features/push/push-installation';
import { readPushPermission } from '@/features/push/push-permission';
import { reportOperationalError } from '@/lib/operational-error-reporting';
import { ApiError } from '@/lib/api/transport';

/** `Retry-After`가 없을 때 기다리는 시간과 상한. 기다리는 동안 로그아웃 DELETE는 기다리지 않는다. */
const DEFAULT_RETRY_DELAY_MS = 30_000;
const MAX_RETRY_DELAY_MS = 60_000;

type PushRegistrationDependencies = {
  apiFetch: LearningApiFetch;
  /** 보내는 순간 로그인 세션이 있는지. 게스트·로그아웃 상태에서는 등록하지 않는다. */
  hasSession: () => boolean;
  getPushToken?: () => Promise<string>;
  now?: () => number;
};

/**
 * 알림 기기 등록. 앱 활성화(콜드 스타트 포함)와 로그인 뒤 PUT, 로그아웃 전 DELETE(2026-10-08 결정).
 *
 * 요청은 한 줄로 세운다. 진행 중인 요청 결과를 나눠 쓰지 않고 끝난 뒤 새로 보낸다 — 로그인 전 토큰으로 시작한
 * PUT의 결과를 로그인 PUT으로 착각하지 않게 한다. 실패는 사용자에게 보이지 않고, 503만 한 번 다시 보낸다.
 */
export function createPushRegistration(dependencies: PushRegistrationDependencies) {
  const getPushToken = dependencies.getPushToken ?? (() => getToken(getMessaging()));
  const now = dependencies.now ?? Date.now;
  let tail: Promise<void> = Promise.resolve();
  /** 아직 시작하지 않은 PUT. 활성화가 여러 번 겹쳐도 대기열에는 하나만 둔다. */
  let queuedSync: Promise<void> | null = null;
  /** 로그아웃이 시작되면 올라간다. 503 대기 중이던 재요청은 다시 보내지 않는다. */
  let signOutGeneration = 0;
  let cancelRetryWait: (() => void) | null = null;

  function enqueue(task: () => Promise<void>): Promise<void> {
    const run = tail.then(task).catch(() => undefined);
    tail = run;
    return run;
  }

  function waitForRetry(error: ApiError): Promise<void> {
    const delay = Math.min(
      error.retryAfterSeconds === undefined
        ? DEFAULT_RETRY_DELAY_MS
        : error.retryAfterSeconds * 1000,
      MAX_RETRY_DELAY_MS,
    );
    return new Promise((resolve) => {
      const timer = setTimeout(finish, delay);
      function finish() {
        clearTimeout(timer);
        cancelRetryWait = null;
        resolve();
      }
      cancelRetryWait = finish;
    });
  }

  async function sendPut(): Promise<void> {
    const installation = await getOrCreatePushInstallation();
    const pushToken = await getPushToken();
    // 권한은 보내는 순간에 읽는다. 재요청도 다시 읽는다.
    const permission = await readPushPermission();
    await putPushDevice(dependencies.apiFetch, installation, {
      pushToken,
      permission,
      permissionObservedAt: new Date(now()).toISOString(),
    });
  }

  /**
   * 사용자 흐름을 막지 않는 실패지만 조용히 계속 실패하면 알림이 가지 않는데도 모른다. 일단 보내고
   * 오류 쿼터를 보며 다음 업데이트에서 다시 정한다(2026-10-11 결정).
   */
  function reportFailure(operation: 'register' | 'unregister', error: unknown): void {
    reportOperationalError({ code: 'PUSH_REGISTRATION_FAILED', operation, cause: error });
  }

  async function register(): Promise<void> {
    if (!dependencies.hasSession()) return;
    const generation = signOutGeneration;
    try {
      await sendPut();
      return;
    } catch (error) {
      // 400·403은 자동으로 반복하지 않는다(서버 명세). 다음 활성화가 다시 보낸다.
      if (!(error instanceof ApiError) || error.status !== 503) {
        reportFailure('register', error);
        return;
      }
      await waitForRetry(error);
    }
    if (generation !== signOutGeneration || !dependencies.hasSession()) return;
    try {
      await sendPut();
    } catch (error) {
      reportFailure('register', error);
    }
  }

  /** 지금 상태로 PUT을 보낸다. 앞선 요청이 끝난 뒤 시작한다. 던지지 않는다. */
  function sync(): Promise<void> {
    queuedSync ??= enqueue(() => {
      queuedSync = null;
      return register();
    });
    return queuedSync;
  }

  /**
   * 로그아웃 전에 부른다. 진행 중인 PUT이 끝난 뒤 DELETE를 보내 늦게 끝난 PUT이 다시 연결하지 않게 한다.
   * 실패해도 던지지 않는다 — 로그아웃은 막지 않는다(2026-10-08 결정).
   */
  function unregister(): Promise<void> {
    signOutGeneration += 1;
    cancelRetryWait?.();
    return enqueue(async () => {
      try {
        const installation = await readPushInstallation();
        if (installation) await deletePushDevice(dependencies.apiFetch, installation);
      } catch (error) {
        reportFailure('unregister', error);
      }
    });
  }

  return { sync, unregister };
}
