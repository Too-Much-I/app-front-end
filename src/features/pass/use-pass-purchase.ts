import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { PurchasesPackage } from 'react-native-purchases';

import { appAuthRuntime } from '@/features/auth/app-auth-runtime';
import { getPaymentProducts, type PaymentProduct } from '@/features/pass/api/payment-products';
import {
  PASS_PRODUCT_GROUPS,
  type PassPrice,
  type PassProduct,
  type PassProductGroup,
} from '@/features/pass/pass-products';
import { CURRENT_PAYMENT_STORE } from '@/features/pass/payment-store';
import type { PaymentSyncOutcome } from '@/features/pass/payment-sync';
import {
  describeStoreError,
  loadPassOffering,
  purchasePassPackage,
} from '@/features/pass/revenuecat';
import { trackConversion } from '@/lib/ad-conversion';
import { trackRevenue } from '@/lib/amplitude';
import { reportOperationalError } from '@/lib/operational-error-reporting';

const SECONDS_PER_DAY = 86_400;

export type PassOption = {
  product: PassProduct;
  /** Billing이 지급하는 기간. */
  days: number;
  price: PassPrice;
  pkg: PurchasesPackage;
};
export type PassOptionGroup = Omit<PassProductGroup, 'products'> & {
  options: readonly PassOption[];
};

/**
 * Billing 상품과 스토어 패키지가 서로 가리키는 것만 판다(Billing 명세 2026-10-14). 스토어에 있어도 Billing이
 * 모르거나 연결(packageId·productId)이 다르면 결제해도 이용권을 줄 수 없어 뺀다. 빈 그룹도 뺀다.
 */
function matchOptions(
  products: readonly PaymentProduct[],
  packages: readonly PurchasesPackage[],
): PassOptionGroup[] {
  const productByCode = new Map(products.map((product) => [product.offerCode, product]));
  const packageById = new Map(packages.map((pkg) => [pkg.identifier, pkg]));
  return PASS_PRODUCT_GROUPS.flatMap(({ products: displays, ...group }) => {
    const options = displays.flatMap((display): PassOption[] => {
      const billing = productByCode.get(display.offerCode);
      const link = billing?.storeProducts.find(({ store }) => store === CURRENT_PAYMENT_STORE);
      const pkg = link ? packageById.get(link.packageId) : undefined;
      if (!billing || !link || !pkg || pkg.product.identifier !== link.productId) return [];
      const { priceString, price, currencyCode } = pkg.product;
      return [
        {
          product: display,
          days: billing.durationSeconds / SECONDS_PER_DAY,
          pkg,
          price: { label: priceString, amount: price, currencyCode },
        },
      ];
    });
    return options.length > 0 ? [{ ...group, options }] : [];
  });
}

/** 둘 중 하나라도 실패하면 던진다. 정상 빈 목록과 실패를 구분해 실패를 "판매 없음"으로 숨기지 않는다. */
async function loadPassOptions(signal: AbortSignal): Promise<PassOptionGroup[]> {
  const [products, offering] = await Promise.all([getPaymentProducts(signal), loadPassOffering()]);
  return matchOptions(products, offering?.availablePackages ?? []);
}

/** 결제 전 실패는 `failed`, 결제 뒤는 확인 결과다. 결제 창을 닫으면 `cancelled`. */
export type PassPurchaseOutcome = 'failed' | PaymentSyncOutcome;

/**
 * 이용권 화면의 상품과 결제. 화면에 들어오면 결제용 ID 확보를 시작한다 — 로그인 때 받지 못했으면 여기서 다시
 * 받는다(이미 있으면 다시 받지 않는다). 결제 직전에도 확보를 기다려 다른 사용자로 결제하지 않게 한다.
 *
 * 결제가 끝나면 Billing에 반영을 확인하고(최대 약 30초) 이용권 조회를 갱신한다.
 */
export function usePassPurchase() {
  const { purchaseIdentity, paymentSync } = appAuthRuntime;
  const queryClient = useQueryClient();
  const options = useQuery({
    queryKey: ['pass', 'options'] as const,
    queryFn: ({ signal }) => loadPassOptions(signal),
    // 판매 목록·가격은 화면에 들어올 때마다 다시 읽는다. 스토어 쪽은 SDK가 자체 캐시를 둔다.
    staleTime: 0,
    retry: false,
  });
  const [isPurchasing, setIsPurchasing] = useState(false);
  // 상태는 다음 렌더에 반영돼 빠른 연속 탭을 막지 못한다. 결제 창이 두 번 뜨지 않게 즉시 막는다.
  const purchasingRef = useRef(false);

  // 로그인 때 받지 못했으면 여기서 다시 받고, 확인을 끝내지 못한 결제를 다시 확인한다.
  useEffect(() => {
    void purchaseIdentity
      .ensure()
      .then((ref) => paymentSync.resume(ref))
      .catch(() => undefined);
  }, [purchaseIdentity, paymentSync]);

  async function purchase(option: PassOption): Promise<PassPurchaseOutcome | null> {
    if (purchasingRef.current) return null;
    purchasingRef.current = true;
    setIsPurchasing(true);
    try {
      let purchaseAccountRef: string;
      try {
        purchaseAccountRef = await purchaseIdentity.ensure();
      } catch (error) {
        reportOperationalError({
          code: 'PASS_PURCHASE_FAILED',
          stage: 'purchase-account',
          cause: error,
        });
        return 'failed';
      }
      let transactionId: string;
      try {
        const result = await purchasePassPackage(option.pkg);
        if (result.kind === 'cancelled') return 'cancelled';
        transactionId = result.transactionId;
        // 스토어 결제가 성공한 순간을 전환으로 센다(2026-10-14 결정). 서버 반영을 기다리지 않는다.
        trackConversion({
          name: 'purchase',
          value: option.price.amount,
          currency: option.price.currencyCode,
        });
        trackRevenue({
          productId: option.pkg.product.identifier,
          price: option.price.amount,
          currency: option.price.currencyCode,
          revenueType: 'pass',
        });
      } catch (error) {
        reportOperationalError({
          code: 'PASS_PURCHASE_FAILED',
          stage: 'store-purchase',
          storeErrorCode: describeStoreError(error),
          cause: error,
        });
        return 'failed';
      }
      // 결제는 끝났다. 여기부터는 실패해도 결제를 다시 하지 않는다 — 확인 결과만 알린다.
      const outcome = await paymentSync.start({
        purchaseAccountRef,
        store: CURRENT_PAYMENT_STORE,
        transactionId,
      });
      // 돈은 냈는데 이용권이 아직 없는 사용자다. 문의가 오기 전에 알 수 있게 보고한다.
      if (outcome === 'pending' || outcome === 'contact-support')
        reportOperationalError({ code: 'PASS_PURCHASE_FAILED', stage: 'sync', outcome });
      // 반영됐든 확인 중이든 이용권 조회가 바뀌었다(명세: APPLIED면 갱신).
      void queryClient.invalidateQueries({ queryKey: ['entitlements'] });
      return outcome;
    } finally {
      purchasingRef.current = false;
      setIsPurchasing(false);
    }
  }

  return { options, isPurchasing, purchase };
}
