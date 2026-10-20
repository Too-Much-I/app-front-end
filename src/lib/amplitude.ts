import { Platform } from 'react-native';

import type { AnalyticsEvent } from '@/lib/analytics-events';

/**
 * Amplitude 제품 분석 배선.
 *
 * API Key는 앱 번들에 실려 배포되는 공개 값이라 Sentry DSN과 성격이 같다. 다만 DSN과
 * 달리 프로젝트(=환경)마다 값이 달라야 dev/staging/prod 데이터가 섞이지 않으므로
 * 코드에 두지 않고 EAS Environment별 `EXPO_PUBLIC_*` 변수로 주입한다.
 *
 * 세션 리코딩은 켜지 않는다. 화면 녹화는 이미 Clarity가 담당하고 있고, 학습자 답안과
 * 성적이 뜨는 화면을 두 벌로 수집할 이유가 없다.
 */
const AMPLITUDE_API_KEY = process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY ?? '';
const AMPLITUDE_ENABLED =
  process.env.EXPO_PUBLIC_ENABLE_AMPLITUDE === 'true' && AMPLITUDE_API_KEY !== '';

type AmplitudeModule = typeof import('@amplitude/analytics-react-native');

/**
 * 초기화가 끝난 SDK. 실패하면 `null`로 resolve해서 이후 호출이 조용히 no-op이 된다.
 * 관측 도구 실패가 사용자 흐름을 막으면 안 되므로 이 promise는 절대 reject하지 않는다.
 */
let amplitudeReady: Promise<AmplitudeModule | null> | null = null;

/**
 * Amplitude는 네이티브 모듈이라 import만으로 네이티브 코드를 평가한다. 수집이 꺼진
 * 상태에서도 Expo Go가 살아 있어야 하므로 Clarity와 같이 지연 import한다.
 */
export function initializeAmplitude(): void {
  if (
    !AMPLITUDE_ENABLED ||
    amplitudeReady ||
    (Platform.OS !== 'android' && Platform.OS !== 'ios')
  ) {
    return;
  }

  amplitudeReady = import('@amplitude/analytics-react-native')
    .then(async (amplitude) => {
      await amplitude.init(AMPLITUDE_API_KEY, undefined, {
        // 학습자 답안과 계정 정보가 오가는 앱이므로 자동 수집 범위를 좁게 잡는다.
        // sentry.ts가 URL·식별자·답안을 스크러빙하는 정책과 같은 기준이다.
        autocapture: {
          sessions: true,
          appLifecycles: true,
          // 눌린 요소의 텍스트를 그대로 담아 답안 내용이 새어 나갈 수 있다.
          elementInteractions: false,
          // 요청 URL에 examId 같은 식별자가 실린다.
          networkTracking: false,
          /**
           * 자동 수집 스위치가 아니라 `trackScreenView`의 차단 스위치다. SDK는
           * 이 값이 `false`면 수동 호출까지 조기 반환하고(react-native-client의
           * trackScreenView), 화면 조회를 자동으로 잡는 경로는 따로 없다.
           * 라우트 이름은 App.tsx가 직접 넘기므로 켜두어야 한다.
           */
          screenViews: true,
        },
        trackingOptions: {
          // Amplitude에서는 광고 식별자를 쓸 곳이 없다. 광고 측정은 ad-conversion.ts 몫이다.
          adid: false,
          appSetId: false,
          idfv: false,
          ipAddress: false,
          carrier: false,
        },
      }).promise;
      return amplitude;
    })
    .catch((error: unknown) => {
      console.error('[Amplitude] initialization failed', error);
      return null;
    });
}

/**
 * 수집이 꺼져 있으면 아무 일도 하지 않는다.
 * 이름과 속성 조합은 `analytics-events.ts`의 union이 컴파일 타임에 강제한다.
 */
export function trackEvent(event: AnalyticsEvent): void {
  if (!amplitudeReady) return;

  void amplitudeReady.then((amplitude) => {
    amplitude?.track(event.name, 'properties' in event ? event.properties : undefined);
  });
}

let lastScreenName: string | null = null;

/**
 * 라우트 이름만 보낸다. 화면 파라미터에는 examId 같은 식별자가 실리므로 넘기지 않는다.
 */
export function trackScreenView(routeName: string): void {
  lastScreenName = routeName;
  if (!amplitudeReady) return;

  void amplitudeReady.then((amplitude) => {
    amplitude?.trackScreenView(routeName);
  });
}

/**
 * 마지막으로 조회한 라우트 이름. `NavigationContainer` 바깥에 있어 훅으로 라우트를
 * 읽을 수 없는 전역 오버레이(`PortraitOnlyNotice`)가 쓴다. 수집이 꺼져 있어도
 * `trackScreenView`가 값은 갱신하므로 플래그와 무관하게 동작한다.
 */
export function getLastScreenName(): string | null {
  return lastScreenName;
}

/**
 * 분석 사용자를 결제용 ID(`purchaseAccountRefId`)로 맞춘다(2026-10-20 결정). 같은 사용자면 기기가
 * 달라도 늘 같은 값이라 한 사람의 이벤트가 기기를 넘어 이어진다. 회원 ID는 앱이 갖고 있지 않고,
 * 갖고 있더라도 분석 도구에 원본을 보내지 않는다.
 */
export function setAnalyticsUserId(userId: string): void {
  if (!amplitudeReady) return;

  void amplitudeReady.then((amplitude) => {
    amplitude?.setUserId(userId);
  });
}

/**
 * 사용자 ID를 비우고 기기 ID를 새로 만든다. 사용자 ID만 비우면 로그인 화면에서 쌓인 이벤트가 같은
 * 기기 ID를 타고 이전 계정에 붙는다 — 그 이벤트는 다음에 로그인할 계정의 것이다.
 *
 * 네트워크 없이 메모리 값만 바꾸므로 다시 해서 나을 실패가 없다. 로그인 화면에 올 때마다 불리는
 * 것이 곧 재시도다. 초기화와 같은 promise에 줄 서므로 뒤따르는 `setAnalyticsUserId`보다 먼저 끝난다.
 */
export function resetAnalyticsUser(): void {
  if (!amplitudeReady) return;

  void amplitudeReady.then((amplitude) => {
    amplitude?.reset();
  });
}

/** 결제 매출. Amplitude 표준 Revenue로 보내 매출·LTV 차트가 별도 설정 없이 붙는다. */
export interface AnalyticsRevenue {
  /** 스토어 상품 ID. */
  productId: string;
  price: number;
  currency: string;
  revenueType: 'pass';
}

/** 거래 ID·영수증은 싣지 않는다. 광고 전환(`ad-conversion.ts`)과 같은 기준이다. */
export function trackRevenue({ productId, price, currency, revenueType }: AnalyticsRevenue): void {
  if (!amplitudeReady) return;

  void amplitudeReady.then((amplitude) => {
    if (!amplitude) return;
    const revenue = new amplitude.Revenue()
      .setProductId(productId)
      .setPrice(price)
      .setQuantity(1)
      .setCurrency(currency)
      .setRevenueType(revenueType);
    amplitude.revenue(revenue);
  });
}
