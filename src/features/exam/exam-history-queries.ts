import { queryOptions, skipToken } from "@tanstack/react-query";

import { getExamHistory } from "@/features/exam/api/exam-history";
import { getExamRetries } from "@/features/exam/api/exam-retries";

/**
 * 이력을 신선하다고 보는 시간.
 *
 * 이력은 새 시험이 채점을 마쳐야 바뀐다. 회차를 열어보고 목록으로 돌아오는 왕복에는 요청이
 * 아예 나가지 않을 만큼 길고, 채점을 막 끝낸 사용자가 옛 목록을 마주치지는 않을 만큼 짧다.
 * 이 시간이 지나도 화면은 캐시를 먼저 보여주고 갱신은 뒤에서 일어난다.
 */
const EXAM_HISTORY_STALE_TIME_MS = 30_000;

export function examHistoryQueryOptions() {
  return queryOptions({
    queryKey: ["exam", "history"],
    queryFn: ({ signal }) => getExamHistory(signal),
    staleTime: EXAM_HISTORY_STALE_TIME_MS,
  });
}

/**
 * 재답변 이력은 시험 단위 조회라 대상 시험이 정해져야 시작할 수 있다.
 *
 * 대상이 없을 때 `skipToken`을 주는 이유는 자리표시자 examId를 만들지 않기 위해서다.
 * 빈 문자열을 넣고 `enabled`로 막으면 타입상으로는 언제나 조회 가능한 것처럼 보이지만,
 * 이쪽은 queryFn이 없다는 사실이 타입에 그대로 남는다.
 */
export function examRetriesQueryOptions(examId: string | null) {
  return queryOptions({
    queryKey: ["exam", "retries", examId],
    queryFn:
      examId === null
        ? skipToken
        : ({ signal }: { signal: AbortSignal }) => getExamRetries(examId, signal),
    staleTime: EXAM_HISTORY_STALE_TIME_MS,
  });
}
