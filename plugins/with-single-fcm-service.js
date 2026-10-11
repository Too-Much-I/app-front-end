const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

/**
 * Android에서 FCM 메시지(`com.google.firebase.MESSAGING_EVENT`)를 받는 서비스를 RNFB 하나로 고정한다.
 *
 * RNFB messaging과 expo-notifications가 둘 다 수신 서비스를 선언한다. 지금은 우선순위로 RNFB가 받지만
 * 라이브러리 업데이트로 바뀔 수 있다. Expo 서비스를 merged manifest에서 제거해 받는 쪽을 고정한다.
 * expo-notifications는 권한·채널 API만 쓴다. 결정: docs/decisions/2026-10-08-푸시-알림-기기-등록.md
 */
const EXPO_FCM_SERVICE = 'expo.modules.notifications.service.ExpoFirebaseMessagingService';

module.exports = function withSingleFcmService(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    manifest.manifest.$['xmlns:tools'] ??= 'http://schemas.android.com/tools';
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    application.service = (application.service ?? []).filter(
      (service) => service.$['android:name'] !== EXPO_FCM_SERVICE,
    );
    application.service.push({
      $: { 'android:name': EXPO_FCM_SERVICE, 'tools:node': 'remove' },
    });
    return config;
  });
};
