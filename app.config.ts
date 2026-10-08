import type { ConfigContext } from 'expo/config';

import { version } from './package.json';

// 로컬은 Git에서 제외한 파일, EAS는 file 환경변수의 경로를 사용한다.
// 설정 파일 원문을 extra에 넣으면 JS 번들에 복제되므로 경로만 native plugin에 전달한다.
export default ({ config }: ConfigContext) => ({
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
    googleServicesFile:
      process.env.GOOGLE_SERVICES_ANDROID ?? './config/firebase/google-services.json',
  },
  plugins: [
    ...(config.plugins ?? []),
    // CocoaPods로 native 의존성을 통일한다. SPM 기본 모드와 static을 혼합하지 않는다.
    ['@react-native-firebase/app', { ios: { disableSPM: true } }],
    '@react-native-firebase/auth',
    '@react-native-firebase/analytics',
    '@react-native-google-signin/google-signin',
    'expo-apple-authentication',
    // 결제 코드는 다음 업데이트에 붙인다. Play Console은 BILLING 권한이 든 빌드를 올려야 인앱 상품을 만들 수 있다.
    'expo-iap',
    [
      'expo-build-properties',
      {
        ios: {
          useFrameworks: 'static',
          forceStaticLinking: ['RNFBApp', 'RNFBAuth', 'RNFBAnalytics'],
        },
      },
    ],
  ],
});
