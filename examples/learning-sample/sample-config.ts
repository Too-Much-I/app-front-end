import type { ConfigContext } from 'expo/config';

export function getLearningSampleConfig(config: ConfigContext['config']) {
  return {
    ...config,
    name: '토선생 학습 샘플',
    slug: 'tosunsaeng-learning-sample',
    scheme: 'tosunsaeng-learning-sample',
    ios: { ...config.ios, bundleIdentifier: 'com.toteacher.learning.sample' },
    android: { ...config.android, package: 'com.toteacher.learning.sample' },
    plugins: [
      './examples/learning-sample/with-sample-pods.cjs',
      'expo-font',
      ['expo-audio', { microphonePermission: '학습 샘플에서 답변을 녹음합니다.' }],
      [
        'expo-speech-recognition',
        {
          microphonePermission: '따라 말하기를 위해 마이크를 사용합니다.',
          speechRecognitionPermission: '기기 내 영어 음성 인식으로 말한 단어를 확인합니다.',
        },
      ],
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
  };
}
