import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** 서버에 보고하는 권한. 서버는 AUTHORIZED인 기기에만 보낸다. */
export type PushPermission = 'AUTHORIZED' | 'DENIED' | 'UNKNOWN';

/**
 * 리마인더가 쓰는 Android 채널. 서버 payload에 `channel_id`가 없어 FCM 기본 채널로 지정한다
 * (`firebase.json`의 `messaging_android_notification_channel_id`). 첫 푸시 전에 만들어 둬야 한다.
 */
export const STUDY_CHANNEL_ID = 'study';

export async function ensureStudyChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  // 이미 있으면 이름만 갱신된다. 사용자가 바꾼 중요도는 OS가 지킨다.
  await Notifications.setNotificationChannelAsync(STUDY_CHANNEL_ID, {
    name: '학습',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * 지금 OS 상태를 읽는다. PUT을 보내는 순간에 부른다(2026-10-08 결정 — permissionObservedAt).
 * Android는 앱 알림과 학습 채널이 모두 허용일 때만 AUTHORIZED다(서버 명세).
 */
export async function readPushPermission(): Promise<PushPermission> {
  try {
    const { status, ios } = await Notifications.getPermissionsAsync();
    if (status === 'undetermined') return 'UNKNOWN';
    if (status === 'denied') return 'DENIED';
    // iOS는 authorized만 AUTHORIZED다. provisional·ephemeral도 granted로 오지만 서버 명세상 UNKNOWN이다.
    if (Platform.OS === 'ios')
      return ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED
        ? 'AUTHORIZED'
        : 'UNKNOWN';
    const channel = await Notifications.getNotificationChannelAsync(STUDY_CHANNEL_ID);
    if (!channel) return 'UNKNOWN';
    return channel.importance === Notifications.AndroidImportance.NONE ? 'DENIED' : 'AUTHORIZED';
  } catch {
    return 'UNKNOWN';
  }
}

/**
 * OS 팝업을 띄울 수 있으면 사전 안내를 띄운다 — 가입 직후, 재설치, 새 폰 로그인 모두(2026-10-11 결정).
 *
 * Android 13+는 안 물어본 앱도 알림이 꺼져 있어 expo가 `undetermined` 대신 `denied`를 준다
 * (NotificationPermissionsModule `!areEnabled -> DENIED`). 그래서 `canAskAgain`으로 고른다: 안 물어봄과
 * 한 번 거절은 true, 두 번 거절은 false다. 한 번 거절한 사람에게는 한 번 더 뜬다(2026-10-11 결정).
 * iOS는 안 물어봄만 true, Android 12 이하는 알림이 꺼져 있으면 false라 팝업 없는 안내가 반복되지 않는다.
 */
export async function shouldAskPushPermission(): Promise<boolean> {
  try {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    return status !== 'granted' && canAskAgain;
  } catch {
    return false;
  }
}

/** OS 팝업. 허용·거절은 OS에서만 정한다. */
export async function requestPushPermission(): Promise<void> {
  try {
    await Notifications.requestPermissionsAsync();
  } catch {
    // 팝업을 못 띄워도 다음 PUT이 그때의 OS 상태를 보고한다.
  }
}
