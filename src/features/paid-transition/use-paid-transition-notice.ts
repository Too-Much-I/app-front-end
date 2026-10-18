import { useCallback, useEffect, useState } from 'react';

import {
  loadPaidTransitionNoticeStatus,
  markPaidTransitionNoticeSeen,
} from '@/features/paid-transition/paid-transition-notice-storage';

/** 홈 화면에서 유료 전환 안내를 한 번 띄우고, 닫으면 다시 띄우지 않는다. */
export function usePaidTransitionNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    void loadPaidTransitionNoticeStatus().then((status) => {
      if (active && status === 'pending') setVisible(true);
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

  return { visible, dismiss };
}
