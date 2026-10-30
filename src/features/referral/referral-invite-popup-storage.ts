import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'referral-invite-popup';

/**
 * 친구 초대 팝업을 띄울지. 기기 기준이다(2026-10-29 D11 결정).
 *
 * - `pending`: 이 기기에서 가입을 마쳤고 아직 팝업이 뜨지 않았다.
 * - `seen`: 팝업이 떴다. 누르거나 닫지 않아도 뜬 순간 본 것으로 친다.
 * - 기록 없음: 이 기기에서 가입하지 않았다. 업데이트를 받은 기존 회원에게는 띄우지 않는다.
 */
export type ReferralInvitePopupStatus = 'pending' | 'seen' | 'none';

let statusPromise: Promise<ReferralInvitePopupStatus> | null = null;

/** 앱이 켜져 있는 동안 같은 결과를 돌려준다. 가입·표시가 바꾼 값은 아래 두 함수가 함께 고친다. */
export function loadReferralInvitePopupStatus(): Promise<ReferralInvitePopupStatus> {
  statusPromise ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((stored): ReferralInvitePopupStatus =>
      stored === 'pending' || stored === 'seen' ? stored : 'none',
    )
    // 한 번 놓쳐도 괜찮은 안내다. 읽지 못하면 띄우지 않는다.
    .catch(() => 'none');
  return statusPromise;
}

/** 가입을 마쳤을 때. 이미 떴으면 다시 띄우지 않는다 — 같은 기기에서 다시 가입해도 한 번이다. */
export async function markReferralInvitePopupPending(): Promise<void> {
  if ((await loadReferralInvitePopupStatus()) === 'seen') return;
  statusPromise = Promise.resolve('pending');
  await AsyncStorage.setItem(STORAGE_KEY, 'pending');
}

export async function markReferralInvitePopupSeen(): Promise<void> {
  statusPromise = Promise.resolve('seen');
  await AsyncStorage.setItem(STORAGE_KEY, 'seen');
}
