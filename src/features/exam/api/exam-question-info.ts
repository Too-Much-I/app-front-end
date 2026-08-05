import { mapExamQuestionInfo } from "@/features/exam/map-exam-question-info";
import { apiFetchWithAuthRetry } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type {
  ExamQuestionInfo,
  RawExamQuestionDetailResult,
} from "@/types/exam";

/**
 * 재답변 화면이 그릴 문제 원문 하나를 가져온다.
 *
 * 문제만 내려주는 전용 엔드포인트가 준비되기 전까지는 문제별 피드백 조회의
 * `questionInfo`를 재사용한다 — 같은 문제의 같은 원문이라 화면에 필요한 값은 모두 들어 있다.
 * 채점 결과(점수·피드백)는 이 화면에서 쓰지 않으므로 매핑하지 않는다.
 *
 * 전용 API가 나오면 이 함수의 요청 경로와 매핑 대상만 바꾸면 되고, 화면은 그대로 둔다.
 */
export async function getExamQuestionInfo(
  examId: string,
  questionNumber: number,
  signal?: AbortSignal,
): Promise<ExamQuestionInfo> {
  const { result } = await apiFetchWithAuthRetry<ApiEnvelope<RawExamQuestionDetailResult>>(
    `/api/v1/exams/${examId}/questions?questionNumber=${questionNumber}&retryCount=0`,
    { signal },
  );
  return mapExamQuestionInfo(result.question.questionInfo);
}
