import { useCallback, useEffect, useState } from 'react';

import {
  loadPaidTransitionNoticeStatus,
  markPaidTransitionNoticeSeen,
} from '@/features/paid-transition/paid-transition-notice-storage';

/**
 * - `loading`: 띄울지 아직 모른다. 뒤에 띄울 홈 팝업(친구 초대)은 기다린다.
 * - `visible`: 떠 있다.
 * - `hidden`: 띄우지 않거나 닫았다.
 */
export type PaidTransitionNoticeState = 'loading' | 'visible' | 'hidden';

/** 홈 화면에서 유료 전환 안내를 한 번 띄우고, 닫으면 다시 띄우지 않는다. */
export function usePaidTransitionNotice() {
  const [state, setState] = useState<PaidTransitionNoticeState>('loading');

  useEffect(() => {
    let active = true;
    void loadPaidTransitionNoticeStatus().then((status) => {
      if (active) setState(status === 'pending' ? 'visible' : 'hidden');
    });
    return () => {
      active = false;
    };
  }, []);

  const dismiss = useCallback(() => {
    setState('hidden');
    // 저장에 실패하면 다음 실행에 한 번 더 뜬다. 막을 만큼의 일은 아니다.
    void markPaidTransitionNoticeSeen().catch(() => undefined);
  }, []);

  return { state, dismiss };
}
