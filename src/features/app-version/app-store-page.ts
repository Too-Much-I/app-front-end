import { Linking } from 'react-native';

import type { AppPlatform } from '@/features/app-version/api/app-version-policy';

// 웹 레포 `src/lib/site-config.ts`의 스토어 주소와 같은 앱을 가리킨다.
const APP_STORE_URL = 'https://apps.apple.com/kr/app/id6803419955';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.toteacher.app';
/** 브라우저를 거치지 않고 Play 스토어 앱을 바로 연다. Play 스토어가 없는 기기에서는 실패한다. */
const PLAY_STORE_APP_URL = 'market://details?id=com.toteacher.app';

export async function openAppStorePage(platform: AppPlatform): Promise<void> {
  if (platform === 'ios') {
    await Linking.openURL(APP_STORE_URL);
    return;
  }
  try {
    await Linking.openURL(PLAY_STORE_APP_URL);
  } catch {
    await Linking.openURL(PLAY_STORE_URL);
  }
}
