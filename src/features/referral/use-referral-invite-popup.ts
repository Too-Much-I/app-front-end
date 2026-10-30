import { useCallback, useEffect, useState } from 'react';

import {
  loadReferralInvitePopupStatus,
  markReferralInvitePopupSeen,
} from '@/features/referral/referral-invite-popup-storage';

/**
 * - `loading`: 기록을 읽는 중이다.
 * - `pending`: 띄울 차례를 기다린다. 다른 홈 팝업이 먼저다(2026-10-29 D11 결정).
 * - `showing`: 떠 있다. 뜬 순간 본 것으로 기록했다.
 * - `done`: 띄우지 않거나 닫았다. 기록하지 않고 닫으면 다음 실행에 다시 뜬다.
 */
export type ReferralInvitePopupState = 'loading' | 'pending' | 'showing' | 'done';

/** 이 기기에서 친구 초대 팝업을 한 번 띄운다. 언제 띄울지는 홈이 `show`로 정한다. */
export function useReferralInvitePopup() {
  const [state, setState] = useState<ReferralInvitePopupState>('loading');

  useEffect(() => {
    let active = true;
    void loadReferralInvitePopupStatus().then((status) => {
      // 읽는 사이 닫았으면 그대로 둔다.
      if (active)
        setState((current) =>
          current === 'loading' ? (status === 'pending' ? 'pending' : 'done') : current,
        );
    });
    return () => {
      active = false;
    };
  }, []);

  const show = useCallback(() => {
    setState((current) => (current === 'pending' ? 'showing' : current));
    // 저장에 실패하면 다음 실행에 한 번 더 뜬다. 막을 만큼의 일은 아니다.
    void markReferralInvitePopupSeen().catch(() => undefined);
  }, []);

  const close = useCallback(() => setState('done'), []);

  return { state, show, close };
}
