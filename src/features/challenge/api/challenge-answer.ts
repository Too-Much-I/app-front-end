import {
  challengeAnswerAcceptedSchema,
  mapChallengeAnswerAccepted,
} from "@/features/challenge/map-challenge-answer";
import { apiFetch } from "@/lib/api/client";
import { parseApiResult } from "@/lib/api/parse-api-result";
import type { ApiEnvelope } from "@/types/api";
import type { ChallengeAnswerAccepted } from "@/types/challenge";

/**
 * S3 업로드가 끝났음을 서버에 알린다. 여기서 비로소 공개 상태가 `submitted`가 된다.
 *
 * `idempotencyKey`는 이 녹음 한 건에 대해 성공할 때까지 같은 값을 써야 한다. 같은 키와
 * 같은 본문이면 서버가 기존 성공 결과를 그대로 돌려주므로, 응답이 유실됐을 때 다시 보내도
 * 응시가 두 번 소비되지 않는다.
 *
 * 응답의 `referenceAnswer`는 AI 처리와 무관하게 즉시 온다. 결과 화면이 첫 조회를
 * 기다리지 않고 바로 그릴 수 있도록 호출부가 그대로 들고 간다.
 */
export async function submitChallengeAnswer(
  questionNumber: number,
  attemptId: string,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<ChallengeAnswerAccepted> {
  const { result } = await apiFetch<ApiEnvelope<unknown>>(
    `/api/v1/challenges/today/questions/${questionNumber}/answer`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ attemptId }),
      signal,
    },
  );
  return mapChallengeAnswerAccepted(
    parseApiResult(challengeAnswerAcceptedSchema, result, "CHALLENGE_ANSWER"),
  );
}
