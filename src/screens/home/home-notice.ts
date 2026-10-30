import type { ReferralApplicationResultState } from '@/features/referral/use-referral-application-result';
import type { ReferralInvitePopupState } from '@/features/referral/use-referral-invite-popup';

/** 홈에 한 번에 하나만 띄우는 팝업. 모달이 겹치면 뒤의 것이 앞을 가리거나 닫히지 않는다. */
export type HomeNotice = 'referral-result' | 'paid-transition' | 'referral-invite' | null;

/**
 * 추천 코드 결과 → 유료 전환 안내 → 친구 초대 순서로 띄운다(2026-10-29 D11 결정). 친구 초대는 광고성이라
 * 마지막이다 — 누르면 다른 팝업을 보지 않고 친구 초대 화면으로 넘어가 버린다. 앞의 것이 정해지지 않았으면
 * 뒤의 것은 기다린다.
 */
export function pickHomeNotice(input: {
  referralResult: ReferralApplicationResultState;
  paidTransition: { settled: boolean; visible: boolean };
  referralInvite: ReferralInvitePopupState;
}): HomeNotice {
  const { referralResult, paidTransition, referralInvite } = input;
  if (referralResult.status === 'checking') return null;
  if (referralResult.status === 'open') return 'referral-result';
  if (!paidTransition.settled) return null;
  if (paidTransition.visible) return 'paid-transition';
  if (referralInvite === 'pending' || referralInvite === 'showing') return 'referral-invite';
  return null;
}
