import { useEffect, useState } from "react";

import { getExamQuestionInfo } from "@/features/exam/api/exam-question-info";
import type { ExamQuestionInfo } from "@/types/exam";

interface ReanswerQuestionState {
  status: "loading" | "ready" | "failed";
  question: ExamQuestionInfo | null;
}

/**
 * 재답변 대상 문제를 한 번 조회한다.
 *
 * 회차와 무관하게 같은 문제 원문이므로 `retryCount`는 조회 조건에 넣지 않는다.
 * 실패하면 재시도하지 않고 화면이 안내를 띄운 뒤 사용자를 피드백으로 돌려보낸다 —
 * 문제를 못 읽은 채로는 답변할 수 없고, 재답변은 피드백에서 다시 시작하면 된다.
 */
export function useReanswerQuestion(examId: string, questionNumber: number) {
  const [state, setState] = useState<ReanswerQuestionState>({
    status: "loading",
    question: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading", question: null });

    getExamQuestionInfo(examId, questionNumber, controller.signal)
      .then((question) => {
        if (controller.signal.aborted) return;
        setState({ status: "ready", question });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("[Reanswer] 문제 조회 실패", error);
        setState({ status: "failed", question: null });
      });

    return () => controller.abort();
  }, [examId, questionNumber]);

  return state;
}
