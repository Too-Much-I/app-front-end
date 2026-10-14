import { Platform } from 'react-native';

/** Billing이 구분하는 스토어. */
export type PaymentStore = 'APP_STORE' | 'PLAY_STORE';

/** 이 기기의 스토어. RevenueCat 설정이 iOS·Android만 받으므로 그 밖의 플랫폼은 결제까지 오지 않는다. */
export const CURRENT_PAYMENT_STORE: PaymentStore =
  Platform.OS === 'ios' ? 'APP_STORE' : 'PLAY_STORE';
