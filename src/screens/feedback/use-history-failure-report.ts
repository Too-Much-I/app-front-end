import { useEffect, useRef } from "react";

import { reportOperationalError } from "@/lib/operational-error-reporting";

/**
 * 화면이 실제로 오류를 보여주는 동안 한 번만 운영 오류로 보고한다.
 *
 * 목록을 띄운 채 실패한 백그라운드 갱신은 여기 오지 않는다 — `reportOperationalError`는
 * 사용자 흐름을 막은 실패만 받는다. 호출부는 그래서 화면에 보일 오류만 넘긴다.
 *
 * `attempt`를 ref로 세는 이유는 라이브러리의 `failureCount`가 재조회를 시작할 때 0으로
 * 돌아가기 때문이다. 알고 싶은 것은 이번 요청의 실패 횟수가 아니라 사용자가 이 화면에서
 * 몇 번째로 실패를 마주쳤는가다.
 */
export function useHistoryFailureReport(
  surface: "exam-history" | "reanswer-history",
  logMessage: string,
  error: Error | null,
) {
  const attemptRef = useRef(0);

  useEffect(() => {
    if (error === null) return;
    attemptRef.current += 1;
    // 화면 문구만으로는 네트워크·서버·계약 중 무엇이었는지 알 수 없다.
    console.error(logMessage, error);
    reportOperationalError({
      code: "FEEDBACK_HISTORY_LOAD_FAILED",
      surface,
      attempt: attemptRef.current,
      cause: error,
    });
  }, [error, logMessage, surface]);
}
