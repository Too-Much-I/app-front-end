import { useCallback, useState } from 'react';

import {
  ACCOUNT_WITHDRAWAL_MESSAGES,
  type AccountWithdrawalResult,
} from '@/features/auth/account-withdrawal';
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
    let result: AccountWithdrawalResult;
    try {
      result = await appAuthRuntime.withdraw();
    } catch {
      // 탈퇴 흐름은 결과로 답한다. 예상 밖으로 던져도 모달이 진행 중에 갇히지 않게 한다.
      setDialog({ status: 'open', errorMessage: ACCOUNT_WITHDRAWAL_MESSAGES.failed });
      return;
    }
    switch (result.kind) {
      case 'failed':
        setDialog({ status: 'open', errorMessage: result.message });
        return;
      case 'cancelled':
      case 'session-ended':
      case 'withdrawn':
        setDialog({ status: 'closed' });
        return;
      default: {
        const unhandled: never = result;
        throw new Error(`처리하지 않은 탈퇴 결과: ${JSON.stringify(unhandled)}`);
      }
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
