import type { ChallengeToday } from "@/types/challenge";

/**
 * 스테이지가 그리는 상태와 그 판정.
 *
 * 카드가 아는 것은 자기 상태 하나뿐이다. 진행도 응답의 어떤 필드에서 그 상태가 나왔는지는
 * 여기서 끝나고, 카드는 `attemptStatus`도 `nextQuestionNumber`도 보지 않는다.
 */

/**
 * 문항 카드 하나의 상태.
 *
 * `gradingStatus`를 보지 않는다 — 채점 중이든 끝났든 눌렀을 때 갈 곳이 결과 화면으로
 * 같고, 채점 대기는 그 화면이 이미 소유하고 있다. 스테이지가 그것까지 알면 진행도를
 * 반복 조회할 이유가 생긴다.
 */
export type ChallengeStageCardStatus = "locked" | "next" | "done";

export interface ChallengeStageQuestion {
  questionNumber: number;
  status: ChallengeStageCardStatus;
}

export type ChallengeStageState =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      /** 서버가 정한 날짜. 문제·결과 화면으로 그대로 실어 보낸다. */
      date: string;
      questions: ChallengeStageQuestion[];
      /** 다 풀었으면 `null`. "한 문장 더"의 목적지이기도 하다. */
      nextQuestionNumber: number | null;
    };

/**
 * 이미 푼 문항인가, 지금 풀 차례인가, 아직 차례가 아닌가.
 *
 * `done`을 `attemptStatus`로 판정한다. 번호 비교(`nextQuestionNumber > questionNumber`)로도
 * 같은 답이 나오지만, 다 푼 날에는 `nextQuestionNumber`가 `null`이라 비교가 성립하지 않아
 * 모든 카드가 `locked`로 떨어진다. 서버가 문항마다 답을 이미 주고 있으므로 그것을 읽는다.
 */
export function resolveChallengeStageCardStatus(
  question: ChallengeToday["questions"][number],
  nextQuestionNumber: number | null,
): ChallengeStageCardStatus {
  if (question.attemptStatus === "submitted") return "done";
  if (question.questionNumber === nextQuestionNumber) return "next";
  return "locked";
}

/**
 * 조회 결과를 화면이 쓰는 세 상태로 옮긴다.
 *
 * 데이터를 오류보다 먼저 본다 — 진행도를 들고 있는 채로 뒤에서 돌던 갱신이 실패하면
 * 화면은 실패를 알리는 대신 갖고 있던 진행도를 계속 보여준다. 이력 화면
 * (`toHistoryPanelState`)이 같은 이유로 같은 순서를 쓴다.
 */
export function toChallengeStageState(query: {
  data: ChallengeToday | undefined;
  error: Error | null;
}): ChallengeStageState {
  if (query.data !== undefined) {
    const today = query.data;
    return {
      status: "ready",
      date: today.date,
      nextQuestionNumber: today.nextQuestionNumber,
      questions: today.questions.map((question) => ({
        questionNumber: question.questionNumber,
        status: resolveChallengeStageCardStatus(question, today.nextQuestionNumber),
      })),
    };
  }
  if (query.error !== null) return { status: "error" };
  return { status: "loading" };
}
