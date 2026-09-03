import { useCallback, useEffect, useState } from "react";

import { getChallengeToday } from "@/features/challenge/api/challenge-today";
import { getChallengeErrorCode } from "@/features/challenge/challenge-error-codes";
import { DEV_MOCK_CHALLENGE_QUESTION } from "@/features/challenge/dev-mock-challenge";
import { getChallengeTodayQuestion } from "@/features/challenge/api/challenge-today-question";
import type { ChallengeQuestion } from "@/types/challenge";

interface ChallengeQuestionState {
  status: "loading" | "ready" | "failed";
  question: ChallengeQuestion | null;
  /**
   * 실패한 이유의 서버 코드. 실패가 아니면 `null`이다.
   *
   * 화면이 재시도 버튼을 줄지, 진행도부터 다시 읽어야 하는지를 이 값으로 가른다.
   * attempt 발급(`useChallengeAttempt`)이 같은 이유로 같은 값을 내보낸다.
   */
  errorCode: string | null;
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
    errorCode: null,
  });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (__DEV__) {
      setState({
        status: "ready",
        question: { ...DEV_MOCK_CHALLENGE_QUESTION, questionNumber },
        errorCode: null,
      });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading", question: null, errorCode: null });

    resolveQuestion(challengeDate, questionNumber, controller.signal)
      .then((question) => {
        if (controller.signal.aborted) return;
        setState({ status: "ready", question, errorCode: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("[Challenge] 문제 조회 실패", error);
        setState({
          status: "failed",
          question: null,
          errorCode: getChallengeErrorCode(error),
        });
      });

    return () => controller.abort();
  }, [challengeDate, questionNumber, reloadCount]);

  const retry = useCallback(() => setReloadCount((count) => count + 1), []);

  return { ...state, retry };
}

/**
 * 넘겨받은 날짜가 없으면 오늘 진행도에서 알아 온다.
 *
 * 스테이지가 날짜를 넘기므로 이 조회는 그 날짜에 고정된다. 자정을 넘겨
 * `CHALLENGE_DATE_CHANGED`가 나면 같은 날짜로 다시 물어도 결과가 같으므로, 화면은
 * 재시도를 내주는 대신 `errorCode`를 보고 스테이지로 돌아가 진행도부터 다시 읽는다.
 *
 * 날짜 없이 부르는 경로도 남겨둔다 — 그때는 오늘 진행도에서 날짜를 알아 온다.
 */
async function resolveQuestion(
  challengeDate: string | undefined,
  questionNumber: number,
  signal: AbortSignal,
) {
  const date = challengeDate ?? (await getChallengeToday(signal)).date;
  return getChallengeTodayQuestion(date, questionNumber, signal);
}
