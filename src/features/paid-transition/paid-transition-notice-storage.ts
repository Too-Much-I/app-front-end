import AsyncStorage from '@react-native-async-storage/async-storage';

import { getStoredConsent } from '@/features/consent/consent-storage';

const STORAGE_KEY = 'paid-transition-notice';

const PAID_TRANSITION_NOTICE_STATUSES = ['pending', 'not-applicable', 'seen'] as const;

/**
 * 3.0.0 유료 전환 안내를 띄울지.
 *
 * - `pending`: 2.x를 쓰던 폰이라 아직 안내를 보여 줄 차례다.
 * - `not-applicable`: 3.0.0부터 쓴 폰이라 "그동안 감사했어요"가 맞지 않는다.
 * - `seen`: 안내를 닫았다.
 */
export type PaidTransitionNoticeStatus = (typeof PAID_TRANSITION_NOTICE_STATUSES)[number];

function isPaidTransitionNoticeStatus(value: string | null): value is PaidTransitionNoticeStatus {
  return PAID_TRANSITION_NOTICE_STATUSES.some((status) => status === value);
}

let statusPromise: Promise<PaidTransitionNoticeStatus> | null = null;

/**
 * 처음 부를 때 한 번 정해 저장하고, 앱이 켜져 있는 동안은 같은 결과를 돌려준다.
 *
 * 기존 사용자는 동의 기록으로 알아본다. 2.x 첫 실행 동의 화면에서 저장되고 탈퇴할 때만 지워진다.
 * 3.0.0 신규 설치자도 동의 화면을 거치면 기록이 생기므로, 동의 화면보다 먼저(앱 시작 때) 불러야 한다.
 */
export function loadPaidTransitionNoticeStatus(): Promise<PaidTransitionNoticeStatus> {
  statusPromise ??= resolvePaidTransitionNoticeStatus();
  return statusPromise;
}

async function resolvePaidTransitionNoticeStatus(): Promise<PaidTransitionNoticeStatus> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (isPaidTransitionNoticeStatus(stored)) return stored;

    const status: PaidTransitionNoticeStatus =
      (await getStoredConsent()) === null ? 'not-applicable' : 'pending';
    await AsyncStorage.setItem(STORAGE_KEY, status);
    return status;
  } catch {
    // 안내는 한 번 놓쳐도 괜찮지만, 잘못 판정해 신규 사용자에게 띄우면 어색하다.
    return 'not-applicable';
  }
}

export async function markPaidTransitionNoticeSeen(): Promise<void> {
  statusPromise = Promise.resolve('seen');
  await AsyncStorage.setItem(STORAGE_KEY, 'seen');
}
