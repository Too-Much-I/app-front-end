import type { ConfigContext } from 'expo/config';

import { version } from './package.json';

// 로컬은 Git에서 제외한 파일, EAS는 file 환경변수의 경로를 사용한다.
// 설정 파일 원문을 extra에 넣으면 JS 번들에 복제되므로 경로만 native plugin에 전달한다.
const createNativeAppConfig = ({ config }: ConfigContext) => ({
  ...config,
  version,
  ios: {
    ...config.ios,
    usesAppleSignIn: true,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_IOS ?? './config/firebase/GoogleService-Info.plist',
  },
  android: {
    ...config.android,
    // 알림 설치 정보가 백업으로 새 기기에 따라가면 Keystore 키가 없어 읽지 못한다. 앱 전체 백업을 끈다(2026-10-08 결정).
    allowBackup: false,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_ANDROID ?? './config/firebase/google-services.json',
  },
  plugins: [
    [
      'expo-speech-recognition',
      {
        microphonePermission: '따라 말하기와 실전 연습을 위해 마이크 권한이 필요합니다.',
        speechRecognitionPermission: '기기 내 영어 음성 인식으로 말한 단어를 확인합니다.',
      },
    ],
    ...(config.plugins ?? []),
    // CocoaPods로 native 의존성을 통일한다. SPM 기본 모드와 static을 혼합하지 않는다.
    ['@react-native-firebase/app', { ios: { disableSPM: true } }],
    '@react-native-firebase/auth',
    '@react-native-firebase/analytics',
    '@react-native-firebase/messaging',
    './plugins/with-ios-scene-lifecycle',
    'expo-notifications',
    // Android FCM 수신은 RNFB 서비스 하나로 고정한다(2026-10-08 결정). Expo 쪽 수신 서비스를 manifest에서 뺀다.
    './plugins/with-single-fcm-service',
    '@react-native-google-signin/google-signin',
    'expo-apple-authentication',
    // 결제 코드는 다음 업데이트에 붙인다. Play Console은 BILLING 권한이 든 빌드를 올려야 인앱 상품을 만들 수 있다.
    'expo-iap',
    [
      'expo-build-properties',
      {
        ios: {
          useFrameworks: 'static',
          forceStaticLinking: ['RNFBApp', 'RNFBAuth', 'RNFBAnalytics', 'RNFBMessaging'],
        },
      },
    ],
  ],
});

export default (context: ConfigContext) => {
  if (process.env.LEARNING_SAMPLE === '1') {
    return require('./examples/learning-sample/sample-config.cjs')(context.config);
  }
  return createNativeAppConfig(context);
};
