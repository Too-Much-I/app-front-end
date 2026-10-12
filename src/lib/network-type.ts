import { addNetworkStateListener, getNetworkStateAsync, NetworkStateType } from 'expo-network';

/**
 * 실패 순간의 네트워크 종류. 실패 breadcrumb은 catch에서 동기로 남겨야 이벤트보다 먼저 쌓이므로
 * 그때 묻지 않고 마지막으로 받은 값을 들고 있는다.
 */
export type NetworkKind = 'wifi' | 'cellular' | 'ethernet' | 'none' | 'other' | 'unknown';

let currentNetworkKind: NetworkKind = 'unknown';
let started = false;

function toNetworkKind(type: NetworkStateType | undefined): NetworkKind {
  switch (type) {
    case NetworkStateType.WIFI:
      return 'wifi';
    case NetworkStateType.CELLULAR:
      return 'cellular';
    case NetworkStateType.ETHERNET:
      return 'ethernet';
    case NetworkStateType.NONE:
      return 'none';
    case NetworkStateType.UNKNOWN:
    case undefined:
      return 'unknown';
    default:
      return 'other';
  }
}

/** 앱 시작 때 한 번 부른다. 관측용이라 실패해도 'unknown'으로 남기고 넘어간다. */
export function startNetworkKindTracking(): void {
  if (started) return;
  started = true;

  try {
    addNetworkStateListener((state) => {
      currentNetworkKind = toNetworkKind(state.type);
    });
    void getNetworkStateAsync()
      .then((state) => {
        currentNetworkKind = toNetworkKind(state.type);
      })
      .catch(() => undefined);
  } catch {
    // 네이티브 모듈이 없는 빌드(Expo Go 등)에서도 앱 흐름은 그대로 간다.
  }
}

export function getNetworkKind(): NetworkKind {
  return currentNetworkKind;
}
