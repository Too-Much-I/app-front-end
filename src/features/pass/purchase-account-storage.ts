import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 결제용 ID 저장. AsyncStorage에 평문으로 둔다 — 비밀이 아니고, iOS 키체인(SecureStore)은 앱을 지워도
 * 남아 다음 설치가 이전 회원의 값을 쓸 수 있다(2026-10-13 결정).
 */
const PURCHASE_ACCOUNT_KEY = 'purchase-account-ref.v1';

/** 읽지 못하면 없는 것으로 본다. 호출자가 서버에서 다시 받아 덮어쓴다. */
export async function readStoredPurchaseAccountRef(): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(PURCHASE_ACCOUNT_KEY);
    return value ? value : null;
  } catch {
    return null;
  }
}

export function storePurchaseAccountRef(value: string): Promise<void> {
  return AsyncStorage.setItem(PURCHASE_ACCOUNT_KEY, value);
}

export function clearStoredPurchaseAccountRef(): Promise<void> {
  return AsyncStorage.removeItem(PURCHASE_ACCOUNT_KEY);
}
