import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { appAuthRuntime } from '@/features/auth/app-auth-runtime';
import type { ReferralApplyOutcome } from '@/features/referral/referral-application';

/** 팝업으로 알리는 결과. 적용됐거나 다시 보내도 같은 답인 거절이다. */
export type ReferralApplicationResult = Exclude<ReferralApplyOutcome, { kind: 'none' }>;

/**
 * 적용 결과 팝업의 상태.
 *
 * - `checking`: 아직 결과를 모른다. 뒤의 홈 팝업은 기다린다.
 * - `none`: 알릴 결과가 없다(입력하지 않았거나, 다음 실행에 다시 보내거나, 알리지 않는 실패).
 * - `open`: 떠 있다.
 * - `closing`: 닫았다. 팝업이 흐려지며 사라지는 동안에도 같은 결과를 그려야 해서 결과를 들고 있다.
 */
export type ReferralApplicationResultState =
  | { status: 'checking' }
  | { status: 'none' }
  | { status: 'open'; result: ReferralApplicationResult }
  | { status: 'closing'; result: ReferralApplicationResult };

/**
 * 홈이 보이면 가입 때 입력한 추천 코드를 적용하고, 결과가 처음 확정되면 한 번 알린다(2026-10-29 D4·D11 결정).
 * 가입 직후든 다음 실행이든 같다. 적용 담당이 실행마다 한 번만 보내므로 홈이 다시 보여도 다시 보내지 않는다.
 */
export function useReferralApplicationResult() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ReferralApplicationResultState>({ status: 'checking' });

  useEffect(() => {
    let active = true;
    void appAuthRuntime.referral.applyPending().then((outcome) => {
      // 무료권이 한 장 늘었다. 화면에 남은 이용권 조회를 다시 읽는다.
      if (outcome.kind === 'applied')
        void queryClient.invalidateQueries({ queryKey: ['entitlements'] });
      if (active)
        setState(
          outcome.kind === 'none' ? { status: 'none' } : { status: 'open', result: outcome },
        );
    });
    return () => {
      active = false;
    };
  }, [queryClient]);

  const dismiss = useCallback(
    () =>
      setState((current) =>
        current.status === 'open' ? { status: 'closing', result: current.result } : current,
      ),
    [],
  );

  return { state, dismiss };
}
