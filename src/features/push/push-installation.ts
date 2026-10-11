import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * 알림 기기 등록용 설치 정보. 인증용 installationId(`features/auth/installation-id.ts`)와 따로 둔다 —
 * 그 값은 탈퇴 때 지워지지만 이 값은 설치 하나가 끝날 때까지 유지한다(2026-10-08 결정).
 * ID와 secret은 한 설치 주기 동안 묶여 있어 한 항목에 같이 저장한다.
 */
export type PushInstallation = { installationId: string; secret: string };

const INSTALLATION_KEY = 'push-installation.v1';
/** 이 설치에서 알림 설치 정보를 만든 적이 있다는 표시. iOS 키체인은 재설치 뒤에도 남아 첫 실행을 따로 안다. */
const CREATED_MARKER_KEY = 'push-installation.created.v1';
// 키체인이 iCloud·암호화 백업으로 새 폰에 따라가 두 폰이 같은 ID를 쓰지 않게 한다. 잠긴 상태에서는 읽을 일이 없다.
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;

let cached: PushInstallation | null = null;
let pending: Promise<PushInstallation> | null = null;

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function parseInstallation(value: string | null): PushInstallation | null {
  if (value === null) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'installationId' in parsed &&
      'secret' in parsed &&
      typeof parsed.installationId === 'string' &&
      typeof parsed.secret === 'string' &&
      UUID_V4_PATTERN.test(parsed.installationId) &&
      SECRET_PATTERN.test(parsed.secret)
    ) {
      return { installationId: parsed.installationId, secret: parsed.secret };
    }
  } catch {
    // 형식이 깨진 값은 없는 것으로 보고 새로 만든다.
  }
  return null;
}

/** 실패하면 한 번 더 읽는다. 두 번 다 실패하면 null — 호출자가 새로 만들어 덮어쓴다(2026-10-08 결정). */
async function readStored(): Promise<PushInstallation | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return parseInstallation(
        await SecureStore.getItemAsync(INSTALLATION_KEY, SECURE_STORE_OPTIONS),
      );
    } catch {
      // Android 기기 이전으로 파일만 옮겨 와 Keystore 키가 없으면 계속 실패한다.
    }
  }
  return null;
}

async function hasCreatedMarker(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CREATED_MARKER_KEY)) !== null;
  } catch {
    // 표시를 못 읽었다고 매번 새로 만들면 서버 등록이 실행마다 바뀐다. 저장된 값을 먼저 믿는다.
    return true;
  }
}

async function createAndStore(): Promise<PushInstallation> {
  const installation: PushInstallation = {
    installationId: Crypto.randomUUID().toLowerCase(),
    secret: toBase64Url(Crypto.getRandomBytes(32)),
  };
  // 저장에 실패하면 이번 등록을 보내지 않는다. 기억하지 못한 secret으로 등록하면 다음 실행에서 409가 난다.
  await SecureStore.setItemAsync(
    INSTALLATION_KEY,
    JSON.stringify(installation),
    SECURE_STORE_OPTIONS,
  );
  await AsyncStorage.setItem(CREATED_MARKER_KEY, '1').catch(() => undefined);
  return installation;
}

/**
 * 이 설치의 알림 설치 정보를 돌려준다. 이 설치에서 처음이거나 저장값을 읽지 못하면 새로 만들어 덮어쓴다.
 * 동시에 불려도 한 번만 만든다.
 */
export function getOrCreatePushInstallation(): Promise<PushInstallation> {
  if (cached) return Promise.resolve(cached);
  pending ??= (async () => {
    const stored = (await hasCreatedMarker()) ? await readStored() : null;
    cached = stored ?? (await createAndStore());
    return cached;
  })().finally(() => {
    pending = null;
  });
  return pending;
}

/** 만들지 않고 읽기만 한다. 등록한 적 없는 설치는 지울 것도 없다(로그아웃 DELETE). */
export async function readPushInstallation(): Promise<PushInstallation | null> {
  if (cached) return cached;
  if (pending) return pending.catch(() => null);
  if (!(await hasCreatedMarker())) return null;
  return readStored();
}
