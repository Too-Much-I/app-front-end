import { Platform } from 'react-native';

import type { FirebaseLoginProvider } from '@/features/auth/firebase-auth-types';

/**
 * 광고 전환 측정 배선 — Firebase Analytics로 보내고 Google Ads가 GA4에서 가져간다.
 *
 * `trackEvent`(Amplitude)와 따로 둔다. 여기로 보내는 이벤트는 광고 플랫폼이 예산을 쓰는
 * 방향을 바꾸므로, 호출부만 보고도 광고로 나가는 줄인지 알 수 있어야 한다.
 * 결정: docs/decisions/2026-10-08-광고-전환-측정.md
 *
 * Firebase 프로젝트가 환경마다 나뉘어 있지 않아 개발 빌드의 테스트도 광고 신호에 섞인다.
 * 그래서 자동 수집을 네이티브 설정(`firebase.json`)에서 꺼두고 이 스위치가 켜진 빌드에서만 켠다.
 */
const AD_CONVERSION_ENABLED = process.env.EXPO_PUBLIC_ENABLE_AD_CONVERSION === 'true';

/**
 * 결제만 금액·통화를 싣는다(2026-10-14 결정). Google Ads가 매출 기준으로 입찰할 수 있게 GA4 표준 `purchase`
 * 이벤트를 쓴다. 결제 금액은 개인정보처리방침의 광고 성과 측정 항목에 적는다.
 *
 * 가입 단계·모의고사 시작은 설치 뒤 캠페인별로 어디서 빠지는지 GA4 유입 경로로 보려고 보낸다
 * (2026-10-30 결정, docs/learning/2026-10-30-가입-단계-광고-측정.md). Google Ads에서 가져오지 않으면
 * 입찰에는 쓰이지 않는다. 속성은 로그인 수단·단계 이름 같은 고정 값만 싣는다.
 */
export type AdConversion =
  | 'sign_up'
  | 'mock_exam_completed'
  | { name: 'purchase'; value: number; currency: string }
  | 'login_screen_viewed'
  | { name: 'sns_login_started'; method: FirebaseLoginProvider }
  | { name: 'sns_login_cancelled'; method: FirebaseLoginProvider }
  | {
      name: 'sns_login_failed';
      method: FirebaseLoginProvider;
      stage: 'firebase' | 'identity' | 'session-activate';
    }
  | 'signup_started'
  // signup-flow가 이 파일을 부르므로 `SignupStep`을 가져오면 순환한다. 어긋나면 호출부 타입 검사가 잡는다.
  | { name: 'signup_step_completed'; step: 'nickname' | 'consents' | 'phone' }
  | 'phone_code_requested'
  | 'mock_exam_started';

type FirebaseAnalyticsModule = typeof import('@react-native-firebase/analytics');

/**
 * 초기화가 끝난 SDK. 실패하면 `null`로 resolve해서 이후 호출이 조용히 no-op이 된다.
 */
let firebaseReady: Promise<FirebaseAnalyticsModule | null> | null = null;
let initialized = false;

/**
 * 네이티브 모듈이라 import만으로 네이티브 코드를 평가한다. 수집이 꺼진 상태에서도
 * Expo Go가 살아 있어야 하므로 Amplitude와 같이 지연 import한다.
 */
export function initializeAdConversion(): void {
  if (initialized || (Platform.OS !== 'android' && Platform.OS !== 'ios')) return;
  initialized = true;

  if (!AD_CONVERSION_ENABLED) {
    // 수집 허용 값은 네이티브에 저장되어 `firebase.json`의 기본값보다 우선한다. 켜진 빌드를
    // 거친 기기(같은 패키지의 운영 앱을 덮어쓴 개발 빌드, 스위치를 끈 운영 빌드)에서도
    // 수집이 멈추도록 꺼진 빌드는 매 실행 명시적으로 끈다. 네이티브 모듈이 없으면 끌 것도 없다.
    void import('@react-native-firebase/analytics')
      .then((firebase) => firebase.setAnalyticsCollectionEnabled(firebase.getAnalytics(), false))
      .catch(() => undefined);
    return;
  }

  firebaseReady = import('@react-native-firebase/analytics')
    .then(async (firebase) => {
      // 네이티브에 저장되는 값이라 한 번 켜면 다음 실행부터는 시작 직후부터 수집한다.
      await firebase.setAnalyticsCollectionEnabled(firebase.getAnalytics(), true);
      return firebase;
    })
    .catch((error: unknown) => {
      console.error('[AdConversion] Firebase Analytics initialization failed', error);
      return null;
    });
}

/**
 * 수집이 꺼져 있으면 아무 일도 하지 않는다. 광고 플랫폼은 제3자라 결제 금액과 고정 값 속성 말고는
 * 싣지 않는다 — 회원·거래 식별자도 보내지 않는다.
 */
export function trackConversion(conversion: AdConversion): void {
  void firebaseReady?.then((firebase) => {
    if (!firebase) return;
    const analytics = firebase.getAnalytics();
    if (typeof conversion === 'object') {
      const { name, ...params } = conversion;
      // SDK는 GA4 표준 이벤트마다 속성 타입을 따로 정의한다. 표준 `purchase`도 맞춤 이벤트 서명으로 보낸다.
      const eventName: string = name;
      firebase.logEvent(analytics, eventName, params);
    } else if (conversion === 'sign_up') {
      // 가입은 SNS 로그인으로만 시작하고, 이 시점에는 어느 SNS인지 들고 있지 않다.
      firebase.logEvent(analytics, 'sign_up', { method: 'sns' });
    } else {
      firebase.logEvent(analytics, conversion);
    }
  });
}
