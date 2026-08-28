import { useCallback, useEffect, useRef, useState } from "react";

import { getChallengeDayResult } from "@/features/challenge/api/challenge-day-result";
import {
  createDevMockDayResult,
  withDevMockFallback,
} from "@/features/challenge/dev-mock-challenge";
import type {
  ChallengeDayResult,
  ChallengeQuestionResult,
  ChallengeResultSeed,
} from "@/types/challenge";

/** 명세 8절 권장 주기 — 2초에서 시작해 5초까지 늘린다. 이후에는 5초를 유지한다. */
const POLL_INTERVALS_MS = [2_000, 2_500, 3_000, 3_500, 4_000, 4_500, 5_000] as const;
/** 화면을 열어둔 채 무한정 물어보지는 않는다. 넘기면 "다시 확인하기"를 내준다. */
const POLL_BUDGET_MS = 180_000;

export type ChallengeResultStatus =
  | "loading"
  /** AI 처리 중. 참고 답안은 이미 보여줄 수 있다. */
  | "grading"
  | "completed"
  /** AI가 실패했다. 사용자 재응시 사유가 아니라 서버 복구 대상이다. */
  | "grading-failed"
  | "timed-out"
  /** 그날 이 문제를 풀지 않았다 — 결과가 존재하지 않는다. */
  | "not-attempted"
  | "load-failed";

interface ChallengeResultState {
  status: ChallengeResultStatus;
  question: ChallengeQuestionResult | null;
}

function toSeededState(seed?: ChallengeResultSeed): ChallengeResultState {
  if (!seed) return { status: "loading", question: null };

  return {
    status: resolveSeedStatus(seed.gradingStatus),
    question: {
      questionNumber: seed.questionNumber,
      promptKo: seed.promptKo,
      gradingStatus: seed.gradingStatus,
      referenceAnswer: seed.referenceAnswer,
      // 접수 시점에는 아직 없는 값들이다. 폴링이 끝나면 조회 결과가 덮는다.
      audioUrl: null,
      hasAiResult: false,
    },
  };
}

function resolveSeedStatus(
  gradingStatus: ChallengeResultSeed["gradingStatus"],
): ChallengeResultStatus {
  if (gradingStatus === "completed") return "completed";
  if (gradingStatus === "failed") return "grading-failed";
  return "grading";
}

function getPollIntervalMs(round: number): number {
  return POLL_INTERVALS_MS[round] ?? POLL_INTERVALS_MS[POLL_INTERVALS_MS.length - 1] ?? 5_000;
}

/**
 * 결과 화면의 조회와 채점 대기.
 *
 * `gradingStatus`가 `pending|processing`인 동안만 다시 물어본다. 조회 자체가 실패하면
 * 바로 실패로 넘기지 않고 예산 안에서는 조용히 다시 시도한다 — 제출은 이미 접수됐으므로
 * 네트워크가 잠깐 끊긴 것과 채점이 실패한 것을 같은 화면으로 보여줄 이유가 없다.
 */
export function useChallengeResult(
  challengeDate: string,
  questionNumber: number,
  /** 제출 접수 응답이 준 값. 있으면 첫 조회를 기다리지 않고 그 상태로 시작한다. */
  seed?: ChallengeResultSeed,
) {
  const [state, setState] = useState<ChallengeResultState>(() => toSeededState(seed));
  const [attempt, setAttempt] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const deadline = Date.now() + POLL_BUDGET_MS;
    let round = 0;
    let hasLoadedOnce = false;
    // 이미 그릴 것이 있으면(씨앗 값이나 직전 조회 결과) 스피너로 되돌리지 않는다.
    setState((current) =>
      current.question ? current : { status: "loading", question: null },
    );

    const check = async () => {
      if (controller.signal.aborted) return;

      try {
        const dayResult = await loadDayResult(
          challengeDate,
          questionNumber,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        hasLoadedOnce = true;

        const question = dayResult.question;
        if (!question) {
          setState({ status: "not-attempted", question: null });
          return;
        }
        if (question.gradingStatus === "completed") {
          setState({ status: "completed", question });
          return;
        }
        if (question.gradingStatus === "failed") {
          setState({ status: "grading-failed", question });
          return;
        }
        // not_requested는 만료된 제출이다. 참고 답안은 있으니 그 상태로 멈춘다.
        if (question.gradingStatus === "not_requested") {
          setState({ status: "completed", question });
          return;
        }
        setState({ status: "grading", question });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("[Challenge] 결과 조회 실패", error);
        if (!hasLoadedOnce && Date.now() >= deadline) {
          setState({ status: "load-failed", question: null });
          return;
        }
      }

      if (Date.now() >= deadline) {
        setState((current) => ({
          status: hasLoadedOnce ? "timed-out" : "load-failed",
          question: current.question,
        }));
        return;
      }

      timerRef.current = setTimeout(() => void check(), getPollIntervalMs(round));
      round += 1;
    };

    void check();

    return () => {
      controller.abort();
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [attempt, challengeDate, questionNumber]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  return { ...state, retry };
}

/**
 * 임시: 백엔드가 붙기 전까지 응답이 없으면 목 데이터로 대신한다.
 * 서버가 준비되면 `__DEV__` 분기와 `dev-mock-challenge`를 함께 지운다.
 */
function loadDayResult(
  challengeDate: string,
  questionNumber: number,
  signal: AbortSignal,
): Promise<ChallengeDayResult> {
  const load = () => getChallengeDayResult(challengeDate, questionNumber, signal);
  if (!__DEV__) return load();

  return withDevMockFallback(load, () =>
    createDevMockDayResult(challengeDate, questionNumber),
  );
}
