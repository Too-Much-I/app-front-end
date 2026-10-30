import { useCallback, useEffect, useState } from 'react';

import {
  loadPaidTransitionNoticeStatus,
  markPaidTransitionNoticeSeen,
} from '@/features/paid-transition/paid-transition-notice-storage';

/**
 * 홈 화면에서 유료 전환 안내를 한 번 띄우고, 닫으면 다시 띄우지 않는다. `settled`는 띄울지 정해졌다는 뜻이다 —
 * 뒤에 띄울 홈 팝업(친구 초대)이 이 안내보다 먼저 뜨지 않게 기다리는 데 쓴다.
 */
export function usePaidTransitionNotice() {
  const [visible, setVisible] = useState(false);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let active = true;
    void loadPaidTransitionNoticeStatus().then((status) => {
      if (!active) return;
      if (status === 'pending') setVisible(true);
      setSettled(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    // 저장에 실패하면 다음 실행에 한 번 더 뜬다. 막을 만큼의 일은 아니다.
    void markPaidTransitionNoticeSeen().catch(() => undefined);
  }, []);

  return { visible, settled, dismiss };
}
