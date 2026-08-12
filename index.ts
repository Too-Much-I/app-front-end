import { registerRootComponent } from 'expo';

import { initializeClarity } from '@/lib/clarity';
import { initializeSentry, withSentry } from '@/lib/sentry';

import App from './App';

// 앱 시작 단계의 예외까지 잡으려면 다른 초기화보다 먼저 실행해야 한다.
initializeSentry();
initializeClarity();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(withSentry(App));
