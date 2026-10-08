import * as Application from 'expo-application';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import type { AppPlatform } from '@/features/app-version/api/app-version-policy';
import {
  getAppUpdateRequirement,
  type AppUpdateRequirement,
} from '@/features/app-version/app-update-requirement';

/**
 * `checking.noticeVisible`: 연결 실패 안내를 띄운 채 다시 확인하는 중이다. 안내가 깜빡이지 않게 유지한다.
 * `required`는 끝 상태다. 한 번 뜬 강제 화면은 이후 확인이 실패해도 유지한다(2026-10-08 결정).
 */
export type AppUpdateCheckState =
  | { status: 'idle' }
  | { status: 'checking'; noticeVisible: boolean }
  | { status: 'connection-failed' }
  | { status: 'required' };

const STATE_AFTER_CHECK = {
  required: { status: 'required' },
  'connection-failed': { status: 'connection-failed' },
  'not-required': { status: 'idle' },
  unknown: { status: 'idle' },
} as const satisfies Record<AppUpdateRequirement, AppUpdateCheckState>;

function resolveAppPlatform(): AppPlatform | null {
  return Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : null;
}

/** 앱 시작과 백그라운드 복귀 때 최소 버전을 확인한다. 웹에서는 확인하지 않는다. */
export function useAppUpdateCheck(): {
  state: AppUpdateCheckState;
  platform: AppPlatform | null;
  retry: () => void;
  dismiss: () => void;
} {
  const [platform] = useState(resolveAppPlatform);
  const [state, setState] = useState<AppUpdateCheckState>({ status: 'idle' });
  // 앱 상태 구독 콜백이 최신 상태를 읽도록 렌더와 별도로 들고 있는다.
  const stateRef = useRef(state);

  const transition = useCallback((next: AppUpdateCheckState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const check = useCallback(async () => {
    const current = stateRef.current;
    if (platform === null || current.status === 'required' || current.status === 'checking') {
      return;
    }
    transition({ status: 'checking', noticeVisible: current.status === 'connection-failed' });
    const requirement = await getAppUpdateRequirement(
      platform,
      Application.nativeApplicationVersion,
    );
    transition(STATE_AFTER_CHECK[requirement]);
  }, [platform, transition]);

  useEffect(() => {
    void check();
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', (next) => {
      // 알림 센터를 내리는 것 같은 `inactive` 왕복에는 반응하지 않는다.
      const returnedToForeground = previous === 'background' && next === 'active';
      previous = next;
      if (returnedToForeground) void check();
    });
    return () => subscription.remove();
  }, [check]);

  const retry = useCallback(() => {
    void check();
  }, [check]);

  const dismiss = useCallback(() => {
    if (stateRef.current.status === 'connection-failed') transition({ status: 'idle' });
  }, [transition]);

  return { state, platform, retry, dismiss };
}
