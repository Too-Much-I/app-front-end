import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * 필수 동의 항목(개인정보 수집·이용, 서비스 이용약관)을 하나로 묶은 버전.
 * 항목별이 아니라 이 버전 하나로 "전부 동의했다"는 사실만 남긴다.
 * 약관 내용이 바뀌어 재동의가 필요해지면 이 값을 올린다.
 */
export const CONSENT_VERSION = "1";

const STORAGE_KEY = "consent-record";

export type ConsentRecord = {
  version: string;
  agreedAt: string;
};

function isConsentRecord(value: unknown): value is ConsentRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    "agreedAt" in value &&
    typeof value.version === "string" &&
    typeof value.agreedAt === "string" &&
    Number.isFinite(Date.parse(value.agreedAt))
  );
}

export async function getStoredConsent(): Promise<ConsentRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    return isConsentRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveConsent(): Promise<void> {
  const record: ConsentRecord = {
    version: CONSENT_VERSION,
    agreedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}
