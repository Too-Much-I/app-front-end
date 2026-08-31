import { mapChallengeUploadUrl } from "@/features/challenge/map-challenge-question";
import { apiFetch } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api";
import type { ChallengeUploadUrl, RawChallengeUploadUrl } from "@/types/challenge";

/**
 * 녹음이 끝난 뒤 이 attempt의 S3 Presigned PUT URL을 받는다(명세 6.4).
 *
 * 날짜를 보내지 않는다. attempt의 `challengeDate`와 문제 번호는 생성 시 값으로 고정돼
 * 있고 서버가 현재 날짜로 다시 계산하지 않는다. 그래서 이 호출은 자정과 무관하다.
 *
 * 재발급해도 새 응시가 아니다 — 서버가 attempt 생성 때 정해둔 같은 S3 object key에
 * 대해서만 URL을 다시 만든다. URL이 만료됐을 때 앱이 할 일은 이 함수를 다시 부르는 것
 * 하나뿐이고, attempt를 다시 만들 이유는 없다.
 *
 * `submissionDeadlineAt`이 지났거나 attempt가 terminal이면 URL을 주지 않는다.
 */
export async function issueChallengeUploadUrl(
  attemptId: string,
  signal?: AbortSignal,
): Promise<ChallengeUploadUrl> {
  const { result } = await apiFetch<ApiEnvelope<RawChallengeUploadUrl>>(
    `/api/v1/challenges/attempts/${attemptId}/upload-url`,
    { method: "POST", signal },
  );
  return mapChallengeUploadUrl(result);
}
