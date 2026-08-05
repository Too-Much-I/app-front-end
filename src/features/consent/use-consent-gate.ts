import { useEffect, useState } from "react";

import { CONSENT_VERSION, getStoredConsent } from "@/features/consent/consent-storage";

type ConsentGateState = {
  /** 저장소 조회가 끝났는지. `App.tsx`가 폰트 로딩과 함께 기다렸다가 스플래시를 내린다. */
  ready: boolean;
  hasConsented: boolean;
};

/**
 * 조회 실패(드문 I/O 오류 등)는 동의하지 않은 것으로 간주한다.
 * 실패를 동의 완료로 잘못 해석해 메인 탭으로 들여보내면 안 되기 때문이다.
 */
export function useConsentGate(): ConsentGateState {
  const [state, setState] = useState<ConsentGateState>({ ready: false, hasConsented: false });

  useEffect(() => {
    let cancelled = false;

    getStoredConsent()
      .then((record) => {
        if (cancelled) {
          return;
        }
        setState({ ready: true, hasConsented: record?.version === CONSENT_VERSION });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setState({ ready: true, hasConsented: false });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
