import { useCallback, useState } from 'react';

import { appAuthRuntime } from '@/features/auth/app-auth-runtime';

type WithdrawalDialogState =
  { status: 'closed' } | { status: 'open'; errorMessage?: string } | { status: 'pending' };

/**
 * 회원 탈퇴 확인 모달의 상태. 확인·진행·실패를 한 모달에서 보여준다(2026-10-07 시안 A, 문구 포함).
 * 탈퇴가 확정되면 루트가 탈퇴 안내로 바뀌어 이 화면은 사라진다. Apple 창을 닫으면 조용히 닫고 설정에 머문다.
 */
export function useAccountWithdrawal() {
  const [dialog, setDialog] = useState<WithdrawalDialogState>({ status: 'closed' });

  const open = useCallback(() => setDialog({ status: 'open' }), []);
  const cancel = useCallback(() => setDialog({ status: 'closed' }), []);

  const confirm = useCallback(async () => {
    setDialog({ status: 'pending' });
    const result = await appAuthRuntime.withdraw();
    switch (result.kind) {
      case 'failed':
        setDialog({ status: 'open', errorMessage: result.message });
        return;
      case 'cancelled':
      case 'session-ended':
      case 'withdrawn':
        setDialog({ status: 'closed' });
        return;
    }
  }, []);

  return {
    open,
    modal: {
      visible: dialog.status !== 'closed',
      pending: dialog.status === 'pending',
      errorMessage: dialog.status === 'open' ? dialog.errorMessage : undefined,
      onCancel: cancel,
      onConfirm: () => void confirm(),
    },
  };
}
