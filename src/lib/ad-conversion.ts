import { Platform } from 'react-native';

/**
 * 광고 전환 측정 배선 — Firebase Analytics(Google Ads가 가져감)와 Meta App Events.
 *
 * `trackEvent`(Amplitude)와 따로 둔다. 여기로 보내는 이벤트는 광고 플랫폼이 예산을 쓰는
 * 방향을 바꾸므로, 호출부만 보고도 광고로 나가는 줄인지 알 수 있어야 한다.
 * 결정: docs/decisions/2026-10-08-광고-전환-측정.md
 *
 * Meta 앱과 Firebase 프로젝트가 환경마다 나뉘어 있지 않아 개발 빌드의 테스트도 광고 신호에
 * 섞인다. 그래서 두 SDK의 자동 수집을 네이티브 설정에서 꺼두고(`firebase.json`,
 * `app.config.ts`의 `react-native-fbsdk-next` plugin) 이 스위치가 켜진 빌드에서만 켠다.
 */
const AD_CONVERSION_ENABLED = process.env.EXPO_PUBLIC_ENABLE_AD_CONVERSION === 'true';

export type AdConversion = 'sign_up' | 'mock_exam_completed';

type FirebaseAnalyticsModule = typeof import('@react-native-firebase/analytics');
type MetaModule = typeof import('react-native-fbsdk-next');

/**
 * Meta는 표준 이벤트 이름이어야 광고 최적화 목표로 고를 수 있다. 가입은 표준 이벤트
 * (`AppEventsLogger.AppEvents.CompletedRegistration`)가 있고, 모의고사 완료에 맞는 표준
 * 이벤트는 없어 맞춤 이벤트로 보낸다. 지연 import라 상수 대신 값을 적는다.
 */
const META_EVENT_NAMES = {
  sign_up: 'fb_mobile_complete_registration',
  mock_exam_completed: 'mock_exam_completed',
} satisfies Record<AdConversion, string>;

/**
 * 초기화가 끝난 SDK. 실패하면 `null`로 resolve해서 이후 호출이 조용히 no-op이 된다.
 * 한 SDK의 실패가 다른 쪽 전송을 막지 않도록 둘을 따로 둔다.
 */
let firebaseReady: Promise<FirebaseAnalyticsModule | null> | null = null;
let metaReady: Promise<MetaModule | null> | null = null;

/**
 * 두 SDK 모두 네이티브 모듈이라 import만으로 네이티브 코드를 평가한다. 수집이 꺼진 상태에서도
 * Expo Go가 살아 있어야 하므로 Amplitude와 같이 지연 import한다.
 */
export function initializeAdConversion(): void {
  if (
    !AD_CONVERSION_ENABLED ||
    firebaseReady ||
    (Platform.OS !== 'android' && Platform.OS !== 'ios')
  ) {
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

  metaReady = import('react-native-fbsdk-next')
    .then((meta) => {
      // 설치·실행 자동 이벤트가 있어야 Meta가 광고 클릭과 설치를 잇는다.
      meta.Settings.setAutoLogAppEventsEnabled(true);
      meta.Settings.setAdvertiserIDCollectionEnabled(true);
      meta.Settings.initializeSDK();
      return meta;
    })
    .catch((error: unknown) => {
      console.error('[AdConversion] Meta SDK initialization failed', error);
      return null;
    });
}

/** 수집이 꺼져 있으면 아무 일도 하지 않는다. 속성은 싣지 않는다 — 광고 플랫폼은 제3자다. */
export function trackConversion(conversion: AdConversion): void {
  void firebaseReady?.then((firebase) => {
    if (!firebase) return;
    const analytics = firebase.getAnalytics();
    if (conversion === 'sign_up') {
      // 가입은 SNS 로그인으로만 시작하고, 이 시점에는 어느 SNS인지 들고 있지 않다.
      firebase.logEvent(analytics, 'sign_up', { method: 'sns' });
    } else {
      firebase.logEvent(analytics, conversion);
    }
  });

  void metaReady?.then((meta) => {
    meta?.AppEventsLogger.logEvent(META_EVENT_NAMES[conversion]);
  });
}
