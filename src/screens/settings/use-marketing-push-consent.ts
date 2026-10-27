import { useCallback, useEffect, useRef, useState } from 'react';

import { appAuthRuntime } from '@/features/auth/app-auth-runtime';
import { reportOperationalError } from '@/lib/operational-error-reporting';

const { readMarketingPushConsent, setMarketingPushConsent } = appAuthRuntime.consent;

/**
 * 알림 설정의 "이벤트·혜택 알림" 스위치. 답변 검토 스위치(`useQualityReviewConsent`)와 같이 먼저 바꾸고, 서버 반영이
 * 실패하면 저장해 둔 이전 값으로 되돌린다.
 *
 * `available`이 false면 서버가 광고성 푸시 항목을 주지 않는 것(운영 배포 전)이라 화면이 스위치를 그리지 않는다.
 */
export function useMarketingPushConsent() {
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    readMarketingPushConsent()
      .then((value) => {
        if (cancelled) return;
        setAvailable(value !== null);
        setEnabled(value ?? false);
        setIsLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setIsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(async () => {
    if (isUpdatingRef.current || !isLoaded || !available) return;
    isUpdatingRef.current = true;

    const previous = enabled;
    setEnabled(!previous);
    setHasError(false);
    try {
      await setMarketingPushConsent(!previous);
    } catch (error) {
      reportOperationalError({
        code: 'QUALITY_REVIEW_CONSENT_UPDATE_FAILED',
        operation: 'set-marketing-push-consent',
        cause: error,
      });
      setEnabled(previous);
      setHasError(true);
    } finally {
      isUpdatingRef.current = false;
    }
  }, [available, enabled, isLoaded]);

  return { enabled, available, isLoaded, hasError, toggle };
}
