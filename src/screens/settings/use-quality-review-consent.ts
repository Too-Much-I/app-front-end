import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/features/auth/auth-context";
import { reportOperationalError } from "@/lib/operational-error-reporting";

/**
 * 설정 화면의 "채점 품질 개선을 위한 답변 검토" 스위치.
 *
 * 낙관적으로 먼저 켜고 끈 뒤 서버 반영이 실패하면 되돌린다. 네트워크 왕복을
 * 기다리는 동안 스위치가 멈춰 있으면 눌리지 않은 것처럼 보여 연타를 부른다.
 *
 * 되돌릴 때 `setEnabled(!next)`가 아니라 저장해 둔 이전 값을 쓴다. 요청이 도는
 * 사이에 다른 경로가 값을 바꿨을 수 있어 부정 연산은 안전하지 않다.
 */
export function useQualityReviewConsent() {
  const { readQualityReviewConsent, setQualityReviewConsent } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  // 상태 반영 전 한 프레임 동안의 연타를 막는다.
  const isUpdatingRef = useRef(false);
  /**
   * 초기 로드를 한 번으로 잠근다.
   *
   * `useAuth()`가 주는 함수는 인증 상태가 바뀔 때마다 새 참조로 만들어지므로,
   * 그대로 의존성에 두면 이펙트가 다시 돈다. 서버 반영을 기다리는 사이에 다시
   * 돌면 아직 갱신되지 않은 저장소 값을 읽어 스위치가 되돌아간다.
   */
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (hasLoadedRef.current) {
      return;
    }
    hasLoadedRef.current = true;

    let cancelled = false;
    readQualityReviewConsent()
      .then((value) => {
        if (cancelled) return;
        setEnabled(value);
        setIsLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setIsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [readQualityReviewConsent]);

  const toggle = useCallback(async () => {
    if (isUpdatingRef.current || !isLoaded) {
      return;
    }
    isUpdatingRef.current = true;

    const previous = enabled;
    const next = !previous;
    setEnabled(next);
    setHasError(false);

    try {
      await setQualityReviewConsent(next);
    } catch (error) {
      console.error("[Settings] 선택 동의 변경 실패", error);
      reportOperationalError({
        code: "QUALITY_REVIEW_CONSENT_UPDATE_FAILED",
        operation: "set-quality-review-consent",
        cause: error,
      });
      setEnabled(previous);
      setHasError(true);
    } finally {
      isUpdatingRef.current = false;
    }
  }, [enabled, isLoaded, setQualityReviewConsent]);

  return { enabled, isLoaded, hasError, toggle };
}
