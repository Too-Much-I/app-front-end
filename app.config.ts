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
    [
      'react-native-fbsdk-next',
      {
        // Meta 개발자 콘솔의 앱 값. 둘 다 앱 번들에 실리는 공개 값이다(앱 시크릿과 다르다).
        appID: '1330528452310456',
        clientToken: '0b1b502dae86edc111f15b12b22ca949',
        displayName: '토선생',
        // 개발 빌드의 이벤트가 광고 신호에 섞이지 않게 기본은 끈다.
        // EXPO_PUBLIC_ENABLE_AD_CONVERSION이 켜진 빌드에서 src/lib/ad-conversion.ts가 켠다.
        isAutoInitEnabled: false,
        autoLogAppEventsEnabled: false,
        advertiserIDCollectionEnabled: false,
      },
    ],
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
