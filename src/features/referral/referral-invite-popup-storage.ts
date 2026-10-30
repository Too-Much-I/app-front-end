import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'referral-invite-popup';

/**
 * 친구 초대 팝업을 띄울지. 기기 기준이다(2026-10-29 D11 결정).
 *
 * - `pending`: 이 기기에서 아직 팝업이 뜨지 않았다. 새 회원도, 업데이트를 받은 기존 회원도 한 번 본다
 *   (2026-10-30 결정 — 광고로 들어오는 새 회원이 적어 기존 회원 참여가 필요하다).
 * - `seen`: 팝업이 떴다. 누르거나 닫지 않아도 뜬 순간 본 것으로 친다.
 * - `unreadable`: 기록을 읽지 못했다. 한 번 놓쳐도 괜찮은 안내라 띄우지 않는다.
 */
export type ReferralInvitePopupStatus = 'pending' | 'seen' | 'unreadable';

let statusPromise: Promise<ReferralInvitePopupStatus> | null = null;

/** 앱이 켜져 있는 동안 같은 결과를 돌려준다. 표시가 바꾼 값은 `markReferralInvitePopupSeen`이 함께 고친다. */
export function loadReferralInvitePopupStatus(): Promise<ReferralInvitePopupStatus> {
  statusPromise ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((stored): ReferralInvitePopupStatus => (stored === 'seen' ? 'seen' : 'pending'))
    .catch(() => 'unreadable');
  return statusPromise;
}

export async function markReferralInvitePopupSeen(): Promise<void> {
  statusPromise = Promise.resolve('seen');
  await AsyncStorage.setItem(STORAGE_KEY, 'seen');
}
