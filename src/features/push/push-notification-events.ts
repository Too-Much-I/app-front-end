import {
  getInitialNotification,
  getMessaging,
  onNotificationOpenedApp,
  onTokenRefresh,
} from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { readPushOpenRoute, type PushOpenRoute } from '@/features/push/push-open-route';
import { ensureStudyChannel } from '@/features/push/push-permission';

function isNativePlatform(): boolean {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}

/**
 * 앱 시작 때 한 번. 첫 푸시가 오기 전에 학습 채널을 만들고, 앱을 보고 있을 때는 알림을 띄우지 않는다
 * (2026-10-08 결정). iOS 포그라운드 표시는 RNFB가 `firebase.json`으로, Expo 쪽은 이 핸들러로 막는다.
 */
export function initializePushNotifications(): void {
  if (!isNativePlatform()) return;
  void ensureStudyChannel().catch(() => undefined);
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** FCM 토큰이 바뀌면 알린다. 토큰은 PUT이 보내는 순간 다시 읽으므로 값은 넘기지 않는다. */
export function observePushTokenRefresh(listener: () => void): () => void {
  if (!isNativePlatform()) return () => undefined;
  return onTokenRefresh(getMessaging(), listener);
}

/**
 * 아는 route의 알림을 눌러 앱이 열리면 그 route의 처리를 부른다. 꺼진 상태에서 눌러 연 경우도 포함한다.
 * 회원 화면이 붙을 때 구독한다 — 로그아웃 상태에서 누른 알림은 무시된다(이벤트 알림도 같다, 2026-10-27 결정).
 * `handlers`는 바뀌면 다시 구독하므로 부르는 쪽이 고정된 객체로 넘긴다.
 */
export function usePushNotificationOpen(handlers: Record<PushOpenRoute, () => void>): void {
  useEffect(() => {
    if (!isNativePlatform()) return undefined;
    const messaging = getMessaging();
    let active = true;
    const open = (message: { data?: Record<string, unknown> } | null) => {
      const route = readPushOpenRoute(message);
      if (route) handlers[route]();
    };
    void getInitialNotification(messaging)
      .then((message) => {
        if (active) open(message);
      })
      .catch(() => undefined);
    const unsubscribe = onNotificationOpenedApp(messaging, open);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [handlers]);
}
