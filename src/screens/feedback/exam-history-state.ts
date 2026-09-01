import {
  ExamHistoryContractError,
  type ExamHistoryItem,
} from "@/features/exam/map-exam-history";
import {
  ExamRetriesContractError,
  type ReanswerQuestionItem,
} from "@/features/exam/map-exam-retries";

/**
 * 두 탭이 공유하는 패널 상태와 그 판정.
 *
 * 조회 결과를 화면이 쓰는 세 상태로 좁히는 일이 여기 모여 있어서, 어떤 실패가 어떤
 * 화면으로 보이는지 이 파일만 보면 된다.
 */

/** 재시도해도 풀리지 않는 실패에 쓰는 안내. 앱과 서버 중 한쪽이 바뀌어야 한다. */
export const CONTRACT_ERROR_DESCRIPTION =
  "앱을 최신 버전으로 업데이트하면 해결될 수 있어요.";

/**
 * 조회 실패는 두 종류다.
 *
 * `retryable`은 네트워크·타임아웃·서버 오류처럼 나중에 풀릴 수 있는 실패다.
 * 계약 오류(서버 응답 형태와 앱의 기대가 어긋남)는 재시도해도 절대 안 풀리므로
 * 재시도 버튼을 주지 않는다 — 주면 사용자를 무의미한 반복으로 유도한다.
 */
type FailureKind = { retryable: boolean };

/** 두 탭이 같은 세 상태를 쓴다. 담는 항목만 다르다. */
export type HistoryPanelState<T> =
  | { status: "loading" }
  | ({ status: "error" } & FailureKind)
  | { status: "ready"; items: readonly T[] };

export type ExamHistoryState = HistoryPanelState<ExamHistoryItem>;

export type ReanswerHistoryState = HistoryPanelState<ReanswerQuestionItem>;

function isRetryableFailure(error: unknown): boolean {
  return !(
    error instanceof ExamHistoryContractError ||
    error instanceof ExamRetriesContractError
  );
}

/**
 * 조회 결과를 화면이 쓰는 상태로 옮긴다.
 *
 * 데이터를 오류보다 먼저 본다. 캐시에 목록이 있는 채로 뒤에서 돌던 갱신이 실패하면 화면은
 * 실패를 알리는 대신 갖고 있던 목록을 계속 보여준다 — 사용자가 할 일이 없는 실패다.
 */
export function toHistoryPanelState<T>(query: {
  data: readonly T[] | undefined;
  error: Error | null;
}): HistoryPanelState<T> {
  if (query.data !== undefined) return { status: "ready", items: query.data };
  if (query.error !== null) {
    return { status: "error", retryable: isRetryableFailure(query.error) };
  }
  return { status: "loading" };
}

/**
 * 재답변 패널의 상태는 두 조회에 걸쳐 있다.
 *
 * 대상 시험을 이력이 정해 주기 전에는 재답변 조회 자체가 시작되지 않으므로, 그때까지는
 * 이력 단계의 상태가 그대로 이 패널의 상태가 된다.
 */
export function resolveReanswerHistoryState(
  history: ExamHistoryState,
  targetExamId: string | null,
  query: { data: readonly ReanswerQuestionItem[] | undefined; error: Error | null },
): ReanswerHistoryState {
  if (history.status === "loading") return { status: "loading" };
  // 이력을 못 받으면 대상 시험을 못 정한다. 원인 구분은 이력 쪽 판정을 그대로 물려받는다.
  if (history.status === "error") {
    return { status: "error", retryable: history.retryable };
  }
  // 이력은 받았는데 재답변한 시험이 없다 — 조회할 것이 없는 정상 빈 상태다.
  if (targetExamId === null) return { status: "ready", items: [] };

  return toHistoryPanelState(query);
}
