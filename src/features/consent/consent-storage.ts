import AsyncStorage from "@react-native-async-storage/async-storage";

export const PRIVACY_CONSENT_VERSION = "privacy-v2";
export const TERM_CONSENT_VERSION = "term-v1";
export const CONSENT_VERSION = "1";

const STORAGE_KEY = "consent-record";
const LEGACY_PRIVACY_CONSENT_VERSION = "privacy-v1";
const LEGACY_TERM_CONSENT_VERSION = "term-v1";

export type ConsentItemRecord = {
  consented: true;
  version: string;
  agreedAt: string;
};

export type ConsentRecordV2 = {
  schemaVersion: 2;
  privacy: ConsentItemRecord;
  term: ConsentItemRecord;
};

type LegacyConsentRecord = {
  version: string;
  agreedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isConsentItem(value: unknown): value is ConsentItemRecord {
  return (
    isRecord(value) &&
    value.consented === true &&
    typeof value.version === "string" &&
    isValidIsoDate(value.agreedAt)
  );
}

function isConsentRecordV2(value: unknown): value is ConsentRecordV2 {
  return (
    isRecord(value) &&
    value.schemaVersion === 2 &&
    isConsentItem(value.privacy) &&
    isConsentItem(value.term)
  );
}

function isLegacyConsentRecord(value: unknown): value is LegacyConsentRecord {
  return (
    isRecord(value) &&
    typeof value.version === "string" &&
    isValidIsoDate(value.agreedAt)
  );
}

export function createConsentRecord(agreedAt: string = new Date().toISOString()): ConsentRecordV2 {
  return {
    schemaVersion: 2,
    privacy: { consented: true, version: PRIVACY_CONSENT_VERSION, agreedAt },
    term: { consented: true, version: TERM_CONSENT_VERSION, agreedAt },
  };
}

export function isCurrentConsent(record: ConsentRecordV2): boolean {
  return (
    record.privacy.version === PRIVACY_CONSENT_VERSION &&
    record.term.version === TERM_CONSENT_VERSION
  );
}

export async function persistConsent(record: ConsentRecordV2): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

export async function getStoredConsent(): Promise<ConsentRecordV2 | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  if (isConsentRecordV2(parsed)) {
    return parsed;
  }

  if (isLegacyConsentRecord(parsed) && parsed.version === CONSENT_VERSION) {
    const migrated: ConsentRecordV2 = {
      schemaVersion: 2,
      privacy: {
        consented: true,
        version: LEGACY_PRIVACY_CONSENT_VERSION,
        agreedAt: parsed.agreedAt,
      },
      term: {
        consented: true,
        version: LEGACY_TERM_CONSENT_VERSION,
        agreedAt: parsed.agreedAt,
      },
    };
    await persistConsent(migrated);
    return migrated;
  }

  return null;
}
