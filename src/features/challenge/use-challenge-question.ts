import { useCallback, useEffect, useState } from "react";

import { getChallengeToday } from "@/features/challenge/api/challenge-today";
import { DEV_MOCK_CHALLENGE_QUESTION } from "@/features/challenge/dev-mock-challenge";
import { getChallengeTodayQuestion } from "@/features/challenge/api/challenge-today-question";
import type { ChallengeQuestion } from "@/types/challenge";

interface ChallengeQuestionState {
  status: "loading" | "ready" | "failed";
  question: ChallengeQuestion | null;
}

/**
 * 오늘의 챌린지 문제를 한 번 조회하고, 실패하면 같은 자리에서 다시 시도하게 한다.
 *
 * 재답변(`useReanswerQuestion`)과 달리 실패 시 화면을 떠나보내지 않는다 — 챌린지는
 * 하루 한 번의 짧은 루프라 스테이지로 되돌아갔다 다시 들어오는 왕복이 과제 자체보다 길다.
 */
export function useChallengeQuestion(
  /**
   * 스테이지가 넘겨준 서버 기준 날짜. 없으면 오늘 진행도를 먼저 읽어 알아낸다 —
   * 앱이 기기 시계로 KST 날짜를 만들면 자정 근처에서 서버와 갈린다.
   */
  challengeDate: string | undefined,
  questionNumber: number,
) {
  const [state, setState] = useState<ChallengeQuestionState>({
    status: "loading",
    question: null,
  });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (__DEV__) {
      setState({
        status: "ready",
        question: { ...DEV_MOCK_CHALLENGE_QUESTION, questionNumber },
      });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading", question: null });

    resolveQuestion(challengeDate, questionNumber, controller.signal)
      .then((question) => {
        if (controller.signal.aborted) return;
        setState({ status: "ready", question });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("[Challenge] 문제 조회 실패", error);
        setState({ status: "failed", question: null });
      });

    return () => controller.abort();
  }, [challengeDate, questionNumber, reloadCount]);

  const retry = useCallback(() => setReloadCount((count) => count + 1), []);

  return { ...state, retry };
}

/**
 * 넘겨받은 날짜가 없으면 오늘 진행도에서 알아 온다.
 *
 * 지금은 `challengeDate`가 항상 `undefined`다 — 유일한 진입점인 홈 배너가 문제 번호만
 * 넘긴다. 그래서 재조회 때마다 서버 날짜를 새로 받아 오고, 자정을 넘긴 화면도 재시도
 * 한 번으로 회복한다.
 *
 * 스테이지 화면이 날짜를 넘기기 시작하면 이 성질이 사라진다. 고정된 `challengeDate`로
 * 계속 조회하므로 `CHALLENGE_DATE_CHANGED`가 나면 재시도가 같은 실패를 반복한다.
 * 그때는 이 오류를 따로 받아 상위에 진행도 갱신을 요청해야 한다.
 */
async function resolveQuestion(
  challengeDate: string | undefined,
  questionNumber: number,
  signal: AbortSignal,
) {
  const date = challengeDate ?? (await getChallengeToday(signal)).date;
  return getChallengeTodayQuestion(date, questionNumber, signal);
}
