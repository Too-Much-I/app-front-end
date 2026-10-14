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

/** 처음 쓸 때 한 번 설정한다. 앱 시작을 늦추지 않고, 결제를 쓰지 않는 사용자는 SDK를 깨우지 않는다. */
function configureOnce(): void {
  if (configured) return;
  const apiKey = API_KEY_BY_PLATFORM[Platform.OS];
  if (!apiKey) throw new Error(`이 플랫폼은 스토어 결제를 지원하지 않는다: ${Platform.OS}`);
  Purchases.configure({ apiKey });
  configured = true;
}

/** RevenueCat 사용자를 결제용 ID로 맞춘다. 이미 같은 사용자면 SDK가 그대로 둔다. */
export async function logInStoreCustomer(purchaseAccountRef: string): Promise<void> {
  configureOnce();
  await Purchases.logIn(purchaseAccountRef);
}

/** 익명 사용자에게 logOut을 부르면 SDK가 오류를 낸다. 로그인 화면은 앱을 켤 때마다 오므로 먼저 확인한다. */
export async function logOutStoreCustomer(): Promise<void> {
  // 이번 실행에서 SDK를 쓴 적이 없어도 이전 실행의 사용자가 SDK 저장소에 남아 있을 수 있다.
  configureOnce();
  if (await Purchases.isAnonymous()) return;
  await Purchases.logOut();
}

/** Offering이 없으면 null. 스토어에 상품이 비활성이면 패키지가 비어서 온다. */
export async function loadPassOffering(): Promise<PurchasesOffering | null> {
  configureOnce();
  const offerings = await Purchases.getOfferings();
  return offerings.all[PASS_OFFERING_ID] ?? null;
}

/** `transactionId`는 sync에 보낼 스토어 거래 ID다. 서버가 실거래로 이 값이 맞는지 확정한다(Billing 명세). */
export type StorePurchaseResult =
  { kind: 'purchased'; transactionId: string } | { kind: 'cancelled' };

/** 사용자가 결제 창을 닫은 것은 실패가 아니다. 나머지 오류는 그대로 던진다. */
export async function purchasePassPackage(pkg: PurchasesPackage): Promise<StorePurchaseResult> {
  configureOnce();
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
