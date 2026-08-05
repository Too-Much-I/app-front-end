import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const INSTALLATION_ID_KEY = "installation-id:v1";
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let pendingInstallation: Promise<string> | null = null;

export class InstallationIdError extends Error {
  constructor(
    message: string,
    public readonly pendingInstallationId?: string,
  ) {
    super(message);
    this.name = "InstallationIdError";
  }
}

export function isInstallationId(value: string): boolean {
  return UUID_V4_PATTERN.test(value);
}

async function readInstallationId(): Promise<string | null> {
  if (Platform.OS === "web") {
    throw new InstallationIdError("이 플랫폼에서는 설치 인증 정보를 사용할 수 없습니다.");
  }

  let value: string | null;
  try {
    value = await SecureStore.getItemAsync(INSTALLATION_ID_KEY);
  } catch {
    throw new InstallationIdError("설치 정보를 읽지 못했습니다.");
  }

  if (value !== null && !isInstallationId(value)) {
    throw new InstallationIdError("저장된 설치 정보를 복구할 수 없습니다.");
  }
  return value;
}

export async function persistInstallationId(installationId: string): Promise<string> {
  if (!isInstallationId(installationId)) {
    throw new InstallationIdError("설치 정보 형식이 올바르지 않습니다.");
  }
  try {
    await SecureStore.setItemAsync(INSTALLATION_ID_KEY, installationId);
  } catch {
    throw new InstallationIdError("설치 정보를 저장하지 못했습니다.");
  }
  return installationId;
}

export async function getOrCreateInstallationId(): Promise<string> {
  if (pendingInstallation) {
    return pendingInstallation;
  }

  pendingInstallation = (async () => {
    const stored = await readInstallationId();
    if (stored) {
      return stored;
    }
    const installationId = Crypto.randomUUID();
    try {
      return await persistInstallationId(installationId);
    } catch {
      throw new InstallationIdError("설치 정보를 저장하지 못했습니다.", installationId);
    }
  })();

  try {
    return await pendingInstallation;
  } finally {
    pendingInstallation = null;
  }
}
