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

async function resolveQuestion(
  challengeDate: string | undefined,
  questionNumber: number,
  signal: AbortSignal,
) {
  const date = challengeDate ?? (await getChallengeToday(signal)).date;
  return getChallengeTodayQuestion(date, questionNumber, signal);
}
