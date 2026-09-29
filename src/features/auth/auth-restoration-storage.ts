import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import {
  SessionRestorationError,
  type AuthRestorationRecord,
} from "@/features/auth/session-restoration-types";
import { isAuthSession } from "@/features/auth/types";

const RESTORATION_KEY = "auth-session.v2";
const LEGACY_SESSION_KEY = "auth-session.v1";

function assertRestorationStorage(): void {
  if (Platform.OS === "web") throw new SessionRestorationError("unexpected");
}

function decodeStoredValue(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new SessionRestorationError("session-format");
  }
}

function parseRestorationRecord(value: unknown): AuthRestorationRecord {
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== 2 ||
    !("phase" in value)
  ) {
    throw new SessionRestorationError("session-format");
  }
  if (value.phase === "signed-out")
    return { schemaVersion: 2, phase: "signed-out" };
  if (!("session" in value) || !isAuthSession(value.session))
    throw new SessionRestorationError("session-format");
  if (value.phase === "active")
    return { schemaVersion: 2, phase: "active", session: value.session };
  if (
    value.phase === "refresh-pending" &&
    "requestId" in value &&
    typeof value.requestId === "string" &&
    value.requestId.trim() &&
    "replaySupported" in value &&
    typeof value.replaySupported === "boolean"
  ) {
    return {
      schemaVersion: 2,
      phase: "refresh-pending",
      session: value.session,
      requestId: value.requestId,
      replaySupported: value.replaySupported,
    };
  }
  throw new SessionRestorationError("session-format");
}

export async function readAuthRestorationRecord(): Promise<AuthRestorationRecord | null> {
  assertRestorationStorage();
  let current: string | null;
  let legacy: string | null = null;
  try {
    current = await SecureStore.getItemAsync(RESTORATION_KEY);
    if (current === null)
      legacy = await SecureStore.getItemAsync(LEGACY_SESSION_KEY);
  } catch {
    throw new SessionRestorationError("storage");
  }
  // v2가 손상돼도 v1으로 되돌아가지 않는다. 오래된 refresh token 재사용을 막는다.
  if (current !== null)
    return parseRestorationRecord(decodeStoredValue(current));
  if (legacy === null) return null;
  const session = decodeStoredValue(legacy);
  if (!isAuthSession(session))
    throw new SessionRestorationError("session-format");
  return { schemaVersion: 2, phase: "active", session };
}

export async function writeAuthRestorationRecord(
  record: AuthRestorationRecord,
): Promise<void> {
  assertRestorationStorage();
  try {
    await SecureStore.setItemAsync(RESTORATION_KEY, JSON.stringify(record));
  } catch {
    throw new SessionRestorationError("storage");
  }
}

/** 먼저 v2에 signed-out을 저장한 뒤 호출한다. 삭제 실패에도 v1이 되살아나지 않는다. */
export async function removeLegacyAuthSession(): Promise<void> {
  assertRestorationStorage();
  try {
    await SecureStore.deleteItemAsync(LEGACY_SESSION_KEY);
  } catch {
    throw new SessionRestorationError("storage");
  }
}
