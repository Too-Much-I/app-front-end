import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * 선택 동의 항목 — 채점 품질 및 안전성 개선을 위한 답변 검토.
 *
 * 필수 동의(`consent-storage.ts`)와 저장소를 나눈 이유가 두 가지 있다.
 *
 * 1. 필수 동의 레코드는 서버가 진실의 원천이다. `auth-controller`의
 *    `createSyncedConsentRecord`와 `createUpdatedConsentRecord`가 서버 응답만 보고
 *    레코드를 통째로 다시 만들기 때문에, 로컬 전용 필드를 그 안에 끼워 넣으면 서버
 *    동의 확인이 돌 때마다 조용히 지워진다.
 * 2. 선택 동의는 생명주기가 다르다. 언제든 철회할 수 있어야 하고(개인정보처리방침
 *    제7조), 동의하지 않아도 서비스 이용이 막히지 않는다.
 *
 * 현재 백엔드 동의 API(`/api/v1/users/me/consents`)는 privacy/terms 두 항목만
 * 받으므로 이 값은 기기에만 남는다. 서버 필드가 추가되면 이 모듈이 읽어 주는 값을
 * 인증 요청에 실어 보내면 된다.
 */
export const QUALITY_REVIEW_CONSENT_VERSION = "quality-review-v1";

const STORAGE_KEY = "optional-consent-record";

export type OptionalConsentRecord = {
  schemaVersion: 1;
  qualityReview: {
    consented: boolean;
    version: string;
    decidedAt: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isOptionalConsentRecord(value: unknown): value is OptionalConsentRecord {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    return false;
  }
  const item = value.qualityReview;
  return (
    isRecord(item) &&
    typeof item.consented === "boolean" &&
    typeof item.version === "string" &&
    isValidIsoDate(item.decidedAt)
  );
}

export function createOptionalConsentRecord(
  consented: boolean,
  decidedAt: string = new Date().toISOString(),
): OptionalConsentRecord {
  return {
    schemaVersion: 1,
    qualityReview: {
      consented,
      version: QUALITY_REVIEW_CONSENT_VERSION,
      decidedAt,
    },
  };
}

export async function persistOptionalConsent(record: OptionalConsentRecord): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

/**
 * 저장된 선택 동의를 읽는다. 아직 묻지 않았거나 값이 깨졌으면 `null`을 돌려준다.
 *
 * `null`과 "동의하지 않음"은 다르다. 전자는 아직 선택하지 않은 상태라 나중에 다시
 * 물어볼 수 있고, 후자는 이용자가 명시적으로 거부한 상태다.
 */
export async function getStoredOptionalConsent(): Promise<OptionalConsentRecord | null> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  return isOptionalConsentRecord(parsed) ? parsed : null;
}

/** 선택 동의 버전이 올라갔는지 확인한다. 문구가 바뀌면 다시 물어봐야 한다. */
export function isCurrentOptionalConsent(record: OptionalConsentRecord): boolean {
  return record.qualityReview.version === QUALITY_REVIEW_CONSENT_VERSION;
}
