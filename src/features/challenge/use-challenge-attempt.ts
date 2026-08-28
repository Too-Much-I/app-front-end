import { useCallback, useEffect, useState } from "react";

import { createChallengeAttempt } from "@/features/challenge/api/challenge-attempt";
import { getChallengeErrorCode } from "@/features/challenge/challenge-error-codes";
import { createDevMockAttempt } from "@/features/challenge/dev-mock-challenge";
import type { ChallengeAttempt, ChallengeQuestion } from "@/types/challenge";

export type ChallengeAttemptRequestStatus = "idle" | "creating" | "ready" | "failed";

interface ChallengeAttemptState {
  status: ChallengeAttemptRequestStatus;
  attempt: ChallengeAttempt | null;
  /** 실패했을 때 서버가 준 코드. 화면이 결과·스테이지 중 어디로 보낼지 판단한다. */
  errorCode: string | null;
}

/**
 * 문제가 도착하면 곧바로 attempt를 발급받는다. 녹음은 이게 성공한 뒤에만 시작한다.
 *
 * 제출 버튼이 아니라 여기서 만드는 이유는 날짜 때문이다. attempt 생성은 서버의 현재
 * 날짜를 검사하는 유일한 요청이고, 그 뒤의 단계는 `attemptId`만 쓴다. 사용자가 자기
 * 녹음을 들어보고 다시 녹음하는 동안 자정이 지나도, 이미 발급된 attempt가 정한 날짜로
 * `submissionDeadlineAt`(생성 + 1시간)까지 제출할 수 있다.
 *
 * 화면이 다시 마운트되거나 재시도가 걸려도 응시를 두 번 소비하지 않는다 — 제출 전
 * attempt가 남아 있으면 서버가 같은 `attemptId`를 돌려주기 때문이다(명세 6.3).
 */
export function useChallengeAttempt(question: ChallengeQuestion | null) {
  const [state, setState] = useState<ChallengeAttemptState>({
    status: "idle",
    attempt: null,
    errorCode: null,
  });
  const [reloadCount, setReloadCount] = useState(0);

  // 문제 객체가 아니라 값에 의존한다. 조회가 같은 문제를 다시 주더라도 재발급하지 않는다.
  const date = question?.date;
  const questionNumber = question?.questionNumber;

  useEffect(() => {
    if (date === undefined || questionNumber === undefined) return;
    // 이미 끝난 응시면 서버가 409로 거절한다. 화면이 결과로 보낼 참이라 부르지 않는다.
    if (question?.attemptStatus === "submitted") return;

    if (__DEV__) {
      setState({
        status: "ready",
        attempt: createDevMockAttempt(date, questionNumber),
        errorCode: null,
      });
      return;
    }

    const controller = new AbortController();
    setState({ status: "creating", attempt: null, errorCode: null });

    createChallengeAttempt(date, questionNumber, controller.signal)
      .then((attempt) => {
        if (controller.signal.aborted) return;
        setState({ status: "ready", attempt, errorCode: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("[Challenge] attempt 생성 실패", error);
        setState({
          status: "failed",
          attempt: null,
          errorCode: getChallengeErrorCode(error),
        });
      });

    return () => controller.abort();
  }, [date, question?.attemptStatus, questionNumber, reloadCount]);

  const retry = useCallback(() => setReloadCount((count) => count + 1), []);

  return { ...state, retry };
}
