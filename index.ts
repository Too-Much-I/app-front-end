import { registerRootComponent } from 'expo';

import { initializeAmplitude } from '@/lib/amplitude';
import { initializeClarity } from '@/lib/clarity';
import { initializeSentry, withSentry } from '@/lib/sentry';
import { IS_SENTRY_VALIDATION_MODE } from '@/lib/sentry-validation-mode';

import App from './App';

// 앱 시작 단계의 예외까지 잡으려면 다른 초기화보다 먼저 실행해야 한다.
initializeSentry();
if (!IS_SENTRY_VALIDATION_MODE) {
  initializeClarity();
  initializeAmplitude();
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(withSentry(App));
