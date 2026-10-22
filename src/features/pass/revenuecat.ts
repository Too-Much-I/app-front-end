import { Platform } from 'react-native';
import Purchases, {
  PURCHASES_ERROR_CODE,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

/** 공개 SDK 키. 앱 번들에 들어가는 값이다(2026-10-13 서버 답). */
const API_KEY_BY_PLATFORM: Partial<Record<typeof Platform.OS, string>> = {
  ios: 'appl_eXvEgUFsXPXTHvwqPquqRFDQfYO',
  android: 'goog_rzNOZCTPqKollmgNmEClbnorMZw',
};

/** 이용권 상품을 묶은 Offering. 소모성 상품이고 Entitlement는 쓰지 않는다 — 이용권은 Billing 서버가 관리한다. */
const PASS_OFFERING_ID = 'premium';

let configured = false;
let currentPurchaseAccount: string | null = null;

/** 결제용 ID를 받은 뒤에만 초기화한다. 익명 고객을 먼저 만들지 않는다. */
export async function logInStoreCustomer(purchaseAccountRef: string): Promise<void> {
  currentPurchaseAccount = null;
  if (!configured) {
    const apiKey = API_KEY_BY_PLATFORM[Platform.OS];
    if (!apiKey) throw new Error(`이 플랫폼은 스토어 결제를 지원하지 않는다: ${Platform.OS}`);
    Purchases.configure({ apiKey, appUserID: purchaseAccountRef });
    configured = true;
  } else {
    await Purchases.logIn(purchaseAccountRef);
  }
  if ((await Purchases.getAppUserID()) !== purchaseAccountRef) {
    throw new Error('스토어 결제 계정이 일치하지 않습니다.');
  }
  currentPurchaseAccount = purchaseAccountRef;
}

/** 로컬 구매 접근을 닫는다. SDK logOut으로 새 익명 고객을 만들지 않는다. 다음 계정은 logIn으로 전환한다. */
export async function logOutStoreCustomer(): Promise<void> {
  currentPurchaseAccount = null;
}

async function requireStoreCustomer(expected: string): Promise<void> {
  if (
    !configured ||
    currentPurchaseAccount !== expected ||
    (await Purchases.getAppUserID()) !== expected ||
    currentPurchaseAccount !== expected
  ) {
    throw new Error('스토어 결제 계정을 먼저 확인해야 합니다.');
  }
}

/** Offering이 없으면 null. 스토어에 상품이 비활성이면 패키지가 비어서 온다. */
export async function loadPassOffering(
  purchaseAccountRef: string,
): Promise<PurchasesOffering | null> {
  await requireStoreCustomer(purchaseAccountRef);
  const offerings = await Purchases.getOfferings();
  return offerings.all[PASS_OFFERING_ID] ?? null;
}

/** `transactionId`는 sync에 보낼 스토어 거래 ID다. 서버가 실거래로 이 값이 맞는지 확정한다(Billing 명세). */
export type StorePurchaseResult =
  { kind: 'purchased'; transactionId: string } | { kind: 'cancelled' };

/** 사용자가 결제 창을 닫은 것은 실패가 아니다. 나머지 오류는 그대로 던진다. */
export async function purchasePassPackage(
  pkg: PurchasesPackage,
  purchaseAccountRef: string,
): Promise<StorePurchaseResult> {
  await requireStoreCustomer(purchaseAccountRef);
  try {
    const { transaction } = await Purchases.purchasePackage(pkg);
    return { kind: 'purchased', transactionId: transaction.transactionIdentifier };
  } catch (error) {
    if (isPurchaseCancelled(error)) return { kind: 'cancelled' };
    throw error;
  }
}

function isPurchaseCancelled(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
  );
}

const STORE_ERROR_NAME_PATTERN = /^[A-Za-z_]{1,64}$/;

/**
 * Sentry에 실을 RevenueCat 오류 이름. 메시지는 스토어가 만든 자유 텍스트라 싣지 않고 `readableErrorCode`처럼
 * 닫힌 식별자만 꺼낸다. 모양이 맞지 않으면 버린다.
 */
export function describeStoreError(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('userInfo' in error)) return undefined;
  const { userInfo } = error;
  if (typeof userInfo !== 'object' || userInfo === null || !('readableErrorCode' in userInfo))
    return undefined;
  const name = userInfo.readableErrorCode;
  return typeof name === 'string' && STORE_ERROR_NAME_PATTERN.test(name) ? name : undefined;
}
