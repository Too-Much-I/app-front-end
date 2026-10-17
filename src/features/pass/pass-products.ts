/**
 * 기간제 이용권의 화면 표시(이름·묶음).
 *
 * 모든 이용권은 기간 안에 무제한이고 결제가 성사된 순간부터 기간이 시작된다(2026-10-11 결정).
 * 키는 Billing 상품 코드(offerCode)다. 무엇을 팔 수 있는지는 Billing 상품 목록과 스토어 Offering을 대조해
 * 정하고, 가격은 스토어, 기간은 Billing(`durationSeconds`)이 정한다. 여기에는 표시만 둔다.
 * "한 달"은 28일(4주)이다(2026-10-13 결정).
 */
export type PassOfferCode =
  'PREMIUM_1D' | 'PREMIUM_3D' | 'PREMIUM_7D' | 'PREMIUM_14D' | 'PREMIUM_28D';

export type PassProduct = {
  offerCode: PassOfferCode;
  label: string;
};

export type PassProductGroup = {
  title: string;
  description: string;
  products: readonly PassProduct[];
};

export const PASS_PRODUCT_GROUPS: readonly PassProductGroup[] = [
  {
    title: '시험 직전 점검',
    description: '실전 감각 점검',
    products: [
      { offerCode: 'PREMIUM_1D', label: '1일권' },
      { offerCode: 'PREMIUM_3D', label: '3일권' },
    ],
  },
  {
    title: '단기 집중 연습',
    description: '약점 보완·재답변',
    products: [
      { offerCode: 'PREMIUM_7D', label: '1주권' },
      { offerCode: 'PREMIUM_14D', label: '2주권' },
    ],
  },
  {
    title: '여유 있는 준비',
    description: '변화 확인·꾸준한 연습',
    products: [{ offerCode: 'PREMIUM_28D', label: '4주권' }],
  },
];

/** 처음 열었을 때 선택돼 있는 상품. 가운데 그룹의 짧은 쪽이다. */
export const DEFAULT_PASS_OFFER_CODE: PassOfferCode = 'PREMIUM_7D';

/** 스토어가 돌려준 가격. `label`은 스토어가 나라·통화에 맞춰 만든 문자열이다. */
export type PassPrice = { label: string; amount: number; currencyCode: string };

/** 하루 단가를 100원 단위로 반올림한다. 1일권은 단가가 곧 가격이라 따로 말하지 않는다. */
const PER_DAY_ROUNDING_WON = 100;

function formatWon(won: number): string {
  return won.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 원화가 아니면 반올림 단위를 정할 수 없어 단가를 말하지 않는다. `days`는 Billing의 지급 기간이다. */
export function describePassPerDay(days: number, price: PassPrice): string | null {
  if (days === 1) return '하루 이용';
  if (price.currencyCode !== 'KRW') return null;
  const perDay = Math.round(price.amount / days / PER_DAY_ROUNDING_WON) * PER_DAY_ROUNDING_WON;
  return `하루 약 ${formatWon(perDay)}원`;
}
