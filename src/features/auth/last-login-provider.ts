import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createStore } from 'zustand/vanilla';

import type { FirebaseLoginProvider } from '@/features/auth/firebase-auth-types';

// 세션 레코드(`auth-session.v2`)와 따로 둔다. 세션은 refresh 만료 때 `signed-out`으로 덮이지만
// 이 값은 그 뒤 재로그인 화면에서 필요하다(결정 기록 2026-10-02 "기기 저장 위치와 시점").
const LAST_LOGIN_PROVIDER_KEY = 'last-login-provider.v1';
const LOGIN_PROVIDERS: readonly FirebaseLoginProvider[] = ['google', 'apple', 'kakao'];
// 기기 이전 백업으로 넘어가지 않게 이 기기에만 남긴다.
const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export type LastLoginProviderState =
  { status: 'unknown' } | { status: 'loaded'; provider: FirebaseLoginProvider | null };

function isLoginProvider(value: string | null): value is FirebaseLoginProvider {
  return LOGIN_PROVIDERS.some((provider) => provider === value);
}

async function readLastLoginProvider(): Promise<FirebaseLoginProvider | null> {
  if (Platform.OS === 'web') return null;
  const value = await SecureStore.getItemAsync(LAST_LOGIN_PROVIDER_KEY, STORE_OPTIONS);
  return isLoginProvider(value) ? value : null;
}

async function writeLastLoginProvider(provider: FirebaseLoginProvider): Promise<void> {
  if (Platform.OS === 'web') return;
  await SecureStore.setItemAsync(LAST_LOGIN_PROVIDER_KEY, provider, STORE_OPTIONS);
}

/**
 * 마지막으로 서버 세션을 받은 로그인 수단. 비밀이 아닌 힌트라 읽기·쓰기 실패는 "모름"으로 넘긴다.
 * 로그아웃 때는 지우지 않는다. 다른 계정으로 로그인하면 덮어쓴다.
 */
export function createLastLoginProviderStore() {
  const store = createStore<LastLoginProviderState>(() => ({ status: 'unknown' }));
  let loading: Promise<void> | null = null;

  /** 로그인 화면이 처음 보일 때 부른다. 한 번 읽은 뒤에는 메모리 값을 쓴다. */
  function load(): Promise<void> {
    if (store.getState().status === 'loaded') return Promise.resolve();
    loading ??= readLastLoginProvider()
      .catch(() => null)
      .then((provider) => {
        // 읽는 사이에 로그인이 끝나 기억한 값이 있으면 그 값이 최신이다.
        if (store.getState().status === 'unknown') store.setState({ status: 'loaded', provider });
      });
    return loading;
  }

  function remember(provider: FirebaseLoginProvider): void {
    store.setState({ status: 'loaded', provider });
    void writeLastLoginProvider(provider).catch(() => undefined);
  }

  return {
    getState: store.getState,
    getInitialState: store.getInitialState,
    subscribe: store.subscribe,
    load,
    remember,
  };
}
