import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { isAuthSession, type AuthSession } from "@/features/auth/types";

const AUTH_SESSION_KEY = "auth-session.v1";

export class AuthStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthStorageError";
  }
}

function assertNativeStorage(): void {
  if (Platform.OS === "web") {
    throw new AuthStorageError("이 플랫폼에서는 보안 인증 저장소를 사용할 수 없습니다.");
  }
}

export async function readAuthSession(): Promise<AuthSession | null> {
  assertNativeStorage();
  let raw: string | null;
  try {
    raw = await SecureStore.getItemAsync(AUTH_SESSION_KEY);
  } catch {
    throw new AuthStorageError("저장된 인증 정보를 읽지 못했습니다.");
  }

  if (raw === null) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(raw);
    return isAuthSession(value) ? value : null;
  } catch {
    return null;
  }
}

export async function writeAuthSession(session: AuthSession): Promise<void> {
  assertNativeStorage();
  try {
    await SecureStore.setItemAsync(AUTH_SESSION_KEY, JSON.stringify(session));
  } catch {
    throw new AuthStorageError("인증 정보를 저장하지 못했습니다.");
  }
}

export async function clearAuthSession(): Promise<void> {
  assertNativeStorage();
  try {
    await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
  } catch {
    throw new AuthStorageError("인증 정보를 삭제하지 못했습니다.");
  }
}
