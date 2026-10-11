import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { Button } from '@/components/ui/Button';
import { MascotModal } from '@/components/ui/MascotModal';
import { requestPushPermission, shouldAskPushPermission } from '@/features/push/push-permission';

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const bellRabbit = require('../../../../public/mascots/bell_rabbit.png');

/**
 * 알림 권한 사전 안내. 회원 화면에서 OS가 아직 묻지 않았으면 띄운다 — 가입 직후, 재설치, 새 폰 로그인 모두.
 * "나중에"는 없다. "다음"을 누르면 OS 팝업으로 넘어가고 허용·거절은 OS에서만 정한다(2026-10-11 결정).
 */
export function PushPermissionPrompt({ onAnswered }: { onAnswered: () => void }) {
  const [visible, setVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    let active = true;
    const check = () => {
      void shouldAskPushPermission().then((shouldAsk) => {
        if (active && shouldAsk) setVisible(true);
      });
    };
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const handleNext = useCallback(async () => {
    setRequesting(true);
    await requestPushPermission();
    setVisible(false);
    setRequesting(false);
    // 허용·거절 결과를 바로 서버에 보고한다.
    onAnswered();
  }, [onAnswered]);

  return (
    <MascotModal
      visible={visible}
      mascot={bellRabbit}
      message="꾸준한 공부를 위해 토선생이 알림을 보내는 걸 허락해주시겠어요?"
    >
      <Button
        className="mt-5 w-full"
        loading={requesting}
        disabled={requesting}
        label="다음"
        size="lg"
        onPress={() => void handleNext()}
      />
    </MascotModal>
  );
}
